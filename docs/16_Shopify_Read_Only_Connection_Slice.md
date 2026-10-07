# Shopify read-only connection slice

Status: owner authorized this diagnostic-only release on 2026-10-07; deployment and live verification are not complete at this entry. Scope is authentication diagnostics only, not order sync.

## Owner-confirmed setup (2026-10-07)

- Store: `n1djr1-99.myshopify.com`, the actual Phantom Threads production Shopify store. Owner confirms app and store are in the same Shopify organization.
- App: OS Plus - Phantom Threads; screenshot shows released active `pilot-v1`, non-embedded, managed install, `read_orders,read_customers,read_products`, webhook version `2026-10`. Owner reports installation completed.
- Owner reports Client ID/secret saved to Vercel Production and a Ready redeployment, with `SHOPIFY_SYNC_ENABLED=false`. No secret values were read or logged here; the production environment values were not independently verified.
- Phantom Threads Test is for validation; Phantom Threads Boutique is the eventual permanent import destination. Other tenants (including Fundra/Fundry) must not receive this store's data by default. Verify exact database IDs before any configuration; do not identify tenants by guessed names.
- Owner intends order-confirmation/delivery WhatsApp communication through the CRM/chat work. Messaging implementation is coordinated separately and remains off in this slice. Shopify marketing fields do not confer messaging consent. Whether SMS is also desired is not resolved.

## Implemented boundary

`POST /api/integrations/shopify/test-connection` accepts only `{}` with JSON content type and the configured same-origin header. It stays behind existing Clerk middleware. It reads fresh canonical linked membership and active tenant rows without claiming email invitations or changing any row. Duplicate linked memberships fail closed. Only owner/admin in the single server-configured diagnostic tenant can proceed; tenant/shop/credentials/query are not browser inputs.

The endpoint exchanges client credentials server-side, caches one memory-only token with a 60-second expiry margin and single-flight renewal, and runs a fixed GraphQL query for shop identity and granted scopes against `2026-10`. It rejects foreign shop identity, missing permissions, HTTP/GraphQL failures, partial data, version mismatch and redirects. Secrets, access tokens, raw upstream errors, customer/order data and shop GIDs are never returned. It does not read customer fields and explicitly reports `protectedCustomerFieldsVerified=false`.

Memory-only tokens are deliberately not a persisted connection. Each cold function instance can reacquire a token. Private encrypted credentials, durable connections, queue leases, audit persistence and cross-instance rate limiting belong to later integration work. The API is not a human-facing Settings button yet.

## Release configuration (owner authorized; not yet applied)

Existing Production-only values: `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_API_VERSION=2026-10`, `SHOPIFY_SYNC_ENABLED=false`.

Additional Production-only configuration for the reviewed diagnostic deployment:

- `SHOPIFY_DEPLOYMENT_ENV=production`
- `SHOPIFY_CONNECTION_TEST_ENABLED=true` (default false; enables diagnostics only)
- `SHOPIFY_CONNECTION_TEST_TENANT_ID=<verified Phantom Threads Test UUID>`
- `SHOPIFY_SHOP_DOMAIN=n1djr1-99.myshopify.com`
- `SHOPIFY_APPLICATION_ORIGIN=https://os-plus.vercel.app`

Do not set these in local/Preview deployments for the real production shop. Production credentials remain in Vercel secrets. `SHOPIFY_SYNC_ENABLED` must explicitly remain false; the diagnostic endpoint rejects requests while sync is true. No migration is needed for this read-only slice. Recheck role and tenant immediately before live verification. Test with an authenticated owner/admin session that has selected Phantom Threads Test. Only POST is implemented; a direct browser GET is not a connection test.

Release preflight resolved exactly one active `Phantom Threads Test` tenant through a read-only exact-name/status lookup; its slug is `phantom-threads`. The verified UUID is recorded in the local deployment handoff, not hardcoded in source. Browser tooling failed twice with a Windows sandbox-helper initialization error, and no existing Vercel CLI authentication is configured. The authorized Git/PR deployment can proceed, but diagnostics remain default-disabled until the additional Production settings and signed-in owner check are completed. No substitute or forged Clerk session may be used.

