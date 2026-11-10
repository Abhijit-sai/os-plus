create table public.boutique_onboarding (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  profile jsonb,
  last_step text check (last_step in ('boutique', 'garments', 'teams', 'flows', 'review')),
  updated_by text not null
);

alter table public.boutique_onboarding enable row level security;
revoke all on public.boutique_onboarding from public, anon, authenticated;
grant select, insert, update on public.boutique_onboarding to service_role;

create function public.save_boutique_onboarding_profile(
  p_tenant_id uuid, p_store_name text, p_profile jsonb, p_actor_id text
) returns void language plpgsql set search_path = public as $$
begin
  update tenants set store_name = p_store_name where id = p_tenant_id
    and store_name is distinct from p_store_name;

  insert into boutique_onboarding (tenant_id, profile, last_step, updated_by)
    values (p_tenant_id, p_profile, 'garments', p_actor_id)
    on conflict (tenant_id) do update
    set profile = excluded.profile, last_step = excluded.last_step, updated_by = excluded.updated_by;
end;
$$;

-- Create the workflow and its new stage masters together. Existing stage
-- masters (and their workgroup assignments) are shared across workflows.
create function public.create_boutique_onboarding_workflow(
  p_tenant_id uuid, p_item_type_id uuid, p_name text, p_is_default boolean,
  p_rows jsonb, p_actor_id text
) returns uuid language plpgsql set search_path = public as $$
declare
  v_row jsonb;
  v_stage_id uuid;
  v_group_id uuid;
  v_name text;
  v_stage_ids uuid[] := '{}';
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'WORKFLOW_REQUIRES_STAGE';
  end if;
  if jsonb_array_length(p_rows) not between 1 and 50 then
    raise exception 'WORKFLOW_REQUIRES_STAGE';
  end if;

  -- Lock in the same order as create_workflow_configuration.
  perform 1 from item_types where id = p_item_type_id and tenant_id = p_tenant_id
    and is_active and deleted_at is null for update;
  if not found then raise exception 'ITEM_TYPE_NOT_FOUND'; end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_stage_id := nullif(v_row->>'stageId', '')::uuid;
    if v_stage_id is null then
      v_group_id := (v_row->>'workgroupId')::uuid;
      v_name := btrim(v_row->>'name');
      if v_name is null or char_length(v_name) not between 2 and 65 then
        raise exception 'STAGE_NAME_REQUIRED';
      end if;
      perform 1 from workgroups where id = v_group_id and tenant_id = p_tenant_id
        and is_active and deleted_at is null for share;
      if not found then raise exception 'WORKGROUP_NOT_FOUND'; end if;

      insert into stage_master (tenant_id, name, created_by, updated_by)
        values (p_tenant_id, v_name, p_actor_id, p_actor_id)
        on conflict (tenant_id, lower(name)) where deleted_at is null do nothing
        returning id into v_stage_id;
      if v_stage_id is null then
        raise exception 'STAGE_ALREADY_EXISTS';
      end if;
      insert into stage_workgroups (tenant_id, stage_master_id, workgroup_id, created_by)
        values (p_tenant_id, v_stage_id, v_group_id, p_actor_id);
    end if;
    v_stage_ids := array_append(v_stage_ids, v_stage_id);
  end loop;

  return create_workflow_configuration(
    p_tenant_id, p_name, null, p_item_type_id, p_is_default, v_stage_ids, p_actor_id
  );
end;
$$;

revoke all on function public.save_boutique_onboarding_profile(uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.save_boutique_onboarding_profile(uuid, text, jsonb, text) to service_role;
revoke all on function public.create_boutique_onboarding_workflow(uuid, uuid, text, boolean, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_boutique_onboarding_workflow(uuid, uuid, text, boolean, jsonb, text) to service_role;
