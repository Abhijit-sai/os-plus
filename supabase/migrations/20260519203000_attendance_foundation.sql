create type attendance_status as enum ('present', 'absent', 'half_day', 'leave', 'holiday');

create table attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete cascade,
  attendance_date date not null,
  status attendance_status not null default 'present',
  check_in_time time,
  check_out_time time,
  total_hours numeric(5, 2),
  marked_by text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint attendance_total_hours_non_negative check (total_hours is null or total_hours >= 0)
);

create trigger attendance_set_updated_at
before update on attendance
for each row
execute function set_updated_at();

create unique index attendance_tenant_worker_date_active_idx
on attendance(tenant_id, worker_id, attendance_date)
where deleted_at is null;

create index attendance_tenant_date_idx on attendance(tenant_id, attendance_date);
create index attendance_tenant_worker_idx on attendance(tenant_id, worker_id);
create index attendance_tenant_status_idx on attendance(tenant_id, status);

alter table attendance enable row level security;

comment on table attendance is 'Tenant-owned manual worker attendance. Attendance is separate from production work logs.';
