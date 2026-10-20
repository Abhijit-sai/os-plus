# Shopify pending work

Updated 20 October 2026. The manual flow is accepted within the scope in
[manual import acceptance](46_Shopify_Manual_Import_Acceptance.md).
This list does not authorize activation, migrations or changes to another tenant.

## Manual operation while automation is deferred

- [ ] **RAW-01 — Maintain the one-day raw-payload policy manually.**
  Owner/admin uses Settings → Shopify → Remove expired raw payloads after
  24 hours; repeat bounded batches if more remain. Record one hosted run proving
  expired raw payloads are removed while retained orders, customers and workflow
  history remain. No timer currently guarantees deletion.
- [ ] **QA-01 — Record separate hosted manager-role acceptance.**
  Verify manager draft save/completion and ordinary workflows; owner-only
  connection/import administration must remain denied. Isolated role tests pass.
- [ ] **QA-02 — Hosted edge fixtures before broader rollout.**
  In the Test tenant only, use approved fixtures for manual Reference collisions,
  ambiguous references and same-phone/different-name imports. Do not edit real
  Shopify customers/orders just to induce these cases. Isolated application/SQL
  tests already cover these cases and concurrency; this is additional hosted
  evidence, not a known failing behavior.
- [ ] **QA-03 — Investigate if the generic page-load failure recurs.**
  One interruption occurred during live import and jobs recovered successfully.
  Cause was not established. Capture a sanitized error/correlation identifier if
  it recurs; do not equate queued with imported or blindly resubmit.

## Additional tenants and production rollout

- [ ] **TENANT-01 — Independent store onboarding.**
  Shopify approval, encrypted per-connection credentials, token renewal and
  tenant-bound manual import/draft services are implemented and tested locally.
  [Exact activation package](48_Shopify_Tenant_OAuth_Approval.md) contains the
  unapplied SQL and configuration checklist. Hosted Test approval/renewal and
  manual-flow acceptance remain pending; no new deployment or shared migration
  is claimed. Check current Shopify app distribution eligibility, approve the
  schema package, provision separate encryption keys and configure the callback
  before enabling OAuth. Test-only gate and one-shop/one-destination binding
  remain; broader tenant rollout and revocation/uninstall acceptance are pending.
  Existing Test access must survive adding another connection.
  Done when two separate authorized connections can import independently and
  cross-tenant reads/writes and webhook fan-out are rejected.
- [ ] **ROLL-01 — Approved production activation.**
  Choose the destination and rollout plan, check matching/manual references,
  perform read-only preview first, then authorize a small import and confirm
  exactly one order per source. Do not copy Test workflow events or treat a
  global environment-variable swap as proven migration/onboarding.

## Automatic import and updates deferred by the owner

- [ ] **AUTO-01 — Prepare n8n worker package later.**
  Authenticated bounded worker calls, schedule, secret handling, retry/backoff,
  lease/idempotency behavior and actionable failure reporting. Configure in
  Test first. An enabled environment flag alone is not a running schedule.
- [ ] **AUTO-02 — Verify genuine Shopify notifications.**
  Check registered subscriptions and real order-created/updated delivery to the
  correct tenant. Verify signature/replay protection, duplicate/out-of-order
  events, transient failures and recovery. Do not create test orders in the
  production Shopify store; use an approved development store or natural event.
- [ ] **AUTO-03 — Validate update semantics.**
  Confirm source commercial/payment/refund/cancellation changes update the same
  order, preserve team-entered setup/work history and surface required review.
  Do not create local receipts or overwrite workflow decisions silently.
- [ ] **AUTO-04 — Automate cleanup and recovery.**
  Schedule one-day raw expiry cleanup, verify it does not erase retained business
  records, and test backlog/failure alerts. Retire the manual cleanup obligation
  only once the schedule and retention behavior are observed working.

## Chat and CRM handoff constraints

- Retained business order data, not expiring raw payloads, is the integration
  boundary. No dependency on n8n is needed to begin module development.
- Preserve source buyer versus linked customer identity; importing an order is
  not messaging consent.
- Separate import receipt, completed order setup, production progress and actual
  handoff events. Historical imports must not trigger misleading live messages.
- Preserve Shopify-managed money boundaries and tenant isolation. No live sends,
  production tenant activation or automatic sync is authorized by this list.
