begin;
-- This endpoint deliberately requires manage access. Configurable read-only Leads access
-- does not expose addresses, request evidence or operational task controls.
create function public.chat_action_read(p_context jsonb,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid;l uuid:=(p_input->>'leadId')::uuid;requests jsonb;work jsonb;
begin
 t:=chat_lead_authorize(p_context);
 perform 1 from leads where tenant_id=t and id=l;
 if not found then raise exception 'Enquiry unavailable'; end if;
 select coalesce(jsonb_agg(row.item order by row.created_at desc,row.id desc),'[]') into requests from (
  select r.id,r.created_at,jsonb_build_object('id',r.id,'leadId',r.lead_id,'capability',r.capability,'status',r.status,
   'details',r.details_json,'version',r.version,'revision',r.revision,'confirmedRevision',r.confirmed_revision,
   'sourceMessageId',r.source_message_id,'evidence',r.evidence,'taskId',r.task_id,'pickupId',r.pickup_id,
   'createdAt',r.created_at,'updatedAt',r.updated_at,'reviewText',r.review_text) item
  from chat_action_requests r where r.tenant_id=t and r.lead_id=l order by r.created_at desc,r.id desc limit 50
 ) row;
 select coalesce(jsonb_agg(row.item order by row.created_at desc,row.id desc),'[]') into work from (
  select r.id,r.created_at,jsonb_build_object('id',r.id,'taskId',r.task_id,'version',r.version,'kind',r.work_kind,
   'route',r.route_source,'status',task.status,'assignedUserId',task.assigned_user_id,'assignedTeamId',task.assigned_team_id,
   'closedAt',r.closed_at,'reasonCount',(select count(*) from chat_task_reasons where tenant_id=t and record_id=r.id),
   'reasons',coalesce((select jsonb_agg(jsonb_build_object('reason',why.reason,'messageId',why.message_id)
    order by why.created_at desc,why.id desc) from (select * from chat_task_reasons where tenant_id=t and record_id=r.id order by created_at desc,id desc limit 50) why),'[]')) item
  from chat_task_records r join tasks task on task.tenant_id=t and task.id=r.task_id and task.deleted_at is null
  where r.tenant_id=t and r.lead_id=l order by r.created_at desc,r.id desc limit 50
 ) row;
 return jsonb_build_object('deliveries',chat_supplemental_read(t,l),'requests',requests,'tasks',work,
  'messages',coalesce((select jsonb_agg(jsonb_build_object('id',message.id,'content',message.content,'created_at',message.created_at) order by message.created_at desc,message.id desc)
   from (select m.* from chat_messages m join leads lead on lead.tenant_id=t and lead.conversation_id=m.conversation_id and lead.id=l
    where m.tenant_id=t and m.author='customer' and not m.private order by m.created_at desc,m.id desc limit 50) message),'[]'),
  'totalRequests',(select count(*) from chat_action_requests where tenant_id=t and lead_id=l),
  'totalTasks',(select count(*) from chat_task_records r join tasks task on task.tenant_id=t and task.id=r.task_id and task.deleted_at is null where r.tenant_id=t and r.lead_id=l));
end $$;
revoke all on function public.chat_action_read(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.chat_action_read(jsonb,jsonb) to service_role;
commit;
