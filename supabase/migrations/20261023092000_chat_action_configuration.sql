begin;
create table chat_channel_action_approvals(
 tenant_id uuid not null references tenants(id) on delete cascade,channel_id uuid not null,version integer not null default 1 check(version>0),
 pack_id uuid,approved_by uuid,approved_at timestamptz,updated_at timestamptz not null default now(),
 primary key(tenant_id,channel_id),foreign key(tenant_id,channel_id) references chat_channels(tenant_id,id),
 foreign key(tenant_id,pack_id) references chat_knowledge_packs(tenant_id,id),foreign key(tenant_id,approved_by) references tenant_users(tenant_id,id),
 check((approved_at is null)=(approved_by is null)),check(approved_at is null or pack_id is not null)
);
alter table chat_channel_action_approvals enable row level security;
revoke all on chat_channel_action_approvals from public,anon,authenticated,service_role;
grant select on chat_channel_action_approvals to service_role;
create function chat_action_configure(p_context jsonb,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid;actor uuid;c chat_channels%rowtype;p chat_knowledge_packs%rowtype;v chat_channel_action_approvals%rowtype;
 key text:=p_context->>'idempotencyKey';h text;receipt command_idempotency%rowtype;result jsonb;
begin
 t:=chat_lead_authorize(p_context);
 select id into actor from tenant_users where tenant_id=t and clerk_user_id=p_context#>>'{actor,id}' and role='owner_admin' and status='active' for share;
 if not found then raise exception 'Owner access required'; end if;
 if key is null or length(key) not between 1 and 160 or p_input->>'mode' is null or p_input->>'mode' not in ('off','draft','auto')
  or jsonb_typeof(p_input->'canBook') is distinct from 'boolean' then raise exception 'Invalid channel action settings'; end if;
 h:=encode(digest(p_input::text,'sha256'),'hex');
 select * into receipt from command_idempotency where tenant_id=t and command_type='CHAT_ACTION_CONFIG' and idempotency_key=key for update;
 if found then if receipt.request_hash<>h or receipt.status<>'completed' then raise exception 'Channel setting conflict'; end if;return receipt.result_json;end if;
 select * into c from chat_channels where tenant_id=t and id=(p_input->>'channelId')::uuid and is_active for update;
 if not found then raise exception 'Channel unavailable'; end if;
 select * into v from chat_channel_action_approvals where tenant_id=t and channel_id=c.id for update;
 if coalesce(v.version,0) is distinct from (p_input->>'version')::integer then raise exception 'Settings changed; reload'; end if;
 select * into p from chat_knowledge_packs where tenant_id=t and brand_id=c.brand_id and status='published' order by version desc limit 1 for share;
 if (p_input->>'canBook')::boolean and (p.id is null or not p.pack_json ? 'booking') then raise exception 'Publish booking knowledge first'; end if;
 if (p_input->>'canBook')::boolean and p.pack_json#>>'{booking,capability}'='laundry_pickup' then perform assert_laundry_vertical_enabled(t);end if;
 if p_input->>'mode'='auto' and (p.id is null or p.id is distinct from (p_input->>'packId')::uuid or p_input->>'approveAuto' is distinct from 'true')
  then raise exception 'Owner must approve the current knowledge version'; end if;
 update chat_channels set agent_mode=p_input->>'mode',can_book=(p_input->>'canBook')::boolean,updated_by=p_context#>>'{actor,id}' where tenant_id=t and id=c.id;
 insert into chat_channel_action_approvals(tenant_id,channel_id,version,pack_id,approved_by,approved_at)
  values(t,c.id,1,case when p_input->>'mode'='auto' then p.id else null end,case when p_input->>'mode'='auto' then actor else null end,case when p_input->>'mode'='auto' then now() else null end)
 on conflict(tenant_id,channel_id) do update set version=chat_channel_action_approvals.version+1,pack_id=excluded.pack_id,approved_by=excluded.approved_by,approved_at=excluded.approved_at,updated_at=now()
 returning * into v;
 if p_input->>'locationId' is not null then
  perform 1 from chat_brand_locations b join tenant_locations l on l.tenant_id=t and l.id=b.location_id and l.is_active and l.deleted_at is null
   where b.tenant_id=t and b.brand_id=c.brand_id and b.location_id=(p_input->>'locationId')::uuid for share of b,l;
  if not found then raise exception 'Choose a mapped active branch';end if;
  if p_input->>'teamId' is not null then
   perform 1 from teams where tenant_id=t and id=(p_input->>'teamId')::uuid and is_active and deleted_at is null for share;
   if not found then raise exception 'Choose an active team';end if;
  end if;
  insert into chat_action_routes(tenant_id,channel_id,location_id,team_id) values(t,c.id,(p_input->>'locationId')::uuid,(p_input->>'teamId')::uuid)
   on conflict(tenant_id,channel_id,location_id) do update set team_id=excluded.team_id,updated_at=now();
 end if;
 result:=jsonb_build_object('id',c.id,'version',v.version);
 insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
 values(t,'chat.channel.actions_configured','chat_channel',c.id,'USER',p_context#>>'{actor,id}','OS_PLUS_UI',p_context->>'correlationId',
  jsonb_build_object('mode',p_input->>'mode','canBook',p_input->'canBook','packId',v.pack_id,'version',v.version));
 insert into command_idempotency(tenant_id,command_type,idempotency_key,request_hash,status,result_json,completed_at)
 values(t,'CHAT_ACTION_CONFIG',key,h,'completed',result,now());return result;
end $$;
revoke all on function chat_action_configure(jsonb,jsonb) from public,anon,authenticated;
grant execute on function chat_action_configure(jsonb,jsonb) to service_role;

create function chat_task_target(p_context jsonb,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid;result jsonb;
begin
 t:=chat_lead_authorize(p_context);
 select jsonb_build_object('workspaceId',w.id,'accountId',w.chatwoot_account_id,'conversationId',v.chatwoot_conversation_id,'inboxId',c.chatwoot_inbox_id) into result
 from leads l join chat_conversations v on v.tenant_id=t and v.id=l.conversation_id
 join chat_channels c on c.tenant_id=t and c.id=l.channel_id and c.is_active
 join chat_workspaces w on w.tenant_id=t and w.id=c.workspace_id and w.status='active'
 where l.tenant_id=t and l.id=(p_input->>'leadId')::uuid;
 if result is null then raise exception 'Task target unavailable';end if;return result;
end $$;
revoke all on function chat_task_target(jsonb,jsonb) from public,anon,authenticated;
grant execute on function chat_task_target(jsonb,jsonb) to service_role;
commit;
