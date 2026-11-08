# Shopify linking for OS+ tenants

Owners and admins start from Settings → Shopify in the selected business. They
enter the canonical `*.myshopify.com` domain and approve access on Shopify.
OS+ stores an encrypted credential for that tenant and store. Approval by
itself does not import orders or enable automatic sync.

The current Shopify order import and draft workflow uses the boutique vertical.
Connecting a store does not activate that vertical or alter other workflows.

## Release sequence

1. Keep `SHOPIFY_TENANT_LINKING_ENABLED=false`. Verify the existing OAuth
   package is installed and apply
   [the tenant linking SQL](sql/20261108190000_shopify_tenant_linking.proposed.sql)
   before deploying the matching application code. The migration installs no
   shops and changes no tenant or order data. The deployed privacy and
   uninstall handlers use the new functions even before rollout starts.
2. Confirm the Shopify app can be installed by the intended merchants, has the
   necessary protected customer data access and API version, and has the OS+
   callback and privacy URLs configured. For unrelated Shopify merchants, use
   [public distribution](https://shopify.dev/docs/apps/launch/distribution/select-distribution-method)
   and verify installation eligibility before opening OS+ to all tenants.
   Use the platform's existing app credentials and encryption key rings. Never
   put a tenant's token into Vercel or repoint the legacy Test tenant/shop values.
3. Set `SHOPIFY_TENANT_LINKING_PILOT_TENANT_ID` to the approved pilot and enable
   `SHOPIFY_TENANT_LINKING_ENABLED` on the Production deployment. The screen,
   OAuth and unified order flags must also be enabled. Leave automatic sync off
   on the pilot connection while verifying authorization and preview.
4. In the pilot business, connect, confirm retention, and preview a narrow date
   range. Check that the shop and orders match the business. Approve one draft
   import separately; repeat the preview to verify it will not import twice.
5. Before enabling automatic sync per business, confirm that the authenticated
   scheduled worker is running often enough for the number of connected stores.
   Each invocation rotates through one eligible connection and performs bounded
   cleanup/processing. Keep the binding portion of the Shopify webhook URL out
   of logs and screenshots. Test a genuine signed event and confirm it reaches
   only the intended business. With tenant linking enabled, unscoped order
   webhook URLs are rejected; any enabled legacy subscriptions must be
   reconciled with the Owner/Admin setup before relying on delivery.
6. Clear `SHOPIFY_TENANT_LINKING_PILOT_TENANT_ID` after hosted acceptance to open
   onboarding for other eligible Owner/Admin accounts. Each store still needs
   its own Shopify authorization and explicit import consent.

## Phantom Threads same-store pilot

Read-only production inspection on 8 November 2026 found the verified
connection under Phantom Threads Test, with 15 retained Shopify source orders,
no active leases and automatic sync off. Phantom Threads had no connection.
The existing one-store/one-tenant reservation stays in place even after
disconnecting. A disconnect or uninstall alone cannot free the store.

1. Keep the Shopify app installed on the shared store. Apply the schema and
   deploy the matching code before transferring the reservation. Verify the
   production privacy and uninstall routes are enabled for this app. Keep the
   legacy connection probe disabled. Set the
   tenant linking pilot selector to Phantom Threads and keep broader onboarding
   restricted during the pilot.
2. Recheck the exact source connection ID and revision, the destination tenant,
   automatic sync, queued jobs, leases and privacy holds. While signed in as a
   database operator, run `transfer_shopify_store(source_tenant_id,
   source_connection_id, expected_revision, destination_tenant_id, request_key)`
   after approval. Supply a fresh UUID as the request key and reuse it on retry.
   This archives Test's connection, removes its stored OAuth credential and
   creates a fresh, pending connection reserved to Phantom Threads in one
   transaction. Test's imported records and audit history stay with Test.
3. Sign in to Phantom Threads and open Settings → Shopify. Approve the reserved
   shop on Shopify. After consent and access verification, preview a narrow date
   range and confirm the results belong to the store. Approve a single eligible
   draft import separately. If there is no eligible order, record preview
   acceptance and wait for a natural order.
4. Test order webhook delivery only after automatic sync is explicitly approved.
   The setup can adopt an exact prior OS+ order subscription identified by the
   transfer audit. The retired URL cannot queue into either business. Shopify
   compliance requests for the same installation still record separate receipts
   against the connections that held data. Uninstall applies to the current
   connection. Shopify documents these as separate event topics.
   [Shopify compliance webhooks](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)
5. If authorization fails, retry in Phantom Threads against the pending
   reservation. Keep the compatible application code and database functions
   deployed after the transfer. To pause new onboarding, disable the rollout
   flag. Returning store access to Test requires a separately reviewed recovery
   because the old token and worker access have been retired.
