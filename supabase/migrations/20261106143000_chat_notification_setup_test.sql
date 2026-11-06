-- Owner-only, audited setup test through the existing durable notification outbox.
-- No customer/conversation/lead is created and no historical row is changed.
BEGIN;
CREATE FUNCTION public.chat_notification_queue_test(p_context jsonb,p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 t uuid; actor text:=p_context#>>'{actor,id}'; key text:=p_context->>'idempotencyKey';
 h text; prior command_idempotency%rowtype; target chat_notification_targets%rowtype;
 settings chat_settings%rowtype; delivery_id uuid; result jsonb;
BEGIN
 t:=chat_lead_authorize(p_context);
 PERFORM 1 FROM tenant_users WHERE tenant_id=t AND clerk_user_id=actor AND role='owner_admin' AND status='active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Owner access required'; END IF;
 IF key IS NULL OR length(key) NOT BETWEEN 1 AND 160 OR jsonb_typeof(p_input) IS DISTINCT FROM 'object'
  OR (p_input-ARRAY['id','version'])<>'{}'::jsonb OR p_input->>'id' IS NULL OR p_input->>'version' IS NULL
 THEN RAISE EXCEPTION 'Invalid setup test'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('chat-config:'||t::text,0));
 h:=encode(digest(jsonb_build_object('input',p_input,'actor',actor,'source',p_context->>'source')::text,'sha256'),'hex');
 SELECT * INTO prior FROM command_idempotency WHERE tenant_id=t AND command_type='CHAT_NOTIFICATION_TEST' AND idempotency_key=key;
 IF FOUND THEN
  IF prior.request_hash<>h OR prior.status<>'completed' THEN RAISE EXCEPTION 'Setup test command conflict'; END IF;
  RETURN prior.result_json;
 END IF;
 SELECT * INTO settings FROM chat_settings WHERE tenant_id=t FOR UPDATE;
 IF NOT FOUND OR NOT settings.notifications_enabled THEN RAISE EXCEPTION 'Enable business notifications first'; END IF;
 SELECT * INTO target FROM chat_notification_targets WHERE tenant_id=t AND id=(p_input->>'id')::uuid FOR UPDATE;
 IF NOT FOUND OR target.version IS DISTINCT FROM (p_input->>'version')::integer THEN RAISE EXCEPTION 'Destination changed; reload'; END IF;
 IF NOT target.is_active OR target.confirmed_at IS NULL OR target.linked_at IS NULL OR target.recipient_enc IS NULL
  OR target.recipient_kind IS DISTINCT FROM 'private' OR NOT ('new_lead'=ANY(target.events))
 THEN RAISE EXCEPTION 'Enable a confirmed private destination with new enquiry alerts first'; END IF;
 IF EXISTS(SELECT 1 FROM chat_notification_outbox WHERE tenant_id=t AND target_id=target.id
  AND source_key LIKE 'setup-test:%' AND state IN('queued','sending','uncertain'))
 THEN RAISE EXCEPTION 'A setup test has an unresolved delivery; review its receipt'; END IF;
 IF EXISTS(SELECT 1 FROM chat_notification_outbox WHERE tenant_id=t AND target_id=target.id
  AND source_key LIKE 'setup-test:%' AND created_at>now()-interval '15 minutes')
 THEN RAISE EXCEPTION 'A setup test was already queued; check its receipt before trying again'; END IF;
 INSERT INTO chat_notification_outbox(tenant_id,target_id,target_version,settings_version,kind,source_key,payload_json)
 VALUES(t,target.id,target.version,settings.notification_version,'new_lead','setup-test:'||key,
  jsonb_build_object('kind','new_lead','brand','OS PLUS Telegram setup test - no customer action required','leadId',NULL)) RETURNING id INTO delivery_id;
 result:=jsonb_build_object('id',delivery_id,'version',target.version);
 INSERT INTO domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json)
 VALUES(t,'chat.notification.setup_test_queued','chat_notification_outbox',delivery_id,'USER',actor,'OS_PLUS_UI',p_context->>'correlationId',jsonb_build_object('targetId',target.id));
 INSERT INTO command_idempotency(tenant_id,command_type,idempotency_key,request_hash,status,result_json,completed_at)
 VALUES(t,'CHAT_NOTIFICATION_TEST',key,h,'completed',result,now());
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.chat_notification_queue_test(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.chat_notification_queue_test(jsonb,jsonb) TO service_role;
-- Add only a safe test marker to the existing owner DTO; never expose source keys or payloads.
DO $read_marker$
DECLARE definition text; old_json text := $a$'kind',x.kind,'status',x.state$a$;
 old_select text := $b$select o.id,n.label,o.kind,o.state,o.created_at,o.sent_at from chat_notification_outbox o$b$;
BEGIN
 definition:=replace(pg_get_functiondef('public.chat_notification_read(jsonb)'::regprocedure),chr(13),'');
 IF length(definition)-length(replace(definition,old_json,''))<>length(old_json)
  OR length(definition)-length(replace(definition,old_select,''))<>length(old_select)
 THEN RAISE EXCEPTION 'Notification read definition changed; review setup marker'; END IF;
 definition:=replace(definition,old_json,$c$'kind',x.kind,'isSetupTest',x.is_setup_test,'status',x.state$c$);
 definition:=replace(definition,old_select,$d$select o.id,n.label,o.kind,o.state,o.created_at,o.sent_at,(o.source_key like 'setup-test:%') as is_setup_test from chat_notification_outbox o$d$);
 EXECUTE definition;
END $read_marker$;
COMMIT;
