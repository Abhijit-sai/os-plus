-- Read-only verification AFTER separately approved execution of the cleanup.
-- Expect 10 targets, zero invalid definitions, zero PUBLIC/API execution grants.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog;
WITH targets(name) AS (VALUES
  ('guard_shopify_draft_order'), ('guard_shopify_order_child'),
  ('guard_shopify_privacy_activation'), ('guard_shopify_privacy_contact_purge'),
  ('guard_shopify_production_hold'), ('guard_shopify_source_redaction'),
  ('protect_shopify_connection_binding'), ('protect_shopify_draft_audit'),
  ('protect_shopify_intake_audit'), ('touch_shopify_job_request')
), functions AS (
  SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    JOIN targets t ON t.name=p.proname
  WHERE n.nspname='public' AND p.pronargs=0
)
SELECT jsonb_build_object(
  'database', current_database(), 'actor', current_user,
  'read_only', current_setting('transaction_read_only'),
  'targets_found', (SELECT count(*) FROM functions),
  'invalid_definitions', (SELECT count(*) FROM functions WHERE prokind<>'f'
    OR prorettype<>'trigger'::regtype OR prosecdef OR pg_get_userbyid(proowner)<>'postgres'),
  'public_execute_grants', (SELECT count(*) FROM functions p,
    LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE a.grantee=0 AND a.privilege_type='EXECUTE'),
  'api_execute_grants', (SELECT count(*) FROM functions p CROSS JOIN pg_roles r
    WHERE r.rolname IN('anon','authenticated','service_role') AND has_function_privilege(r.oid,p.oid,'EXECUTE'))
) AS cleanup_verification;
ROLLBACK;
