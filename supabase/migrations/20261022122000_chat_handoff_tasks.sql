begin;
create table public.chat_action_routes (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants(id) on delete cascade,
 channel_id uuid not null,location_id uuid not null,team_id uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,channel_id,location_id),
 foreign key(tenant_id,channel_id) references chat_channels(tenant_id,id),
 foreign key(tenant_id,location_id) references tenant_locations(tenant_id,id),
 foreign key(tenant_id,team_id) references teams(tenant_id,id)
);
create table public.chat_task_records (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants(id) on delete cascade,
 lead_id uuid not null,task_id uuid not null,work_kind text not null check(work_kind in ('CHAT_HANDOFF','LEAD_FOLLOW_UP')),
 version integer not null default 1 check(version>0),
 route_source text not null check(route_source in ('chatwoot','lead','team','unassigned')),
 created_at timestamptz not null default now(),closed_at timestamptz,
 unique(tenant_id,id),unique(tenant_id,task_id),
 foreign key(tenant_id,lead_id) references leads(tenant_id,id),foreign key(tenant_id,task_id) references tasks(tenant_id,id)
);
create unique index chat_task_one_active on chat_task_records(tenant_id,lead_id,work_kind) where closed_at is null;
create table public.chat_task_reasons (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants(id) on delete cascade,
 record_id uuid not null,message_id uuid not null,
 reason text not null check(reason in ('complaint','payment_claim','dues','unreadable','operational_change','staff_requested')),
 created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,record_id,message_id,reason),
 foreign key(tenant_id,record_id) references chat_task_records(tenant_id,id),
 foreign key(tenant_id,message_id) references chat_messages(tenant_id,id)
);
create trigger chat_task_reasons_append_only before update or delete on chat_task_reasons for each row execute function prevent_domain_event_mutation();
do $$ declare tbl text; begin
 foreach tbl in array array['chat_action_routes','chat_task_records','chat_task_reasons'] loop
  execute format('alter table %I enable row level security',tbl);
  execute format('revoke all on %I from public,anon,authenticated,service_role',tbl);
  execute format('grant select on %I to service_role',tbl);
 end loop;
end $$;

-- Internal only: callers must hold the tenant configuration lock and authorize the actor.
-- Remote assignment is an observed provider ID, never permission or a submitted tenant/user ID.
create function public.chat_handoff_upsert(ctx jsonb,lid uuid,mid uuid,why text,assignee bigint) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid:=(ctx->>'tenantId')::uuid;l leads%rowtype;rec chat_task_records%rowtype;
 user_target uuid;team_target uuid;route text:='unassigned';created jsonb;changed boolean:=false;
begin
 if why is null or why not in ('complaint','payment_claim','dues','unreadable','operational_change','staff_requested') then raise exception 'Unsupported handoff reason'; end if;
 select * into l from leads where tenant_id=t and id=lid for update;
 if not found then raise exception 'Enquiry unavailable'; end if;
 perform 1 from chat_messages where tenant_id=t and conversation_id=l.conversation_id and id=mid and author='customer' and not private;
 if not found then raise exception 'Handoff evidence unavailable'; end if;
 -- Tasks completed elsewhere do not leave the Chat queue permanently fenced.
 update chat_task_records r set closed_at=now() from tasks task
 where r.tenant_id=t and r.lead_id=lid and r.task_id=task.id and task.tenant_id=t and r.closed_at is null and task.status in ('COMPLETED','CANCELLED');
 select * into rec from chat_task_records where tenant_id=t and lead_id=lid and work_kind='CHAT_HANDOFF' and closed_at is null for update;
 if not found then
  select u.id into user_target from chat_staff_links link join tenant_users u on u.tenant_id=t and u.id=link.tenant_user_id
   where link.tenant_id=t and link.chatwoot_user_id=assignee and u.status='active' and u.role in ('owner_admin','manager') for share of u,link;
  if user_target is not null then route:='chatwoot';
  else
   select id into user_target from tenant_users where tenant_id=t and id=l.owner_tenant_user_id and status='active' and role in ('owner_admin','manager') for share;
   if user_target is not null then route:='lead';
   else
    select team.id into team_target from chat_action_routes r join teams team on team.tenant_id=t and team.id=r.team_id
     join chat_brand_locations mapping on mapping.tenant_id=t and mapping.brand_id=l.brand_id and mapping.location_id=r.location_id
     join tenant_locations location on location.tenant_id=t and location.id=r.location_id and location.is_active and location.deleted_at is null
     where r.tenant_id=t and r.channel_id=l.channel_id and r.location_id=l.location_id and team.is_active and team.deleted_at is null
     for share of team,r,mapping,location;
    if team_target is not null then route:='team'; end if;
   end if;
  end if;
  created:=create_task_command(t,ctx#>>'{actor,type}',ctx#>>'{actor,id}',ctx->>'source',ctx->>'correlationId',
   'chat-handoff:'||gen_random_uuid()::text,'CHAT_HANDOFF','Review customer enquiry','Open the linked enquiry to review the conversation and reasons.',
   'lead',lid,user_target,team_target,'HIGH');
  insert into chat_task_records(tenant_id,lead_id,task_id,work_kind,route_source)
   values(t,lid,(created->>'task_id')::uuid,'CHAT_HANDOFF',route) returning * into rec;
  changed:=true;
 end if;
 insert into chat_task_reasons(tenant_id,record_id,message_id,reason) values(t,rec.id,mid,why) on conflict do nothing;
 if found then
  changed:=true;
  update chat_task_records set version=version+1 where tenant_id=t and id=rec.id returning * into rec;
 end if;
 if not l.handoff then update leads set handoff=true,version=version+1,updated_by=ctx#>>'{actor,id}' where tenant_id=t and id=lid; end if;
 if changed then perform chat_lead_event(ctx,lid,'handoff.recorded',jsonb_build_object('taskId',rec.task_id,'reason',why,'messageId',mid,'route',rec.route_source)); end if;
 return jsonb_build_object('id',rec.id,'taskId',rec.task_id,'route',rec.route_source,'version',rec.version);
