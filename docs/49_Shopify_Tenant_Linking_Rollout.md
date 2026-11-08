# Shopify linking for OS+ tenants

Owners and admins start from Settings → Shopify in the selected business. They
enter the canonical `*.myshopify.com` domain and approve access on Shopify.
OS+ stores an encrypted credential for that tenant and store. Approval by
itself does not import orders or enable automatic sync.

The current Shopify order import and draft workflow uses the boutique vertical.
Connecting a store does not activate that vertical or alter other workflows.

## Release sequence

1. Keep `SHOPIFY_TENANT_LINKING_ENABLED=false` during deployment. Verify the
   existing OAuth SQL package is installed, then apply
   [the tenant linking SQL](sql/20261108190000_shopify_tenant_linking.proposed.sql)
   after explicit production approval. The SQL installs no shops and changes no
   tenant or order data. On rollback keep the SQL and disable the new flag.
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

Leave the Test binding in place pending a separately reviewed cutover. Review
the disposition of the 15 Test records and their privacy requests; preserve
their tenant ownership and audit history. Plan how to retire the old connection,
credentials and subscriptions and continue handling privacy events for data
retained in Test before reserving the shop for Phantom Threads. A new
authorization and a read-only import preview must happen in Phantom Threads
before any live import. Do not test the shared production shop by changing a
global store domain, assigning Test rows to Phantom Threads, or connecting both
businesses at the same time.

The local tests use fictional Phantom/Test and unrelated-store fixtures. They
exercise the shared-shop refusal, owner-only installation, store-bound token
reads, background work, webhook replay across shop bindings, and the existing
manual draft workflow. They do not establish hosted acceptance.
