-- Dormant. Source observations never rewrite released items, payments or work.
-- Catalogue enrichment has a separate digest from meaningful order-owned facts.
create table public.shopify_revision_facts (
  tenant_id uuid not null,source_order_id uuid not null,revision_id uuid primary key,
  meaningful_digest text check(meaningful_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  foreign key(tenant_id,source_order_id,revision_id) references public.shopify_source_revisions(tenant_id,source_order_id,id) on delete restrict
);
create table public.shopify_change_cases (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null,source_order_id uuid not null,
  revision_id uuid not null,reasons jsonb not null,created_at timestamptz not null default now(),
  unique(tenant_id,source_order_id,id),unique(source_order_id,revision_id),
  foreign key(tenant_id,source_order_id,revision_id) references public.shopify_source_revisions(tenant_id,source_order_id,id) on delete restrict
);
create table public.shopify_operational_state (
  tenant_id uuid not null,source_order_id uuid primary key,latest_revision_id uuid not null,accepted_revision_id uuid not null,
  latest_case_id uuid,held boolean not null default true,reasons jsonb not null default '["UNVERIFIED_SOURCE_BASELINE"]',
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  foreign key(tenant_id,source_order_id,latest_revision_id) references public.shopify_source_revisions(tenant_id,source_order_id,id) on delete restrict,
  foreign key(tenant_id,source_order_id,accepted_revision_id) references public.shopify_source_revisions(tenant_id,source_order_id,id) on delete restrict,
  foreign key(tenant_id,source_order_id,latest_case_id) references public.shopify_change_cases(tenant_id,source_order_id,id) on delete restrict
);
create table public.shopify_change_decisions (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null,source_order_id uuid not null,case_id uuid not null,
  observed_revision_id uuid not null,accepted_revision_id uuid not null,actor_id text not null,request_key uuid not null,
  action text not null check(action in ('keep_on_hold','keep_os_plus_continue')),reason text not null check(length(btrim(reason)) between 3 and 1000),
  intent_digest text not null,result jsonb not null,created_at timestamptz not null default now(),unique(tenant_id,request_key),
  foreign key(tenant_id,source_order_id,case_id) references public.shopify_change_cases(tenant_id,source_order_id,id) on delete restrict,
  foreign key(tenant_id,source_order_id,observed_revision_id) references public.shopify_source_revisions(tenant_id,source_order_id,id) on delete restrict,
  foreign key(tenant_id,source_order_id,accepted_revision_id) references public.shopify_source_revisions(tenant_id,source_order_id,id) on delete restrict
);
do $$ declare t text;begin
  foreach t in array array['shopify_revision_facts','shopify_change_cases','shopify_operational_state','shopify_change_decisions'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
    execute format('grant select on public.%I to service_role',t);
    if t<>'shopify_operational_state' then
      execute format('create trigger shopify_change_immutable before update or delete on public.%I for each row execute function public.protect_shopify_draft_audit()',t);
    end if;
  end loop;
end $$;
create trigger shopify_operational_state_updated_at before update on public.shopify_operational_state
  for each row execute function public.set_updated_at();

-- Private original commands retain all historical fences. No direct executable
-- aliases remain. New public import atomically routes released-source receipts.
alter function public.import_shopify_draft(jsonb,boolean) rename to import_shopify_draft_v1;
revoke all on function public.import_shopify_draft_v1(jsonb,boolean) from public,anon,authenticated,service_role;
create function public.import_shopify_draft(p_input jsonb,p_recovery_only boolean default false) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.shopify_connections%rowtype;s public.shopify_source_orders%rowtype;j public.shopify_sync_jobs%rowtype;
  prior public.shopify_draft_import_results%rowtype;st public.shopify_operational_state%rowtype;
  v_result jsonb;v_intent text;v_id uuid;v_case uuid;v_reasons jsonb;v_digest text;v_accepted text;v_latest text;
  v_updated timestamptz;v_observed timestamptz;v_created timestamptz;v_partial boolean;
begin
  if p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>16777216 or p_recovery_only is null
    then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  v_intent:=encode(sha256(convert_to((p_input-'sealedSource')::text,'UTF8')),'hex');
  select * into c from public.shopify_connections where tenant_id=(p_input->>'tenantId')::uuid and id=(p_input->>'connectionId')::uuid
    and environment=p_input->>'environment' and app_ref=p_input->>'appRef' and shop_gid=p_input->>'shopGid' and canonical_domain=p_input->>'shopDomain' for update;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  select * into prior from public.shopify_draft_import_results where tenant_id=c.tenant_id and connection_id=c.id
    and job_id=(p_input->>'jobId')::uuid and generation=(p_input->>'generation')::bigint;
  if found then
    if prior.intent_digest<>v_intent then raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT';end if;return prior.result;
  end if;
  if p_recovery_only then return null;end if;
  select * into s from public.shopify_source_orders where tenant_id=c.tenant_id and connection_id=c.id and shop_gid=c.shop_gid and order_gid=p_input->>'sourceOrderGid' for update;
  if s.id is null or not exists(select 1 from public.shopify_releases where tenant_id=c.tenant_id and source_order_id=s.id) then
    v_result:=public.import_shopify_draft_v1(p_input,false);
    v_digest:=p_input->>'meaningfulDigest';
    if v_digest is not null and v_digest !~ '^[0-9a-f]{64}$' then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
    insert into public.shopify_revision_facts(tenant_id,source_order_id,revision_id,meaningful_digest)
      select c.tenant_id,source_order_id,id,v_digest from public.shopify_source_revisions where tenant_id=c.tenant_id and id=(v_result->>'sourceRevisionId')::uuid;
    return v_result;
  end if;
  -- Server-authenticated sealed snapshot only; no browser-provided money/state.
  v_updated:=(p_input->>'sourceUpdatedAt')::timestamptz;v_observed:=(p_input->>'observedAt')::timestamptz;v_created:=(p_input->>'sourceCreatedAt')::timestamptz;
  v_partial:=p_input->>'completeness'='partial';v_digest:=p_input->>'meaningfulDigest';
  if coalesce(p_input->>'completeness','complete') not in ('complete','partial') or p_input->>'apiVersion' is distinct from '2026-10'
    or p_input->>'sourceDigest' is null or p_input->>'sourceDigest' !~ '^[0-9a-f]{64}$'
    or (not coalesce(v_partial,false) and (v_digest is null or v_digest !~ '^[0-9a-f]{64}$'))
    or (coalesce(v_partial,false) and v_digest is not null)
    or v_updated is null or v_observed is null or v_created is null or not isfinite(v_updated) or not isfinite(v_observed) or not isfinite(v_created)
    or jsonb_typeof(p_input->'sealedSource') is distinct from 'object' or p_input->'sealedSource'->>'version' is distinct from '1'
    or length(coalesce(p_input->'sealedSource'->>'keyId','')) not between 1 and 64
    or length(coalesce(p_input->'sealedSource'->>'iv',''))<>16 or length(coalesce(p_input->'sealedSource'->>'tag',''))<>24
    or length(coalesce(p_input->'sealedSource'->>'ciphertext','')) not between 1 and 12000000
    or jsonb_typeof(p_input->'reasons') is distinct from 'array' or jsonb_array_length(p_input->'reasons')>40
    or jsonb_typeof(p_input->'lines') is distinct from 'array' or jsonb_array_length(p_input->'lines')>500
    or (coalesce(v_partial,false) and jsonb_array_length(p_input->'lines')<>0)
    or (not coalesce(v_partial,false) and jsonb_array_length(p_input->'lines')=0)
    or exists(select 1 from jsonb_array_elements_text(p_input->'reasons') x where x !~ '^[A-Z_]+$' or length(x)>80)
    or exists(select 1 from jsonb_array_elements(p_input->'lines') x where x->>'lineGid' is null or x->>'lineGid' !~ '^gid://shopify/LineItem/[1-9][0-9]{0,31}$'
      or (x->>'quantity')::integer is null or (x->>'quantity')::integer<=0 or (x->>'currentQuantity')::integer is null
      or (x->>'currentQuantity')::integer<0 or (x->>'currentQuantity')::integer>(x->>'quantity')::integer)
    or exists(select 1 from jsonb_array_elements(p_input->'lines') x group by x->>'lineGid' having count(*)>1)
    then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  perform 1 from public.tenants where id=c.tenant_id and status='active' for share;
  if not found or c.status<>'verified' or c.revision<>(p_input->>'connectionRevision')::bigint
    or not c.intake_enabled or not c.processing_enabled or not c.draft_import_enabled
    or c.scopes_verified_at is null or c.protected_customer_fields_verified_at is null or c.source_copy_authorized_at is null
    or exists(select 1 from public.shopify_privacy_requests where tenant_id=c.tenant_id and connection_id=c.id and topic in ('customers/redact','shop/redact'))
    then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  select * into j from public.shopify_sync_jobs where tenant_id=c.tenant_id and connection_id=c.id and id=(p_input->>'jobId')::uuid and order_gid=s.order_gid for update;
  if not found or j.lease_token is distinct from (p_input->>'leaseToken')::uuid or j.claimed_generation is distinct from (p_input->>'generation')::bigint
    or j.claimed_connection_revision is distinct from c.revision or j.lease_expires_at<=clock_timestamp() or j.dead_lettered_at is not null
    or j.first_attempt_at<=clock_timestamp()-interval '24 hours' then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  if v_created<c.import_created_at_cutoff or v_updated<v_created or v_observed>clock_timestamp() or v_observed<clock_timestamp()-interval '120 seconds'
    or exists(select 1 from public.shopify_source_revisions where tenant_id=c.tenant_id and source_order_id=s.id and source_updated_at>v_updated)
    then raise exception 'SHOPIFY_SOURCE_CHANGED';end if;
  insert into public.shopify_source_revisions(tenant_id,source_order_id,job_id,generation,source_updated_at,observed_at,source_digest,sealed_source,review_reasons,completeness,source_customer_gid)
    values(c.tenant_id,s.id,j.id,j.claimed_generation,v_updated,v_observed,p_input->>'sourceDigest',p_input->'sealedSource',p_input->'reasons',
      case when coalesce(v_partial,false) then 'partial' else 'complete' end,p_input->'customer'->>'shopifyCustomerGid') returning id into v_id;
  insert into public.shopify_revision_facts(tenant_id,source_order_id,revision_id,meaningful_digest) values(c.tenant_id,s.id,v_id,v_digest);
  insert into public.shopify_source_lines(tenant_id,revision_id,line_gid,quantity,current_quantity)
    select c.tenant_id,v_id,x->>'lineGid',(x->>'quantity')::integer,(x->>'currentQuantity')::integer from jsonb_array_elements(p_input->'lines') x;
  select * into st from public.shopify_operational_state where tenant_id=c.tenant_id and source_order_id=s.id;
  if not found then raise exception 'SHOPIFY_UNVERIFIED_BASELINE';end if;
  select meaningful_digest into v_accepted from public.shopify_revision_facts where tenant_id=c.tenant_id and revision_id=st.accepted_revision_id;
  select meaningful_digest into v_latest from public.shopify_revision_facts where tenant_id=c.tenant_id and revision_id=st.latest_revision_id;
  v_reasons:=(select coalesce(jsonb_agg(value order by value),'[]'::jsonb) from jsonb_array_elements_text(p_input->'reasons') where value in ('SOURCE_CANCELLED','SOURCE_REFUND'));
  if coalesce(v_partial,false) then v_reasons:=v_reasons||'"INCOMPLETE_SOURCE"'::jsonb;
  elsif v_accepted is null then v_reasons:=v_reasons||'"UNVERIFIED_SOURCE_BASELINE"'::jsonb;
  elsif v_digest<>v_accepted then v_reasons:=v_reasons||'"SOURCE_CHANGED"'::jsonb;
  elsif st.held and v_latest is distinct from v_digest then v_reasons:=v_reasons||'"SOURCE_RESTORED_PENDING_REVIEW"'::jsonb;end if;
  -- Same meaningful snapshot never adds duplicate review cases. A new revision
  -- after a reasoned acknowledgement can re-hold; returning to A after B is
  -- not mistaken for a globally deduplicated old event. Existing holds persist.
  v_case:=st.latest_case_id;
  if jsonb_array_length(v_reasons)>0 and (v_latest is distinct from v_digest or st.latest_case_id is null
    or (coalesce(v_partial,false) and st.reasons is distinct from v_reasons)) then
    insert into public.shopify_change_cases(tenant_id,source_order_id,revision_id,reasons) values(c.tenant_id,s.id,v_id,v_reasons) returning id into v_case;
    update public.shopify_operational_state set held=true,reasons=v_reasons,latest_case_id=v_case where source_order_id=s.id and tenant_id=c.tenant_id;
  end if;
  update public.shopify_operational_state set latest_revision_id=v_id where source_order_id=s.id and tenant_id=c.tenant_id;
  if j.lease_expires_at<=clock_timestamp() or v_observed<clock_timestamp()-interval '120 seconds' then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  v_result:=jsonb_build_object('status','observed','orderId',s.order_id,'sourceRevisionId',v_id,'tenantId',c.tenant_id,
    'customerId',(select customer_id from public.orders where tenant_id=c.tenant_id and id=s.order_id),
    'customerResolution','reused','reasons',(select reasons from public.shopify_operational_state where tenant_id=c.tenant_id and source_order_id=s.id),'releaseEligible',false);
  insert into public.shopify_draft_import_results(tenant_id,connection_id,job_id,generation,intent_digest,result) values(c.tenant_id,c.id,j.id,j.claimed_generation,v_intent,v_result);
  update public.shopify_sync_jobs set completed_generation=j.claimed_generation,lease_token=null,lease_expires_at=null,claimed_generation=null,
    claimed_connection_revision=null,last_error_code=null,attempts=0,first_attempt_at=null,next_attempt_at=clock_timestamp(),updated_at=clock_timestamp() where tenant_id=c.tenant_id and id=j.id;
  return v_result;
end $$;
revoke all on function public.import_shopify_draft(jsonb,boolean) from public,anon,authenticated;
grant execute on function public.import_shopify_draft(jsonb,boolean) to service_role;
create or replace function public.recover_shopify_draft(p_input jsonb) returns jsonb
language sql security definer set search_path=public,pg_temp as $$ select public.import_shopify_draft(p_input,true);$$;

alter function public.release_shopify_order(uuid,uuid,text,uuid,uuid,uuid,jsonb,boolean) rename to release_shopify_order_v1;
revoke all on function public.release_shopify_order_v1(uuid,uuid,text,uuid,uuid,uuid,jsonb,boolean) from public,anon,authenticated,service_role;
create function public.release_shopify_order(p_tenant_id uuid,p_connection_id uuid,p_actor_id text,p_request_key uuid,
  p_source_order_id uuid,p_review_id uuid,p_input jsonb,p_recovery_only boolean default false) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_result jsonb;begin
  v_result:=public.release_shopify_order_v1(p_tenant_id,p_connection_id,p_actor_id,p_request_key,p_source_order_id,p_review_id,p_input,p_recovery_only);
  if v_result is not null and not p_recovery_only then
    insert into public.shopify_operational_state(tenant_id,source_order_id,latest_revision_id,accepted_revision_id,held,reasons)
      select r.tenant_id,r.source_order_id,r.source_revision_id,r.source_revision_id,f.meaningful_digest is null,
        case when f.meaningful_digest is null then '["UNVERIFIED_SOURCE_BASELINE"]'::jsonb else '[]'::jsonb end
      from public.shopify_releases r left join public.shopify_revision_facts f on f.tenant_id=r.tenant_id and f.revision_id=r.source_revision_id
      where r.tenant_id=p_tenant_id and r.source_order_id=p_source_order_id on conflict(source_order_id) do nothing;
  end if;return v_result;
end $$;
revoke all on function public.release_shopify_order(uuid,uuid,text,uuid,uuid,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.release_shopify_order(uuid,uuid,text,uuid,uuid,uuid,jsonb,boolean) to service_role;

create function public.review_shopify_change(p_tenant_id uuid,p_connection_id uuid,p_actor_id text,p_request_key uuid,
  p_source_order_id uuid,p_case_id uuid,p_observed_revision_id uuid,p_accepted_revision_id uuid,p_action text,p_reason text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare prior public.shopify_change_decisions%rowtype;st public.shopify_operational_state%rowtype;v_hash text;v_result jsonb;
begin
  if p_request_key is null or p_action is null or p_action not in ('keep_on_hold','keep_os_plus_continue') or length(coalesce(btrim(p_reason),'')) not between 3 and 1000
    then raise exception 'SHOPIFY_COMMAND_INVALID';end if;
  perform pg_advisory_xact_lock(hashtextextended('shopify-change:'||p_tenant_id::text||':'||p_request_key::text,0));
  v_hash:=encode(sha256(convert_to(jsonb_build_array(p_connection_id,p_source_order_id,p_case_id,p_observed_revision_id,p_accepted_revision_id,p_action,p_reason)::text,'UTF8')),'hex');
  select * into prior from public.shopify_change_decisions where tenant_id=p_tenant_id and request_key=p_request_key;
  if found then
    perform public.assert_shopify_receipt_reader(p_tenant_id,p_connection_id,p_actor_id);
    if prior.actor_id<>p_actor_id or prior.intent_digest<>v_hash then raise exception 'SHOPIFY_IDEMPOTENCY_CONFLICT';end if;return prior.result;
  end if;
  perform public.assert_shopify_owner(p_tenant_id,p_connection_id,p_actor_id);
  perform 1 from public.shopify_source_orders where tenant_id=p_tenant_id and connection_id=p_connection_id and id=p_source_order_id for update;
  if not found then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
  select * into st from public.shopify_operational_state where tenant_id=p_tenant_id and source_order_id=p_source_order_id;
  if not found or st.latest_case_id is distinct from p_case_id or st.latest_revision_id is distinct from p_observed_revision_id
    or st.accepted_revision_id is distinct from p_accepted_revision_id then raise exception 'SHOPIFY_STALE_REVISION';end if;
  if p_action='keep_os_plus_continue' and not exists(select 1 from public.shopify_revision_facts f join public.shopify_source_revisions r on r.id=f.revision_id and r.tenant_id=f.tenant_id
    where f.tenant_id=p_tenant_id and f.revision_id=p_observed_revision_id and f.meaningful_digest is not null and r.completeness='complete' and r.sealed_source ? 'ciphertext')
    then raise exception 'SHOPIFY_INCOMPLETE_SOURCE';end if;
  update public.shopify_operational_state set held=p_action='keep_on_hold',
    accepted_revision_id=case when p_action='keep_os_plus_continue' then p_observed_revision_id else accepted_revision_id end,
    reasons=case when p_action='keep_os_plus_continue' then '[]'::jsonb else reasons end where tenant_id=p_tenant_id and source_order_id=p_source_order_id;
  v_result:=jsonb_build_object('status','reviewed','orderId',(select order_id from public.shopify_source_orders where tenant_id=p_tenant_id and id=p_source_order_id),
    'held',p_action='keep_on_hold','caseId',p_case_id,'observedRevisionId',p_observed_revision_id);
  insert into public.shopify_change_decisions(tenant_id,source_order_id,case_id,observed_revision_id,accepted_revision_id,actor_id,request_key,action,reason,intent_digest,result)
    values(p_tenant_id,p_source_order_id,p_case_id,p_observed_revision_id,p_accepted_revision_id,p_actor_id,p_request_key,p_action,p_reason,v_hash,v_result);
  return v_result;
end $$;
revoke all on function public.review_shopify_change(uuid,uuid,text,uuid,uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_shopify_change(uuid,uuid,text,uuid,uuid,uuid,uuid,uuid,text,text) to service_role;

-- A transition takes the same immutable source anchor as ingestion/owner review.
-- NOWAIT prevents historic stage-first/order-first commands deadlocking. An
-- already-running transition may finish before a source event commits; all
-- subsequent transitions must see the durable hold. No lease is an override.
create function public.assert_shopify_production_allowed(p_tenant uuid,p_order uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.shopify_source_orders%rowtype;begin
  select * into s from public.shopify_source_orders where tenant_id=p_tenant and order_id=p_order for share nowait;
  if found and not exists(select 1 from public.shopify_operational_state where tenant_id=p_tenant and source_order_id=s.id and not held) then raise exception 'SHOPIFY_PRODUCTION_HELD';end if;
  if exists(select 1 from public.shopify_source_orders where order_id=p_order and tenant_id<>p_tenant) then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
exception when lock_not_available then raise exception 'SHOPIFY_SOURCE_BUSY';end $$;
revoke all on function public.assert_shopify_production_allowed(uuid,uuid) from public,anon,authenticated;
grant execute on function public.assert_shopify_production_allowed(uuid,uuid) to service_role;

create function public.guard_shopify_production_hold() returns trigger
language plpgsql set search_path=public,pg_temp as $$
declare a jsonb;b jsonb;x jsonb;v_item uuid;v_order uuid;v_tenant uuid;v_is_owner boolean;
begin
  if tg_op<>'DELETE' then a:=to_jsonb(new);end if;if tg_op<>'INSERT' then b:=to_jsonb(old);end if;
  -- The original draft guard already restricts permitted customer/currency/
  -- soft-delete changes. They are not production transitions or a release.
  if tg_table_name='orders' and tg_op='UPDATE' and a->>'order_status'='draft' and b->>'order_status'='draft' then return new;end if;
  if tg_table_name<>'item_history' and tg_op='UPDATE' and (a-array['notes','updated_at','updated_by']) is not distinct from (b-array['notes','updated_at','updated_by']) then return new;end if;
  v_is_owner:=current_user=pg_get_userbyid((select relowner from pg_class where oid='public.orders'::regclass));
  for x in select distinct value from (values(a),(b)) as rows(value) where value is not null loop
    v_tenant:=(x->>'tenant_id')::uuid;
    if tg_table_name='orders' then v_order:=(x->>'id')::uuid;
    elsif tg_table_name='order_items' then v_order:=(x->>'order_id')::uuid;
    else
      v_item:=(x->>'order_item_id')::uuid;
      if v_item is null and x->>'stage_instance_id' is not null then
        select order_item_id into v_item from public.item_stage_instances where tenant_id=v_tenant and id=(x->>'stage_instance_id')::uuid;
      end if;
      select order_id into v_order from public.order_items where tenant_id=v_tenant and id=v_item;
      if v_order is null and exists(select 1 from public.order_items where id=v_item) then raise exception 'SHOPIFY_ACCESS_DENIED';end if;
    end if;
    if v_order is not null then
      if v_is_owner and public.has_shopify_release_capability(v_tenant,v_order) then continue;end if;
      if tg_op='DELETE' and exists(select 1 from public.shopify_source_orders where tenant_id=v_tenant and order_id=v_order) then raise exception 'SHOPIFY_HISTORY_PROTECTED';end if;
      if tg_table_name='item_history' then
        if tg_op='UPDATE' and exists(select 1 from public.shopify_source_orders where tenant_id=v_tenant and order_id=v_order) then raise exception 'SHOPIFY_HISTORY_PROTECTED';end if;
      else perform public.assert_shopify_production_allowed(v_tenant,v_order);end if;
    end if;
  end loop;
  if tg_op='DELETE' then return old;end if;return new;
end $$;
do $$ declare t text;begin
  foreach t in array array['orders','order_items','item_workflow_instances','item_stage_instances','item_stage_work_logs','item_history','item_stage_contribution_corrections','item_stage_contribution_operations'] loop
    if to_regclass('public.'||t) is not null then execute format('create trigger shopify_production_hold before insert or update or delete on public.%I for each row execute function public.guard_shopify_production_hold()',t);end if;
  end loop;
end $$;

-- Operational display is explicitly distinct from local cash/GST/public reads.
-- Drafts are still excluded here; the forthcoming owner inbox uses a separate
-- sanitized projection. Never expand local_operational_orders for this purpose.
create view public.operational_orders with (security_invoker=true) as
  select o.* from public.orders o where (o.source<>'shopify' and o.financial_management='local' and o.order_status<>'draft')
    or (o.source='shopify' and o.financial_management='external_shopify' and o.order_status<>'draft' and o.customer_id is not null and o.delivery_type is not null
      and exists(select 1 from public.shopify_source_orders s join public.shopify_releases r on r.tenant_id=s.tenant_id and r.source_order_id=s.id where s.tenant_id=o.tenant_id and s.order_id=o.id));
create view public.operational_order_items with (security_invoker=true) as
  select i.* from public.order_items i join public.operational_orders o on o.tenant_id=i.tenant_id and o.id=i.order_id where o.deleted_at is null;
revoke all on public.operational_orders,public.operational_order_items from public,anon,authenticated;
grant select on public.operational_orders,public.operational_order_items to service_role;
create view public.shopify_operational_summaries with (security_invoker=true) as
  select s.tenant_id,s.order_id,st.held,st.reasons from public.shopify_source_orders s
    join public.shopify_operational_state st on st.tenant_id=s.tenant_id and st.source_order_id=s.id;
revoke all on public.shopify_operational_summaries from public,anon,authenticated;
grant select on public.shopify_operational_summaries to service_role;

-- Trusted server context supplies the tenant. All list predicates precede the
-- bounded page, so newer local orders cannot hide older held Shopify work.
create function public.list_operational_orders(
  p_tenant_id uuid,p_search text default null,p_source text default null,
  p_status text default null,p_payment text default null,p_view text default 'all',p_limit integer default 50
) returns setof public.orders language sql stable security invoker set search_path=public as $$
  select o.* from public.operational_orders o
  left join public.customers c on c.tenant_id=o.tenant_id and c.id=o.customer_id and c.deleted_at is null
  where o.tenant_id=p_tenant_id and o.deleted_at is null
    and (p_source is null or o.source::text=p_source)
    and (p_status is null or o.order_status::text=p_status)
    and (p_payment is null or (o.source::text<>'shopify' and o.payment_status::text=p_payment))
    and (nullif(btrim(p_search),'') is null or (length(p_search)<=200 and
      strpos(lower(concat_ws(' ',o.order_number,o.reference_order_id,c.name,c.phone)),lower(btrim(p_search)))>0))
    and case coalesce(p_view,'all')
      when 'all' then true
      when 'active' then o.order_status::text not in ('completed','delivered','cancelled')
      when 'due_soon' then o.order_status::text not in ('completed','delivered','cancelled') and
        o.promised_delivery_date between (current_timestamp at time zone 'Asia/Kolkata')::date and (current_timestamp at time zone 'Asia/Kolkata')::date+3
      when 'delayed' then o.order_status::text not in ('completed','delivered','cancelled') and
        o.promised_delivery_date<(current_timestamp at time zone 'Asia/Kolkata')::date
      when 'unpaid' then o.source::text<>'shopify' and o.payment_status::text='unpaid'
      when 'partially_paid' then o.source::text<>'shopify' and o.payment_status::text='partially_paid'
      when 'ready_dispatch' then exists(select 1 from public.order_items i where i.tenant_id=o.tenant_id and i.order_id=o.id and i.deleted_at is null and i.item_status::text in ('completed','ready_for_pickup','ready_for_dispatch','dispatched'))
        and not exists(select 1 from public.order_items i where i.tenant_id=o.tenant_id and i.order_id=o.id and i.deleted_at is null and i.item_status::text='delivered')
      when 'delivered' then o.order_status::text in ('completed','delivered') or exists(select 1 from public.order_items i where i.tenant_id=o.tenant_id and i.order_id=o.id and i.deleted_at is null and i.item_status::text='delivered')
      else false end
  order by o.created_at desc,o.id desc limit greatest(1,least(coalesce(p_limit,50),100));
$$;
revoke all on function public.list_operational_orders(uuid,text,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.list_operational_orders(uuid,text,text,text,text,text,integer) to service_role;
