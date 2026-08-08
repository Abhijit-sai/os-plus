create table attendance_imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  file_name text not null,
  file_hash text not null,
  report_month date not null,
  idempotency_key uuid not null,
  source_row_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  result_json jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  constraint attendance_imports_file_hash_check check (file_hash ~ '^[0-9a-f]{64}$'),
  constraint attendance_imports_report_month_check check (extract(day from report_month) = 1),
  constraint attendance_imports_counts_check check (
    source_row_count >= 0 and inserted_count >= 0 and updated_count >= 0 and skipped_count >= 0
  ),
  constraint attendance_imports_tenant_idempotency_unique unique (tenant_id, idempotency_key)
);

create index attendance_imports_tenant_created_idx on attendance_imports(tenant_id, created_at desc);
alter table attendance_imports enable row level security;

create or replace function prevent_immutable_audit_change()
returns trigger language plpgsql as $$
begin
  if pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'IMMUTABLE_AUDIT_RECORD' using errcode = 'P0001';
end;
$$;

create trigger attendance_imports_immutable
before update or delete on attendance_imports
for each row execute function prevent_immutable_audit_change();

comment on table attendance_imports is
  'Immutable tenant-scoped audit receipts for confirmed attendance workbook imports. Unmatched, ambiguous, blank-status, unknown-status, and future rows are never written to attendance.';

create or replace function import_attendance_rows(
  p_tenant_id uuid,
  p_file_name text,
  p_file_hash text,
  p_report_month date,
  p_idempotency_key uuid,
  p_rows jsonb,
  p_summary jsonb,
  p_actor_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_import attendance_imports%rowtype;
  v_row record;
  v_attendance_id uuid;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_result jsonb;
begin
  if p_tenant_id is null or not exists (select 1 from tenants where id = p_tenant_id) then
    raise exception 'TENANT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_idempotency_key is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001'; end if;
  if p_file_hash !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_FILE_HASH' using errcode = 'P0001'; end if;
  if p_report_month is null or extract(day from p_report_month) <> 1 then
    raise exception 'INVALID_REPORT_MONTH' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'INVALID_ATTENDANCE_ROWS' using errcode = 'P0001'; end if;
  if jsonb_array_length(p_rows) > 15500 then raise exception 'TOO_MANY_ATTENDANCE_ROWS' using errcode = 'P0001'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_idempotency_key::text, 0));
  select * into v_existing_import
  from attendance_imports
  where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_import.file_hash <> p_file_hash then
      raise exception 'IDEMPOTENCY_KEY_FILE_MISMATCH' using errcode = 'P0001';
    end if;
    return v_existing_import.result_json || jsonb_build_object('idempotentReplay', true);
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as item(worker_id uuid, attendance_date date, status text)
    group by item.worker_id, item.attendance_date
    having count(*) > 1
  ) then raise exception 'DUPLICATE_WORKER_DATE_ROWS' using errcode = 'P0001'; end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as item(worker_id uuid, attendance_date date, status text, total_hours numeric)
    where item.worker_id is null
      or item.attendance_date is null
      or item.attendance_date > timezone('Asia/Kolkata', now())::date
      or item.status not in ('present', 'absent', 'half_day', 'leave', 'holiday')
      or item.total_hours < 0
      or item.total_hours > 24
  ) then raise exception 'INVALID_ATTENDANCE_ROW' using errcode = 'P0001'; end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as item(worker_id uuid)
    where not exists (
      select 1 from workers
      where workers.id = item.worker_id
        and workers.tenant_id = p_tenant_id
        and workers.status = 'active'
        and workers.deleted_at is null
    )
  ) then raise exception 'WORKER_NOT_ACTIVE_IN_TENANT' using errcode = 'P0001'; end if;

  for v_row in
    select *
    from jsonb_to_recordset(p_rows) as item(
      worker_id uuid,
      attendance_date date,
      status text,
      check_in_time time,
      check_out_time time,
      total_hours numeric,
      source_status text
    )
    order by item.attendance_date, item.worker_id
  loop
    v_attendance_id := null;
    select id into v_attendance_id
    from attendance
    where tenant_id = p_tenant_id
      and worker_id = v_row.worker_id
      and attendance_date = v_row.attendance_date
      and deleted_at is null
    for update;

    if v_attendance_id is not null then
      update attendance set
        status = v_row.status::attendance_status,
        check_in_time = v_row.check_in_time,
        check_out_time = v_row.check_out_time,
        total_hours = v_row.total_hours,
        marked_by = p_actor_id,
        notes = coalesce(attendance.notes, format('Imported from %s (source status %s).', p_file_name, v_row.source_status))
      where tenant_id = p_tenant_id and id = v_attendance_id;
      v_updated := v_updated + 1;
    else
      insert into attendance (
        tenant_id, worker_id, attendance_date, status, check_in_time, check_out_time,
        total_hours, marked_by, notes
      ) values (
        p_tenant_id, v_row.worker_id, v_row.attendance_date, v_row.status::attendance_status,
        v_row.check_in_time, v_row.check_out_time, v_row.total_hours, p_actor_id,
        format('Imported from %s (source status %s).', p_file_name, v_row.source_status)
      );
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  v_result := coalesce(p_summary, '{}'::jsonb) || jsonb_build_object(
    'insertedCount', v_inserted,
    'updatedCount', v_updated,
    'idempotentReplay', false
  );

  insert into attendance_imports (
    tenant_id, file_name, file_hash, report_month, idempotency_key, source_row_count,
    inserted_count, updated_count, skipped_count, result_json, created_by
  ) values (
    p_tenant_id, btrim(p_file_name), p_file_hash, p_report_month, p_idempotency_key,
    jsonb_array_length(p_rows), v_inserted, v_updated,
    greatest(coalesce((p_summary ->> 'skippedCount')::integer, 0), 0), v_result, p_actor_id
  );

  return v_result;
end;
$$;

revoke all on function import_attendance_rows(uuid, text, text, date, uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function import_attendance_rows(uuid, text, text, date, uuid, jsonb, jsonb, text) to service_role;
