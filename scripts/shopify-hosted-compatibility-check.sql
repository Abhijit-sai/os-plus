-- SELECT-only. Owner/admin runs this explicitly in the OS PLUS Supabase project.
-- Shared-schema safety: order counts cover ALL tenants, including deleted rows.
-- No customer names, contacts, order IDs, amounts, tokens or secrets returned.
-- Missing prerequisites/nonzero safety counts require diagnosis, NOT cleanup.
-- This is a partial preflight, not approval to apply/deploy/activate or baseline.
SELECT jsonb_build_object(
  'order_safety', (
    SELECT jsonb_build_object(
      'missing_customer_or_delivery', count(*) FILTER (
        WHERE o.customer_id IS NULL OR o.delivery_type IS NULL),
      'invalid_customer_tenant_link', count(*) FILTER (
        WHERE NOT EXISTS (SELECT 1 FROM public.customers c
          WHERE c.id = o.customer_id AND c.tenant_id = o.tenant_id)),
      'existing_new_shopify_source', count(*) FILTER (WHERE o.source::text = 'shopify'),
      'existing_draft_status', count(*) FILTER (WHERE o.order_status::text = 'draft')
    ) FROM public.orders o
  ),
  'missing_prerequisite_tables', (
    SELECT coalesce(jsonb_agg(name ORDER BY name), '[]'::jsonb)
    FROM (VALUES
      ('tenants'), ('tenant_users'), ('tenant_verticals'), ('vertical_definitions'),
      ('customer_addresses'), ('customer_external_identities'), ('customer_statuses'),
      ('item_types'), ('item_type_standard_sizes'), ('workflows'), ('workflow_stages'),
      ('stage_master'), ('order_items'), ('item_workflow_instances'),
      ('item_stage_instances'), ('item_history')
    ) AS required(name)
    WHERE to_regclass('public.' || name) IS NULL
  ),
  'customer_indexes', (
    SELECT coalesce(jsonb_agg(jsonb_build_object('name', indexname, 'definition', indexdef)
      ORDER BY indexname), '[]'::jsonb)
    FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'customers'
  ),
  'set_updated_at_present', to_regprocedure('public.set_updated_at()') IS NOT NULL
) AS result;