end $$;
revoke all on function public.chat_handoff_upsert(jsonb,uuid,uuid,text,bigint) from public,anon,authenticated,service_role;

create function public.chat_task_command(p_context jsonb,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid;key text:=p_context->>'idempotencyKey';h text;receipt command_idempotency%rowtype;result jsonb;rec chat_task_records%rowtype;task tasks%rowtype;target_user uuid;target_team uuid;
begin
 t:=chat_lead_authorize(p_context);
 if key is null or length(key) not between 1 and 160 or (p_action is null or p_action not in ('handoff','assign','complete')) or jsonb_typeof(p_input) is distinct from 'object' then raise exception 'Invalid task action'; end if;
 -- Provider routing is a server observation, not part of the caller's stable retry identity.
 h:=encode(digest(p_action||(p_input-'assigneeChatwootId')::text,'sha256'),'hex');
 select * into receipt from command_idempotency where tenant_id=t and command_type='CHAT_TASK' and idempotency_key=key for update;
 if found then
  if receipt.request_hash<>h or receipt.status<>'completed' then raise exception 'Chat task conflict'; end if;
  return receipt.result_json;
 end if;
 if p_action='handoff' then
  result:=chat_handoff_upsert(p_context,(p_input->>'leadId')::uuid,(p_input->>'messageId')::uuid,p_input->>'reason',(p_input->>'assigneeChatwootId')::bigint);
 else
  select * into rec from chat_task_records where tenant_id=t and id=(p_input->>'id')::uuid and closed_at is null for update;
  if not found or rec.version is distinct from (p_input->>'version')::integer then raise exception 'Task changed; reload'; end if;
  select * into task from tasks where tenant_id=t and id=rec.task_id and deleted_at is null for update;
  if not found or task.task_type<>rec.work_kind or task.subject_type<>'lead' or task.subject_id<>rec.lead_id
   or task.status in ('COMPLETED','CANCELLED') then raise exception 'Task changed; reload'; end if;
  if p_action='assign' then
   target_user:=(p_input->>'userId')::uuid;target_team:=(p_input->>'teamId')::uuid;
   if (target_user is null)=(target_team is null) then raise exception 'Choose one eligible assignment'; end if;
   if target_user is not null then
    perform 1 from tenant_users where tenant_id=t and id=target_user and status='active' and role in ('owner_admin','manager') for share;
    if not found then raise exception 'Choose an eligible team member'; end if;
   end if;
   if target_team is not null then
    perform 1 from teams where tenant_id=t and id=target_team and is_active and deleted_at is null for share;
    if not found then raise exception 'Choose an eligible team'; end if;
   end if;
   perform assign_task_command(t,'USER',p_context#>>'{actor,id}','OS_PLUS_UI',p_context->>'correlationId','chat-task:'||h,task.id,target_user,target_team);
   update chat_task_records set version=version+1 where tenant_id=t and id=rec.id returning * into rec;
  else
   perform complete_task_command(t,'USER',p_context#>>'{actor,id}','OS_PLUS_UI',p_context->>'correlationId','chat-task:'||h,task.id);
   update chat_task_records set version=version+1,closed_at=now() where tenant_id=t and id=rec.id returning * into rec;
   if rec.work_kind='CHAT_HANDOFF' and not exists(select 1 from chat_task_records where tenant_id=t and lead_id=rec.lead_id and work_kind='CHAT_HANDOFF' and closed_at is null) then
    update leads set handoff=false,version=version+1,updated_by=p_context#>>'{actor,id}' where tenant_id=t and id=rec.lead_id;
   end if;
  end if;
  perform chat_lead_event(p_context,rec.lead_id,'task.'||p_action,jsonb_build_object('taskId',task.id));
  result:=jsonb_build_object('id',rec.id,'taskId',task.id,'route',rec.route_source,'version',rec.version);
 end if;
 insert into command_idempotency(tenant_id,command_type,idempotency_key,request_hash,status,result_json,completed_at)
 values(t,'CHAT_TASK',key,h,'completed',result,now());
 return result;
end $$;
revoke all on function public.chat_task_command(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.chat_task_command(jsonb,text,jsonb) to service_role;
commit;
