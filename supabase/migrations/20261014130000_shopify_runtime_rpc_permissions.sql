-- Forward repair only. Restore the existing service-only command contract;
-- no command bodies, business rows, default grants or unrelated modules change.
do $$
declare f record; names text[]:=array[
  'initialize_work_unit_workflow','start_work_unit_stage','complete_work_unit_stage',
  'create_work_unit_runtime','create_task_command','assign_task_command',
  'start_task_command','complete_task_command','cancel_task_command',
  'start_work_unit_stage_command','complete_work_unit_stage_command',
  'assert_laundry_vertical_enabled','generate_laundry_human_code','generate_qr_identity_token',
  'create_laundry_pickup_request_command','create_laundry_container_asset_command',
  'complete_laundry_pickup_request_command','create_laundry_service_lot_command'];
begin
  if (select count(distinct p.proname) from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=any(names))<>cardinality(names)
    then raise exception 'SHOPIFY_SECURITY_PREREQUISITE_MISSING';end if;
  for f in select p.oid::regprocedure as signature from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=any(names) order by p.oid
  loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