## Testing and cutover policy

- Current slice: production-shop metadata reads only. Run all automated transport/security checks with synthetic data. No import, order release, customer write, payment, workflow, notification, webhook subscription or scheduler activation occurs.
- Future full-workflow testing: use synthetic fixtures/replay in a disposable isolated harness. Any real Shopify customer/order copying into the Test tenant requires an explicit data-use/retention review and owner authorization. Test tenant messaging must remain disabled; no duplicate confirmations to real customers.
- Recommended eventual arrangement: webhook-first durable receipt/queue, with n8n reconciling missed changes every 30 minutes. The owner's latest message raises this cadence; this slice does not provision jobs or change the old plan's 15-minute schedule.
- One store can have multiple diagnostic/test associations, but the existing approved first-release policy retains one active importing destination at a time. Do not implement automatic fan-out to Test and Boutique. Multi-active-destination imports need a separate explicit decision.
- Cutover needs a reviewed single-active-destination switch, creation cutoff and overlap/recovery plan. Preserve source deduplication and audit history; do not silently migrate/replay test orders, merge customers across tenants, or send historical confirmation messages.
- Eventually enqueue an order-confirmed message only after a complete, accepted order is committed/released, not upon receiving a webhook or creating an incomplete draft. Use tenant-scoped event deduplication, approved templates/channel permissions and accurate delivery-state events. CRM/chat is a dependency owned by the other workstream, not part of this code slice.
- Source commercial facts remain separate from local cash, receivables and GST accounting. No local financial entries or automatic refunds/reversals.

## Outstanding activation gates

Authenticated live token/store/scope test; protected customer-field access; verified store GID; actual tenant IDs and target policy; app distribution evidence if later connecting other merchants; reviewed schema and atomic importer; customer identity and product mappings; finance guards; n8n readiness; messaging rules and consent/template policy; cutover approval. Passing offline tests does not close these gates.

## Validation evidence (2026-10-07)

- Isolated branch `codex/shopify-connection-probe-20261007`, based on released main `c701ec346aeb1fb38a364f4da231bff2a9a0232e`. Changes are uncommitted; the original dirty checkout and other chat checkouts remain untouched.
- The narrowed diagnostic suite passes 47 connection-probe cases. Coverage exercises the actual handler, token/GraphQL transport, membership reader, tenant/role fences, same-origin restrictions, strict browser input, redacted failures, scope/store/version checks, expiry, rotation, single-flight renewal, actual streamed response caps and stalled header/body deadlines. All 29 remaining offline package test scripts pass after review scope reduction. Local/shared database mutation and live smoke scripts were intentionally not run.
- Full lint, TypeScript, optimized Next.js 16.3.8 webpack build (43 routes), and working-tree whitespace checks pass. A reproduced extracted-helper return-type widening error was fixed with an explicit return contract; no dependency changes were needed.
- The existing QA workbook was inspected read-only for role and tenant coverage, not modified. Offline tests are not evidence that the installed Shopify app can read protected customer fields.
- Initial Standards review found no actionable violation. Initial Spec review found dormant future-sync primitives outside the diagnostic scope. Removed the isolated copies of encrypted storage, money reconciliation, webhook HMAC, the general sync entry point and their future configuration; originals remain preserved in `D:\Develop\os-plus`. Extracted only the bounded-body helper and retained relevant transport tests. Corrected stale validation counts after narrowing. Final independent review against the owner-selected `c701ec3` baseline: Standards 0 remaining findings, Spec 0 remaining findings. Standards reviewer independently reran all 47 probe cases and whitespace checks. No deployment, environment changes, migration, live Shopify request, private customer import or business-data mutation occurred.

## Sources

- https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant
- https://shopify.dev/docs/api/admin-graphql/2026-10/queries/shop
- https://shopify.dev/docs/api/admin-graphql/2026-10/queries/currentAppInstallation
- Original full integration plan: `D:\Develop\os-plus\docs_v2\16_Shopify_Order_Sync_Implementation_Plan.md` (preserved unfinished planning, not committed with the last release).
