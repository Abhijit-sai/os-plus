-- Read only. Run inside the protected TLS-validated READ ONLY transaction.
SELECT json_build_object(
 'serverVersion',current_setting('server_version'),
 'serverVersionNumber',current_setting('server_version_num'),
 'readOnly',current_setting('transaction_read_only')='on',
 'extensionServiceUsage',has_schema_privilege('service_role','extensions','USAGE'),
 'extensions',(SELECT json_agg(x ORDER BY name) FROM (SELECT e.extname name,n.nspname schema,e.extversion version FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname IN ('pgcrypto','uuid-ossp')) x),
 'chatRelations',(SELECT coalesce(json_agg(c.relname ORDER BY c.relname),'[]'::json) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND (left(c.relname,5)='chat_' OR c.relname IN ('tenant_modules','leads','lead_events'))),
 'chatFunctions',(SELECT coalesce(json_agg(p.proname ORDER BY p.proname),'[]'::json) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND left(p.proname,5)='chat_'),
 'taskConstraints',(SELECT json_agg(x ORDER BY name) FROM (SELECT conname name,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid=to_regclass('public.tasks') AND conname IN ('tasks_task_type_check','tasks_subject_type_check')) x),
 'dependencies',(SELECT json_agg(x ORDER BY table_name,column_name) FROM (SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('tenants','tenant_users','customers','orders','tasks','domain_events')) x)
) AS snapshot;
