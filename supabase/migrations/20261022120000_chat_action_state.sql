-- CH-6 request-first records. No existing platform table is altered.
begin;
create table public.chat_action_requests (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
 lead_id uuid not null, contact_id uuid not null, brand_id uuid not null, channel_id uuid not null,
 conversation_id uuid not null, source_message_id uuid not null,
 capability text not null check(capability in ('follow_up_task','laundry_pickup')),
 status text not null default 'requested' check(status in ('requested','customer_confirmed','materialized','withdrawn')),
 details_json jsonb not null check(jsonb_typeof(details_json)='object' and octet_length(details_json::text)<=20000),
 evidence text not null check(length(btrim(evidence)) between 1 and 2000),
 dedup_hash text not null check(dedup_hash ~ '^[a-f0-9]{64}$'),
 version integer not null default 1 check(version>0), revision integer not null default 1 check(revision>0),
 confirmed_revision integer, confirmation_message_id uuid, summary_message_id uuid,
 review_text text check(length(review_text)<=6000),review_pack_id uuid,review_revision integer,review_prepared_at timestamptz,
 task_id uuid, pickup_id uuid, customer_id uuid,
 approved_by uuid, approved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by text not null, updated_by text not null,
 unique(tenant_id,id),
 foreign key(tenant_id,lead_id) references public.leads(tenant_id,id),
 foreign key(tenant_id,contact_id) references public.chat_contacts(tenant_id,id),
 foreign key(tenant_id,brand_id) references public.chat_brands(tenant_id,id),
 foreign key(tenant_id,channel_id) references public.chat_channels(tenant_id,id),
 foreign key(tenant_id,conversation_id) references public.chat_conversations(tenant_id,id),
 foreign key(tenant_id,conversation_id,source_message_id) references public.chat_messages(tenant_id,conversation_id,id),
 foreign key(tenant_id,conversation_id,confirmation_message_id) references public.chat_messages(tenant_id,conversation_id,id),
 foreign key(tenant_id,conversation_id,summary_message_id) references public.chat_messages(tenant_id,conversation_id,id),
 foreign key(tenant_id,task_id) references public.tasks(tenant_id,id),
 foreign key(tenant_id,pickup_id) references public.laundry_pickup_requests(tenant_id,id),
 foreign key(tenant_id,customer_id) references public.customers(tenant_id,id),
 foreign key(tenant_id,review_pack_id) references public.chat_knowledge_packs(tenant_id,id),
 foreign key(tenant_id,approved_by) references public.tenant_users(tenant_id,id),
 check((confirmed_revision is null)=(confirmation_message_id is null)),
 check(confirmed_revision is null or confirmed_revision=revision),
 check((status in ('customer_confirmed','materialized'))=(confirmed_revision is not null)),
 check((status='materialized')=(approved_at is not null and approved_by is not null)),
 check(status<>'materialized' or
  (capability='follow_up_task' and task_id is not null and pickup_id is null) or
  (capability='laundry_pickup' and pickup_id is not null and customer_id is not null))
);
create index chat_action_requests_recent on public.chat_action_requests(tenant_id,brand_id,contact_id,dedup_hash,created_at desc);
create index chat_action_requests_lead on public.chat_action_requests(tenant_id,lead_id,created_at desc);
alter table public.chat_action_requests enable row level security;
revoke all on public.chat_action_requests from public,anon,authenticated,service_role;
grant select on public.chat_action_requests to service_role;
create trigger chat_action_requests_updated before update on public.chat_action_requests for each row execute function public.set_updated_at();
commit;
