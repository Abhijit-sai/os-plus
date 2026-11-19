-- Add an optional team-owned production name to saved Shopify setup.
-- No backfill, source edits, imports, money or existing-order writes.
-- Historical choices without productionName retain their source title.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '20s';
create or replace function public.save_shopify_manager_draft_setup(p_tenant_id uuid,p_connection_id uuid,p_domain text,p_app_ref text,p_actor_id text,
  p_order_id uuid,p_source_revision_id uuid,p_expected_version bigint,p_request_key uuid,p_choices jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.shopify_source_orders%rowtype;o public.orders%rowtype;prior public.shopify_manager_draft_setups%rowtype;
  v_version bigint;v_hash text;v_line jsonb;v_date text;v_type uuid;v_workflow uuid;v_size uuid;
begin
  if p_order_id is null or p_source_revision_id is null or p_request_key is null
    or p_expected_version is null or p_expected_version not between 0 and 9007199254740990
    or jsonb_typeof(p_choices) is distinct from 'object' or octet_length(p_choices::text)>1000000
    or not p_choices ?& array['customerId','deliveryType','promisedDeliveryDate','note','lines']
    or p_choices-array['customerId','deliveryType','promisedDeliveryDate','note','lines']<>'{}'::jsonb
    or jsonb_typeof(p_choices->'note') is distinct from 'string' or length(p_choices->>'note')>1000
    or (p_choices->'deliveryType'<>'null'::jsonb and coalesce(p_choices->>'deliveryType','') not in ('store_pickup','self_delivery','courier'))
    or jsonb_typeof(p_choices->'lines') is distinct from 'array' or jsonb_array_length(p_choices->'lines') not between 1 and 500
    then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  perform pg_advisory_xact_lock(hashtextextended('shopify-manager-setup:'||p_tenant_id::text||':'||p_request_key::text,0));
  perform public.assert_shopify_setup_actor(p_tenant_id,p_connection_id,p_domain,p_app_ref,p_actor_id);
  v_hash:=encode(sha256(convert_to(jsonb_build_array(p_connection_id,p_order_id,p_source_revision_id,p_expected_version,p_choices)::text,'UTF8')),'hex');
  select * into prior from public.shopify_manager_draft_setups where tenant_id=p_tenant_id and request_key=p_request_key;
  if found then
    if prior.actor_id<>p_actor_id or prior.intent_digest<>v_hash then raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT';end if;
    return jsonb_build_object('setupId',prior.id,'version',prior.version);
  end if;
  select * into s from public.shopify_source_orders where tenant_id=p_tenant_id and connection_id=p_connection_id and order_id=p_order_id for update;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  select * into o from public.orders where tenant_id=p_tenant_id and id=p_order_id for update;
  if not found or o.deleted_at is not null or o.order_status<>'draft' then raise exception 'SHOPIFY_DRAFT_LOCKED';end if;
  if p_source_revision_id is distinct from (select id from public.shopify_source_revisions where tenant_id=p_tenant_id and source_order_id=s.id order by generation desc limit 1)
    or not exists(select 1 from public.shopify_source_revisions r join public.shopify_commercial_details d on d.tenant_id=r.tenant_id and d.revision_id=r.id
      where r.tenant_id=p_tenant_id and r.source_order_id=s.id and r.id=p_source_revision_id and r.completeness='complete')
    then raise exception 'SHOPIFY_STALE_REVISION';end if;
  select coalesce(max(version),0) into v_version from public.shopify_manager_draft_setups where tenant_id=p_tenant_id and source_order_id=s.id;
  if v_version<>p_expected_version then raise exception 'SHOPIFY_STALE_REVISION';end if;
  if p_choices->>'customerId' is not null then
    perform 1 from public.customers where tenant_id=p_tenant_id and id=(p_choices->>'customerId')::uuid and deleted_at is null for share;
    if not found then raise exception 'SHOPIFY_CUSTOMER_INVALID';end if;
  end if;
  v_date:=p_choices->>'promisedDeliveryDate';
  if v_date is not null and (v_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char(v_date::date,'YYYY-MM-DD')<>v_date) then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  if jsonb_array_length(p_choices->'lines')<>(select count(*) from public.shopify_source_lines where tenant_id=p_tenant_id and revision_id=p_source_revision_id)
    or exists(select 1 from jsonb_array_elements(p_choices->'lines') x group by x->>'lineGid' having count(*)<>1)
    then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  for v_line in select value from jsonb_array_elements(p_choices->'lines') loop
    if jsonb_typeof(v_line)<>'object' or not v_line ?& array['lineGid','itemTypeId','workflowId','standardSizeId','expectedCompletionDate']
      or v_line-array['lineGid','itemTypeId','workflowId','standardSizeId','expectedCompletionDate','productionName']<>'{}'::jsonb
      or not exists(select 1 from public.shopify_source_lines where tenant_id=p_tenant_id and revision_id=p_source_revision_id and line_gid=v_line->>'lineGid')
      then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
    if v_line ? 'productionName' and v_line->'productionName'<>'null'::jsonb and
      (jsonb_typeof(v_line->'productionName')<>'string' or length(btrim(v_line->>'productionName')) not between 1 and 2000)
      then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
    v_type:=(v_line->>'itemTypeId')::uuid;v_workflow:=(v_line->>'workflowId')::uuid;v_size:=(v_line->>'standardSizeId')::uuid;
    if v_type is not null then
      perform 1 from public.item_types where tenant_id=p_tenant_id and id=v_type and is_active and deleted_at is null for share nowait;
      if not found then raise exception 'SHOPIFY_CONFIGURATION_INVALID';end if;
    end if;
    if v_workflow is not null then
      perform 1 from public.workflows where tenant_id=p_tenant_id and id=v_workflow and is_active and deleted_at is null
        and (v_type is null or item_type_id is null or item_type_id=v_type) for share nowait;
      if not found then raise exception 'SHOPIFY_CONFIGURATION_INVALID';end if;
    end if;
    if v_size is not null then
      perform 1 from public.item_type_standard_sizes where tenant_id=p_tenant_id and id=v_size and item_type_id=v_type and is_active and deleted_at is null for share nowait;
      if not found then raise exception 'SHOPIFY_CONFIGURATION_INVALID';end if;
    end if;
    v_date:=v_line->>'expectedCompletionDate';
    if v_date is not null and (v_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char(v_date::date,'YYYY-MM-DD')<>v_date) then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  end loop;
  insert into public.shopify_manager_draft_setups(tenant_id,source_order_id,source_revision_id,version,actor_id,request_key,intent_digest,choices)
    values(p_tenant_id,s.id,p_source_revision_id,v_version+1,p_actor_id,p_request_key,v_hash,p_choices) returning * into prior;
  return jsonb_build_object('setupId',prior.id,'version',prior.version);
exception when lock_not_available then raise exception 'SHOPIFY_CONFIGURATION_BUSY';
end $$;

create or replace function public.complete_shopify_manager_setup(p_tenant_id uuid,p_connection_id uuid,p_domain text,p_app_ref text,p_actor_id text,
  p_order_id uuid,p_setup_id uuid,p_request_key uuid,p_connection_revision bigint,p_source_updated_at timestamptz,p_verified_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.shopify_connections%rowtype;s public.shopify_source_orders%rowtype;o public.orders%rowtype;
  setup public.shopify_manager_draft_setups%rowtype;revision public.shopify_source_revisions%rowtype;prior public.shopify_releases%rowtype;
  details jsonb;choice jsonb;line jsonb;v_hash text;v_result jsonb;v_config record;
  v_type uuid;v_workflow uuid;v_size uuid;v_item uuid;v_instance uuid;v_first uuid;v_stage uuid;
  v_unit numeric;v_gross numeric;v_net numeric;v_subtotal numeric:=0;v_discount numeric:=0;v_count integer:=0;
begin
  if p_order_id is null or p_setup_id is null or p_request_key is null or p_connection_revision is null
    or p_source_updated_at is null or not isfinite(p_source_updated_at) or p_verified_at is null or not isfinite(p_verified_at)
    then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  perform pg_advisory_xact_lock(hashtextextended('shopify-manager-complete:'||p_tenant_id::text||':'||p_request_key::text,0));
  c:=public.assert_shopify_setup_actor(p_tenant_id,p_connection_id,p_domain,p_app_ref,p_actor_id);
  v_hash:=encode(sha256(convert_to(jsonb_build_array(p_connection_id,p_order_id,p_setup_id)::text,'UTF8')),'hex');
  select * into prior from public.shopify_releases where tenant_id=p_tenant_id and request_key=p_request_key;
  if found then
    if prior.actor_id<>p_actor_id or prior.intent_digest<>v_hash or prior.manager_setup_id is distinct from p_setup_id
      then raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT';end if;
    return prior.result;
  end if;
  if c.revision<>p_connection_revision or c.status<>'verified' or not c.processing_enabled or not c.draft_import_enabled
    then raise exception 'SHOPIFY_STALE_REVISION';end if;
  select * into s from public.shopify_source_orders where tenant_id=p_tenant_id and connection_id=p_connection_id and order_id=p_order_id for update;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  select * into o from public.orders where tenant_id=p_tenant_id and id=p_order_id for update;
  if not found or o.deleted_at is not null or o.order_status<>'draft' or exists(select 1 from public.shopify_releases where source_order_id=s.id)
    then raise exception 'SHOPIFY_DRAFT_LOCKED';end if;
  select * into setup from public.shopify_manager_draft_setups where tenant_id=p_tenant_id and source_order_id=s.id and id=p_setup_id;
  if not found or setup.version<>(select max(version) from public.shopify_manager_draft_setups where tenant_id=p_tenant_id and source_order_id=s.id)
    then raise exception 'SHOPIFY_STALE_REVISION';end if;
  select * into revision from public.shopify_source_revisions where tenant_id=p_tenant_id and source_order_id=s.id order by generation desc limit 1;
  if not found or revision.id<>setup.source_revision_id or revision.completeness<>'complete' or revision.source_updated_at<>p_source_updated_at
    or p_verified_at>clock_timestamp() or p_verified_at<clock_timestamp()-interval '120 seconds'
    or exists(select 1 from public.shopify_sync_jobs where tenant_id=p_tenant_id and connection_id=p_connection_id and order_gid=s.order_gid and requested_generation<>completed_generation)
    or not exists(select 1 from public.shopify_revision_facts where tenant_id=p_tenant_id and revision_id=revision.id and meaningful_digest is not null)
    then raise exception 'SHOPIFY_STALE_REVISION';end if;
  select d.details into details from public.shopify_commercial_details d where d.tenant_id=p_tenant_id and d.source_order_id=s.id and d.revision_id=revision.id;
  if not found or details->>'cancelledAt' is not null or details->>'currency' is distinct from 'INR'
    or o.source_currency_code<>'INR' or details->'payment'->>'validation' is distinct from 'source_consistent'
    or coalesce(details->'payment'->>'status','') in ('','REFUNDED','PARTIALLY_REFUNDED')
    or jsonb_array_length(details->'lines')<>jsonb_array_length(setup.choices->'lines')
    then raise exception 'SHOPIFY_SOURCE_REVIEW';end if;
  if setup.choices->>'customerId' is null or coalesce(setup.choices->>'deliveryType','') not in ('store_pickup','self_delivery','courier')
    then raise exception 'SHOPIFY_SETUP_INCOMPLETE';end if;
  perform 1 from public.customers where tenant_id=p_tenant_id and id=(setup.choices->>'customerId')::uuid and deleted_at is null for share;
  if not found then raise exception 'SHOPIFY_CUSTOMER_INVALID';end if;
  -- Do not wait behind configuration commands with a different lock order.
  -- NOWAIT makes configuration edits retryable, with no partial item creation.
  perform w.id from public.workflows w where w.tenant_id=p_tenant_id and w.id in
    (select (x->>'workflowId')::uuid from jsonb_array_elements(setup.choices->'lines') x) order by w.id for share nowait;
  perform ws.id from public.workflow_stages ws where ws.tenant_id=p_tenant_id and ws.workflow_id in
    (select (x->>'workflowId')::uuid from jsonb_array_elements(setup.choices->'lines') x) order by ws.id for share nowait;
  perform sm.id from public.stage_master sm where sm.tenant_id=p_tenant_id and sm.id in
    (select ws.stage_master_id from public.workflow_stages ws where ws.tenant_id=p_tenant_id and ws.workflow_id in
      (select (x->>'workflowId')::uuid from jsonb_array_elements(setup.choices->'lines') x)) order by sm.id for share nowait;
  insert into public.shopify_release_capabilities values(pg_backend_pid(),txid_current(),p_tenant_id,p_order_id);
  for choice in select value from jsonb_array_elements(setup.choices->'lines') loop
    select value into line from jsonb_array_elements(details->'lines') where value->>'id'=choice->>'lineGid';
    if not found or line->>'currentQuantity' is distinct from line->>'quantity'
      or line->'isGiftCard' is distinct from 'false'::jsonb or line->'requiresShipping' is distinct from 'true'::jsonb
      or coalesce(line->>'unitCurrency','')<>'INR' or coalesce(line->>'unitPrice','') !~ '^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$'
      or coalesce(line->>'currentLineSubtotal','') !~ '^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$'
      or length(coalesce(btrim(line->>'title'),'')) not between 1 and 2000
      or not exists(select 1 from public.shopify_source_lines where tenant_id=p_tenant_id and revision_id=revision.id
        and line_gid=choice->>'lineGid' and quantity=(line->>'quantity')::integer and current_quantity=quantity)
      then raise exception 'SHOPIFY_SOURCE_REVIEW';end if;
    if choice ? 'productionName' and choice->'productionName'<>'null'::jsonb and
      (jsonb_typeof(choice->'productionName')<>'string' or length(btrim(choice->>'productionName')) not between 1 and 2000)
      then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
    v_type:=(choice->>'itemTypeId')::uuid;v_workflow:=(choice->>'workflowId')::uuid;v_size:=(choice->>'standardSizeId')::uuid;
    if v_type is null or v_workflow is null then raise exception 'SHOPIFY_SETUP_INCOMPLETE';end if;
    perform 1 from public.item_types where tenant_id=p_tenant_id and id=v_type and is_active and deleted_at is null for share nowait;
    if not found then raise exception 'SHOPIFY_CONFIGURATION_INVALID';end if;
    if not exists(select 1 from public.workflows where tenant_id=p_tenant_id and id=v_workflow and is_active and deleted_at is null and (item_type_id is null or item_type_id=v_type))
      then raise exception 'SHOPIFY_CONFIGURATION_INVALID';end if;
    if v_size is not null then
      perform 1 from public.item_type_standard_sizes where tenant_id=p_tenant_id and id=v_size and item_type_id=v_type and is_active and deleted_at is null for share nowait;
      if not found then raise exception 'SHOPIFY_CONFIGURATION_INVALID';end if;
    end if;
    v_unit:=(line->>'unitPrice')::numeric;v_gross:=v_unit*(line->>'quantity')::integer;v_net:=(line->>'currentLineSubtotal')::numeric;
    if v_gross<v_net or v_gross>=10000000000 then raise exception 'SHOPIFY_SOURCE_REVIEW';end if;
    insert into public.order_items(tenant_id,order_id,item_type_id,workflow_id,standard_size_id,name,quantity,unit_price,discount_amount,final_price,
      expected_completion_date,is_customer_visible,created_by,updated_by)
      values(p_tenant_id,p_order_id,v_type,v_workflow,v_size,coalesce(nullif(btrim(choice->>'productionName'),''),line->>'title'),(line->>'quantity')::integer,v_unit,v_gross-v_net,v_net,
        (choice->>'expectedCompletionDate')::date,false,p_actor_id,p_actor_id) returning id into v_item;
    insert into public.item_workflow_instances(tenant_id,order_item_id,workflow_id,created_by,updated_by)
      values(p_tenant_id,v_item,v_workflow,p_actor_id,p_actor_id) returning id into v_instance;
    v_first:=null;
    for v_config in select ws.*,sm.is_active as master_active,sm.deleted_at as master_deleted,
      coalesce(ws.customer_status_id,sm.default_customer_status_id) as public_status
      from public.workflow_stages ws left join public.stage_master sm on sm.tenant_id=ws.tenant_id and sm.id=ws.stage_master_id
      where ws.tenant_id=p_tenant_id and ws.workflow_id=v_workflow and ws.is_active and ws.deleted_at is null order by ws.sequence_number loop
      if not coalesce(v_config.master_active,false) or v_config.master_deleted is not null then raise exception 'SHOPIFY_CONFIGURATION_INVALID';end if;
      if v_config.public_status is not null then
        perform 1 from public.customer_statuses where tenant_id=p_tenant_id and id=v_config.public_status and is_active and deleted_at is null for share nowait;
        if not found then raise exception 'SHOPIFY_CONFIGURATION_INVALID';end if;
      end if;
      insert into public.item_stage_instances(tenant_id,workflow_instance_id,order_item_id,workflow_stage_id,stage_master_id,sequence_number,status,customer_status_id,created_by,updated_by)
        values(p_tenant_id,v_instance,v_item,v_config.id,v_config.stage_master_id,v_config.sequence_number,
          case when v_first is null then 'ready_to_start'::public.item_stage_status else 'not_started'::public.item_stage_status end,
          v_config.public_status,p_actor_id,p_actor_id) returning id into v_stage;
      if v_first is null then v_first:=v_stage;end if;
    end loop;
    if v_first is null then raise exception 'SHOPIFY_CONFIGURATION_INVALID';end if;
    update public.item_workflow_instances set current_stage_instance_id=v_first where tenant_id=p_tenant_id and id=v_instance;
    insert into public.item_history(tenant_id,order_item_id,event_type,new_value_json,notes,created_by)
      values(p_tenant_id,v_item,'shopify_setup_completed',jsonb_build_object('workflow_id',v_workflow,'workflow_instance_id',v_instance),
        'Team completed order setup.',p_actor_id);
    insert into public.shopify_order_item_links(tenant_id,source_order_id,order_id,line_gid,order_item_id,source_revision_id,manager_setup_id)
      values(p_tenant_id,s.id,p_order_id,choice->>'lineGid',v_item,revision.id,setup.id);
    v_count:=v_count+1;v_subtotal:=v_subtotal+v_gross;v_discount:=v_discount+v_gross-v_net;
  end loop;
  if v_count=0 or v_subtotal>=10000000000 then raise exception 'SHOPIFY_SOURCE_REVIEW';end if;
  update public.orders set customer_id=(setup.choices->>'customerId')::uuid,delivery_type=(setup.choices->>'deliveryType')::public.delivery_type,
    promised_delivery_date=(setup.choices->>'promisedDeliveryDate')::date,subtotal=v_subtotal,discount_amount=v_discount,
    total_amount=v_subtotal-v_discount,order_status='confirmed',updated_by=p_actor_id where tenant_id=p_tenant_id and id=p_order_id;
  if p_verified_at<clock_timestamp()-interval '120 seconds' then raise exception 'SHOPIFY_STALE_REVISION';end if;
  v_result:=jsonb_build_object('status','setup_complete','orderId',p_order_id,'sourceRevisionId',revision.id,'itemCount',v_count);
  insert into public.shopify_releases(tenant_id,source_order_id,source_revision_id,review_id,actor_id,request_key,intent_digest,result,manager_setup_id)
    values(p_tenant_id,s.id,revision.id,null,p_actor_id,p_request_key,v_hash,v_result,setup.id);
  insert into public.shopify_operational_state(tenant_id,source_order_id,latest_revision_id,accepted_revision_id,held,reasons)
    values(p_tenant_id,s.id,revision.id,revision.id,false,'[]'::jsonb);
  delete from public.shopify_release_capabilities where backend_pid=pg_backend_pid() and transaction_id=txid_current() and tenant_id=p_tenant_id and order_id=p_order_id;
  return v_result;
exception when lock_not_available then raise exception 'SHOPIFY_CONFIGURATION_BUSY';
end $$;
-- CREATE OR REPLACE preserves ownership and current ACLs. Reassert the
-- established service-only boundary for these exact signatures.
REVOKE ALL ON FUNCTION public.save_shopify_manager_draft_setup(uuid,uuid,text,text,text,uuid,uuid,bigint,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_shopify_manager_draft_setup(uuid,uuid,text,text,text,uuid,uuid,bigint,uuid,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.complete_shopify_manager_setup(uuid,uuid,text,text,text,uuid,uuid,uuid,bigint,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_shopify_manager_setup(uuid,uuid,text,text,text,uuid,uuid,uuid,bigint,timestamptz,timestamptz) TO service_role;
COMMIT;
