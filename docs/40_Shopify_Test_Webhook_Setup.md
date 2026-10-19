# Test-only Shopify webhook setup

## Scope

This release adds owner-only backend commands to register and verify the three
order subscriptions (create, updated, cancelled), using existing server-side
Vercel Shopify credentials. No new environment variables or SQL migration.
It uses the existing configured Test tenant, verified store/app binding and
unexpired exact-one-order authorization. It does not enable all-store ingestion,
extend retention, change the production tenant, edit Shopify orders, send
messages, post local payments, or alter Chat/CRM.

The source store is a real Shopify store: registering subscriptions changes its
app notification configuration only. Each subscription filters to the approved
order ID and includes only id, admin_graphql_api_id and updated_at. Setup checks
app/store identity and app webhook API version before creating subscriptions.
Existing conflicting subscriptions are not updated/deleted. Only missing ones
are created, and a final query verifies all three. Retry after partial success
lists first. Concurrent setup in different sessions is not guaranteed to create
exactly one subscription; any detected duplicate fails closed for owner review.
Shopify's query lists API-created shop-scoped subscriptions, not TOML app-scoped
subscriptions. Do not add a parallel TOML subscription for this pilot.

## Exact operator steps after deployment

1. Sign in as owner/admin, select **Phantom Threads Test**, then refresh
   **Settings → Shopify** and open **Setup**.
2. Under **Automatic order notifications**, click **Register Test webhooks**.
   Wait for “All three order webhook subscriptions verified…”.
3. Click **Test signed delivery** once. The server sends a synthetic signed
   notification for the approved existing order, then replays that same delivery.
   No new Shopify order is created or edited. Receipt success is not import
   success and is not proof that Shopify itself delivered an event.
4. Wait briefly, refresh, then open **Health & privacy**. The approved order's
   **Job health** should say **Up to date**. If it stays Pending/Needs attention,
   report the displayed error; do not claim successful automatic completion or
   manually process it to disguise that failure.
5. Open **Order inbox → Order details**. Confirm one existing imported order,
   customer/items/quantities and Shopify payment facts. No mapping/review/release
   is required. A replay must not create a second order or payment.

Disabled buttons with an expired policy mean approval has expired, not that
setup should be bypassed. Stop and request a retention decision. Existing
approval is not renewed by this release. A genuine Shopify event must still be
observed separately, without editing a production order just to provoke it.

## Verification and deployment boundaries

- `npm run test:shopify-webhooks`: 14 server/SQL + 9 rendered UI checks passed.
  The SQL fixture runs actual services and migrations in an isolated fictional
  PGlite database, with synthetic Shopify HTTP. It proves one order after replay,
  completed work, source payment facts, no mapping/release/production/payment
  rows, and rejection of revoked/manager access.
- `npm run test:shopify-automatic-orders`: 15 server/SQL + 11 UI checks passed.
- Probe suite: 66 passed; role, owner-workspace, client/server and order-reader
  boundaries passed. Typecheck, lint and optimized Webpack build passed.
- Public hosted unsigned probe returned 401 ACCESS_DENIED: intake is enabled and
  rejects unsigned requests. This is not authenticated hosted acceptance.
- Actual registration and signed test require the signed-in owner's explicit
  actions above. No browser/Vercel session credentials are extracted. Neither
  registration nor hosted end-to-end success is claimed before these actions.

Rollback: revert this application commit through the normal Git deployment.
Already-created Shopify subscriptions persist; do not delete them blindly.
Pause the Test connection to stop processing, and review exact subscription IDs
before a separately authorized cleanup. No database restore is necessary.

## Primary references

- https://shopify.dev/docs/api/admin-graphql/latest/mutations/webhookSubscriptionCreate
- https://shopify.dev/docs/api/admin-graphql/latest/queries/webhookSubscriptions
- https://shopify.dev/docs/apps/build/webhooks/delivery-filtering
