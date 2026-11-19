-- Allow confirmed Shopify orders to enter production before delivery is assigned.
-- Preserve local order requirements and the Shopify source and finance boundaries.
begin;

alter table public.orders drop constraint orders_customer_and_delivery_required;
alter table public.orders add constraint orders_customer_and_delivery_required check (
  (customer_id is not null and (delivery_type is not null or source='shopify'))
  or (source='shopify' and order_status='draft')
);

create or replace view public.operational_orders with (security_invoker=true) as
  select o.* from public.orders o where (o.source<>'shopify' and o.financial_management='local' and o.order_status<>'draft')
    or (o.source='shopify' and o.financial_management='external_shopify' and o.order_status<>'draft' and o.customer_id is not null
      and exists(select 1 from public.shopify_source_orders s join public.shopify_releases r on r.tenant_id=s.tenant_id and r.source_order_id=s.id where s.tenant_id=o.tenant_id and s.order_id=o.id));

-- Keep the old projection available during rollout for clients with a strict
-- schema that predates the configured default workflow field.
create function public.read_shopify_manager_draft_setup_with_defaults(p_tenant_id uuid,p_actor_id text,p_domain text,p_app_ref text,p_order_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  with draft as materialized (
    select public.read_shopify_manager_draft_setup(p_tenant_id,p_actor_id,p_domain,p_app_ref,p_order_id) as data
  ), setup_item_types as (
    select i.id,i.name,i.default_workflow_id from draft
    cross join lateral jsonb_array_elements(draft.data->'itemTypes') choice
    join public.item_types i on i.tenant_id=p_tenant_id and i.id=(choice->>'id')::uuid
  )
  select data || jsonb_build_object(
    'itemTypes',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'defaultWorkflowId',x.default_workflow_id) order by x.name,x.id),'[]') from setup_item_types x),
    'workflows',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'itemTypeId',x.item_type_id) order by x.name,x.id),'[]') from
      (select w.id,w.name,w.item_type_id from public.workflows w where w.tenant_id=p_tenant_id and w.is_active and w.deleted_at is null
        order by (exists(select 1 from setup_item_types i where i.default_workflow_id=w.id and (w.item_type_id is null or w.item_type_id=i.id))) desc,
          w.name,w.id limit 500) x)
  ) from draft where data is not null;
$$;
revoke all on function public.read_shopify_manager_draft_setup_with_defaults(uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.read_shopify_manager_draft_setup_with_defaults(uuid,text,text,text,uuid) to service_role;

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
  if setup.choices->>'customerId' is null or (setup.choices->>'deliveryType' is not null
      and setup.choices->>'deliveryType' not in ('store_pickup','self_delivery','courier'))
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

create or replace function public.guard_shopify_draft_order() returns trigger
language plpgsql set search_path=public,pg_temp as $$
declare is_owner boolean;
begin
  is_owner:=current_user=pg_get_userbyid((select relowner from pg_class where oid='public.orders'::regclass));
  if tg_op='INSERT' and new.source='shopify' and (not is_owner or new.order_status<>'draft') then raise exception 'SHOPIFY_DRAFT_LOCKED';end if;
  if tg_op='DELETE' and old.source='shopify' then raise exception 'SHOPIFY_DRAFT_LOCKED';end if;
  if tg_op='UPDATE' and (old.source='shopify' or new.source='shopify') then
    if is_owner and public.has_shopify_reference_capability(old.tenant_id,old.id,new.reference_order_id) then
      if (to_jsonb(new)-array['reference_order_id','updated_at','updated_by']) is distinct from
        (to_jsonb(old)-array['reference_order_id','updated_at','updated_by']) then raise exception 'SHOPIFY_DRAFT_LOCKED';end if;
    elsif is_owner and public.has_shopify_release_capability(old.tenant_id,old.id) then
      if (to_jsonb(new)-array['customer_id','delivery_type','promised_delivery_date','subtotal','discount_amount','total_amount','order_status','updated_at','updated_by']) is distinct from
        (to_jsonb(old)-array['customer_id','delivery_type','promised_delivery_date','subtotal','discount_amount','total_amount','order_status','updated_at','updated_by']) or old.order_status<>'draft' or new.order_status<>'confirmed' then raise exception 'SHOPIFY_DRAFT_LOCKED';end if;
    elsif old.order_status='draft' then
      if (to_jsonb(new)-array['customer_id','source_currency_code','updated_at','updated_by','deleted_at']) is distinct from (to_jsonb(old)-array['customer_id','source_currency_code','updated_at','updated_by','deleted_at'])
        or (new.customer_id is distinct from old.customer_id and not is_owner)
        or (new.source_currency_code is distinct from old.source_currency_code and (not is_owner or old.source_currency_code<>'XXX' or new.source_currency_code='XXX')) then raise exception 'SHOPIFY_DRAFT_LOCKED';end if;
    elsif is_owner and old.delivery_type is null and new.delivery_type is not null
      and old.order_status <> 'draft' and old.order_status <> 'cancelled'
      and (to_jsonb(new)-array['delivery_type','updated_at','updated_by']) is not distinct from
          (to_jsonb(old)-array['delivery_type','updated_at','updated_by']) then
      return new;
    elsif (to_jsonb(new)-array['order_status','notes','updated_at','updated_by']) is distinct from (to_jsonb(old)-array['order_status','notes','updated_at','updated_by'])
      or new.order_status='draft' then raise exception 'SHOPIFY_ORDER_READ_ONLY';end if;
  end if;
  if tg_op='DELETE' then return old;end if;return new;
end $$;

-- Assign delivery once on an already released order. A retry with the same
-- method succeeds while a concurrent different choice is preserved.
create function public.assign_shopify_order_delivery(
  p_tenant_id uuid,p_order_id uuid,p_actor_id text,p_delivery_type public.delivery_type
) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_source_id uuid;
  v_order public.orders%rowtype;
begin
  if p_delivery_type is null or not exists(
    select 1 from public.tenant_users u join public.tenants t on t.id=u.tenant_id
    where u.tenant_id=p_tenant_id and u.clerk_user_id=p_actor_id and u.status='active'
      and u.role in ('owner_admin','manager') and t.status='active'
  ) then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;

  select id into v_source_id from public.shopify_source_orders
    where tenant_id=p_tenant_id and order_id=p_order_id for share;
  if not found or not exists(
    select 1 from public.shopify_releases where tenant_id=p_tenant_id and source_order_id=v_source_id
  ) then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;

  select * into v_order from public.orders where tenant_id=p_tenant_id and id=p_order_id
    and source='shopify' and financial_management='external_shopify' and deleted_at is null
    and order_status not in ('draft','cancelled') for update;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED'; end if;

  if v_order.delivery_type is not null then return v_order.delivery_type=p_delivery_type; end if;

  update public.orders set delivery_type=p_delivery_type,updated_by=p_actor_id
    where tenant_id=p_tenant_id and id=p_order_id;
  return true;
end $$;
revoke all on function public.assign_shopify_order_delivery(uuid,uuid,text,public.delivery_type) from public,anon,authenticated;
grant execute on function public.assign_shopify_order_delivery(uuid,uuid,text,public.delivery_type) to service_role;

commit;
