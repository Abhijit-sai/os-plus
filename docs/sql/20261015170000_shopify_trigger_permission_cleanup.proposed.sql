-- PROPOSED ONLY. Requires separate owner approval before shared execution.
-- Follow-up to the twelve already-applied Shopify files. Do not replay them.
-- Only ten invoker, zero-argument trigger helper EXECUTE ACLs may change.
-- No table data, function body, trigger, ownership or default privileges change.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';
SET LOCAL idle_in_transaction_session_timeout = '60s';
SET LOCAL search_path = pg_catalog;

DO $preflight$
DECLARE
  target text;
  names constant text[] := ARRAY[
    'guard_shopify_draft_order', 'guard_shopify_order_child',
    'guard_shopify_privacy_activation', 'guard_shopify_privacy_contact_purge',
    'guard_shopify_production_hold', 'guard_shopify_source_redaction',
    'protect_shopify_connection_binding', 'protect_shopify_draft_audit',
    'protect_shopify_intake_audit', 'touch_shopify_job_request'
  ];
BEGIN
  IF current_user <> 'postgres' OR current_database() <> 'postgres' THEN
    RAISE EXCEPTION 'SHOPIFY_TRIGGER_CLEANUP_WRONG_CONTEXT';
  END IF;
  FOREACH target IN ARRAY names LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = target AND p.pronargs = 0
        AND p.prokind = 'f' AND p.prorettype = 'trigger'::regtype
        AND NOT p.prosecdef AND pg_get_userbyid(p.proowner) = 'postgres'
    ) THEN
      RAISE EXCEPTION 'SHOPIFY_TRIGGER_CLEANUP_TARGET_MISMATCH';
    END IF;
  END LOOP;
END
$preflight$;

REVOKE EXECUTE ON FUNCTION
  public.guard_shopify_draft_order(),
  public.guard_shopify_order_child(),
  public.guard_shopify_privacy_activation(),
  public.guard_shopify_privacy_contact_purge(),
  public.guard_shopify_production_hold(),
  public.guard_shopify_source_redaction(),
  public.protect_shopify_connection_binding(),
  public.protect_shopify_draft_audit(),
  public.protect_shopify_intake_audit(),
  public.touch_shopify_job_request()
FROM PUBLIC, anon, authenticated, service_role;

DO $postflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      CROSS JOIN pg_roles r
    WHERE n.nspname = 'public' AND p.pronargs = 0
      AND p.proname = ANY (ARRAY[
        'guard_shopify_draft_order', 'guard_shopify_order_child',
        'guard_shopify_privacy_activation', 'guard_shopify_privacy_contact_purge',
        'guard_shopify_production_hold', 'guard_shopify_source_redaction',
        'protect_shopify_connection_binding', 'protect_shopify_draft_audit',
        'protect_shopify_intake_audit', 'touch_shopify_job_request'
      ])
      AND r.rolname IN ('anon', 'authenticated', 'service_role')
      AND has_function_privilege(r.oid, p.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'SHOPIFY_TRIGGER_CLEANUP_ACCESS_REMAINS';
  END IF;
END
$postflight$;
COMMIT;
