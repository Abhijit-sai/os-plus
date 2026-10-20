# Tenant-specific Shopify approval — activation package

Prepared 20 October 2026 from released baseline `92f1858`.

## Deployment check update 21 October 2026

The owner reports applying the SQL, releasing the callback configuration in
Shopify, and saving both credential encryption variables in Vercel.
A new read-only shared-Supabase check independently confirms:

- Applied OAuth function body matches this package's SQL exactly.
- Both new tables have RLS enabled, no public policies and the expected owner.
- Anonymous/authenticated roles have no function or table access; service_role
  can execute the controlled function but cannot access its tables directly.
- The Test connection is verified, with zero OAuth credentials, zero automatic
  connections, zero pending jobs and zero leased jobs.

The signed-in hosted page shows Phantom Threads Test and automatic sync off.
OAuth tests (29 backend plus 1 UI), manual regression tests (50) and the build
pass again. Tests overlap. No migrations or business-data writes were performed
by this check. Configuration values were not read from Vercel.
Release publication and hosted OAuth approval are the next steps; the original
pre-activation status below describes the package when first prepared.

## Status in plain language

The new connection implementation is built and tested **locally**, but is not
committed, deployed or enabled in the hosted app. The proposed SQL has **not**
been run on shared Supabase. No live Shopify authorization, production-tenant
data change or chat/CRM edit was performed for this package.

The previously deployed manual import flow remains the release documented in
[manual acceptance](46_Shopify_Manual_Import_Acceptance.md). Its acceptance is not
proof that this new approval flow has passed hosted testing.

The intended owner experience is:

1. Settings → Shopify → enter the store's `myshopify.com` domain.
2. Connect Shopify → approve access on Shopify → return to OS Plus.
3. Confirm retention once, choose dates, inspect the import preview, import new
   orders only.
4. Open drafts in the normal Orders table; managers finish garment/workflow and
   delivery setup. No variant mapping or separate release is required.

Each connection stores its own encrypted credentials and store identity.
The app client ID/secret identify the OS Plus Shopify app; they are not the
tenant's order-access token. Normal tenants never paste secrets into OS Plus.
For this release, all hosted access remains restricted to Phantom Threads Test.

## Implemented and checked

- One-use, expiring approval state bound to the canonical owner, tenant, store
  and app; signed callback, secure cookie and fixed return URL.
- Expiring offline credentials encrypted with a dedicated key ring, with
  tenant/store/app binding. Browser database roles cannot read credentials.
- Durable refresh lease, stale-write protection and explicit reauthorization
  after an unknown token-rotation outcome. Never silently fall back to global
  credentials when an OAuth credential exists but is invalid.
- Current Test connection stays on its existing binding. Before OAuth is
  approved, the legacy token adapter remains available for that connection.
- Manual preview, import, queued manual processing, retained order/payment
  reads and manager draft completion resolve the saved tenant store and token.
- Separate owner approval and explicit import consent. Connecting alone does
  not import orders or start workflows.
- Existing date-range duplicate/reference protections and same-number buyer
  handling remain intact. A different source buyer name does not overwrite an
  existing customer's name.
- Reauthorization cannot race another active approval or credential renewal.
  An interrupted claimed approval can take ten minutes to expire. Ambiguous
  refresh recovery may require owner reauthorization rather than retrying a
  potentially rotated token.

## Local verification evidence

These use fictional data and an isolated in-memory PostgreSQL-compatible PGlite
database with repository migrations plus the proposed SQL, not hosted Supabase.
Shopify responses are controlled fixtures, not real Shopify approvals.

| Check | Result |
| --- | --- |
| `npm run test:shopify-oauth` | 29 backend/application/SQL checks and 1 rendered UI check pass |
| `npm run test:shopify-unified-foundation` | 50 pass, including duplicate/reference and same-number buyer cases |
| Probe and source-payment regression suites | 75 pass |
| Order UI-state and imported-order render regressions | 14 pass |
| Targeted ESLint on changed application modules | Pass |
| `npm run build` | Pass, including TypeScript and both OAuth routes |
| `git diff --check` | Pass; existing Windows line-ending warnings only |

The OAuth application test deliberately supplies a wrong global shop and proves
that preview/import use the saved tenant shop. It imports one retained draft,
skips a repeat import, then saves and completes it through the actual manager
service without creating duplicate workflows or local payment receipts.

Local browser inspection on `/approval` verified the labeled domain-only form,
read-only existing-store binding, disabled pending state, preserved input and
safe failure feedback. The preview deliberately has no OAuth endpoint; its
failure screenshot is not evidence of a failing live connection.
Evidence: `../shopify-test-evidence-20261020/oauth-local-error-feedback.png`
relative to the repository root.

PGlite does not establish real multi-session hosted concurrency, Shopify app
distribution eligibility, live callback/session behavior or live token renewal.
Those remain release acceptance checks.

## Exact proposed database change — approval required

Only new SQL file for this package:

[`20261020180000_shopify_oauth_credentials.proposed.sql`](sql/20261020180000_shopify_oauth_credentials.proposed.sql)

SHA-256:
`00f56600b2aa209a6aa7767cd3ef827ac7aff193bb8f1ace2ce04cea96e02f48`

It adds:

- `shopify_oauth_attempts`, an approval-state table.
- `shopify_oauth_credentials`, an encrypted-credential table.
- `shopify_oauth_storage(uuid,text,text,jsonb)`, a service-role-only function with
  membership and connection checks.

It enables RLS on the new tables and revokes direct access, including direct
service-role table access. Only the controlled function is executable by the
server service role. It does not replace existing functions, update existing
orders/customers/connections, enable imports or register webhooks when applied.
Future authorized calls can register a connection or update its credential.

This affects the **shared Supabase schema**, not just a local database. Do not
apply until the exact package is approved. Before application, perform an
approved read-only prerequisite/ownership check and verify the current backup
and recovery path. Do not rerun the historical twelve-file package.
This transaction is intentionally not a blind rerunnable script: after an
uncertain outcome, inspect the new objects rather than applying it again.

## Required configuration and safe rollout order

1. **Confirm the Shopify app supports the approval flow and intended stores.**
   We have not verified the current app's distribution setting. Custom
   distribution is restricted; unrelated merchants may require an appropriate
   public distribution and review. Do not promise all stores can install the
   current app. See [Shopify distribution](https://shopify.dev/docs/apps/launch/distribution).
2. Keep the current app client ID/secret and Test tenant binding unchanged. Add
   the exact allowed redirect URL to that Shopify app:
   `https://os-plus.vercel.app/api/integrations/shopify/oauth/callback`.
   Confirm `read_orders`, `read_customers`, `read_products` and the required
   protected customer-data access. The flow uses
   [standalone authorization-code approval](https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps).
3. Provision a **new dedicated** credential-encryption key through secure
   operator tooling. Configure server-only Vercel Production variables:
   `SHOPIFY_CREDENTIAL_KEY_ID` and
   `SHOPIFY_CREDENTIAL_ENCRYPTION_KEYS_JSON` (a JSON map from that ID to a
   cryptographically random 32-byte key encoded as base64). Do not reuse the raw
   payload key or share secret values in chat, screenshots or Git.
4. Approve and apply the exact SQL above after the preflight/recovery check.
   Record execution and validate new function/table privileges read-only.
5. Review and publish this code package through Git with `SHOPIFY_OAUTH_ENABLED`
   absent or false first. Verify deployment before activating it.
6. Confirm Test automatic sync is off, scheduled worker remains disabled and no
   Test jobs are in flight. Set `SHOPIFY_OAUTH_ENABLED=true` only for the prepared
   deployment, keeping `SHOPIFY_CONNECTION_TEST_TENANT_ID` unchanged. Existing
   unified/manual-import feature flags remain as already configured.
7. Sign in as the Test owner, use Connect/Reauthorize Shopify and personally
   approve the permissions on Shopify. Existing OS Plus orders are retained.
   Offline token conversion/rotation can retire earlier tokens for this
   app/store, so this step needs a controlled window; it is not a zero-risk
   cosmetic setting. See [Shopify access tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens).
8. Complete the hosted Test checks below before declaring this package accepted.

Changing to a different Shopify app client ID is **not** covered: existing
connection identity is immutable. If distribution requires another app, prepare
a separate binding/cutover plan first.

## Hosted acceptance still required

- Actual owner approval returns to the same Test tenant; denial, expired state,
  duplicate callback and sign-in/tenant changes fail safely.
- Existing Test orders remain readable; owner can preview a small approved date
  range, import only new orders and see exactly one retained draft per source.
- Repeat preview/import skips existing source identities and references.
- Manager can save partial setup and complete it once; owner-only connection
  controls remain inaccessible. Do not use owner testing as separate manager
  acceptance.
- Access-token renewal succeeds after expiry without leaking credentials or
  mixing tenants. Reauthorization keeps the same connection and orders.
- Confirm permissions on actual Supabase; run isolated PostgreSQL multi-session
  refresh/reconnect tests before broader rollout. Do not induce races on live
  production stores.
- Maintain and verify the one-day raw-payload cleanup manually while scheduling
  is deferred; retained business orders are not deleted with raw payloads.

No source Shopify orders/customers should be edited to create edge cases.
Same-phone/different-name and ambiguous-reference adversarial cases currently
have isolated application/SQL coverage; hosted fixtures require an agreed
Test-only approach.

## Boundaries, recovery and pending work

- This implements tenant-bound credentials but does not open onboarding to
  other tenants yet. Two independent stores need separate authorized acceptance
  before broader rollout. Existing one-store/one-destination constraints remain;
  simultaneous Test and Production copies of one shop are not enabled.
- n8n, unattended workers, OAuth-aware webhook/background processing, genuine
  created/updated notifications, scheduled cleanup and revocation/uninstall
  lifecycle acceptance are deferred. Automatic sync cannot be newly enabled
  through the OAuth setup screen in this package.
- A normal token renewal should finish quickly; another request during an
  occupied lease currently fails closed and may display a reconnect message.
  This is a recoverable limitation, not proof the account was revoked.
- If OAuth activation fails, stop Test imports and preserve the encrypted
  credential/key material and existing orders. Do not delete tables, remove
  keys, swap app identity or assume turning the feature flag off restores old
  Shopify tokens. Check token compatibility before any fallback.
- Raw payload expiry must never erase the credential key or retained orders.
- The chat/CRM branch and production tenant remain out of scope.

Track ongoing obligations in [pending work](47_Shopify_Pending_Work.md).
