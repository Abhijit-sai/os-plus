# Shopify manual import acceptance

## What is complete

As of 20 October 2026, the deployed manual import → manager draft → garment
workflow → delivered path has passed in Phantom Threads Test. The code is the
real implementation; “Test” describes the destination tenant and simulated work,
not a temporary version of the product. No production-tenant order was modified.

Verified application release: `92f1858526dde0f44ce937cf4133fde90f562faf`.
[Vercel deployment](https://vercel.com/abhijit-ss-projects/os-plus/CeeCpnuEtr66WRm7FWHszVT8UfrF)
reported success. No additional migration is required for this release.

## Normal staff flow

1. An owner/admin opens Settings → Shopify → Import orders.
2. Choose a date range and preview. Dates are inclusive India-time days, up to
   31 days per request. Older-than-60-day history requires Shopify history access.
3. Review New, Already in Orders, Reference match and Conflict results. Import
   accepts eligible new rows; display filtering is not a per-row selection.
4. Keep the import sheet open while queued jobs process. Queued is not yet
   imported. If interrupted, reopen and Continue import instead of creating a
   fresh submission. Preview again to confirm orders are already present.
5. Imported orders appear in the ordinary Orders table immediately as drafts
   when team setup is incomplete. No global variant mapping or release action
   is required to make an order visible.
6. A manager or owner completes delivery and each garment's type/workflow.
   Partial choices can be saved and resumed. Complete setup validates the latest
   source and creates the workflow on the same order.
7. Staff progress that workflow normally. The order and garment reach delivered
   only after the final delivery transition.

These staff steps are the intended reusable flow. The earlier SQL preparation,
debugging and per-order pilot approvals are not routine staff onboarding steps.

## Evidence and coverage

| Area | Live result in Phantom Threads Test |
| --- | --- |
| Connection and manual import | Shopify source read succeeded; source store was not modified |
| Date range | 17–20 October preview; invalid/reversed and oversized ranges rejected |
| Existing orders | Nine existing skipped while five new were accepted; repeated preview returned fourteen existing, zero new |
| Interrupted processing | Six older queued imports resumed; later page interruption recovered pending jobs without resubmitting the import |
| Orders and drafts | One list; drafts visible, partial choices persisted, missing setup blocked completion |
| Garment choices | Per-garment dependency and multi-garment independence checked |
| Source identity | Different-name customer warning checked without saving an incorrect link |
| Source payment facts | Paid and pending examples displayed; no local receipt or message created |
| Workflow lifecycle | Two imported orders completed setup and all five stages, with Test-only notes |
| UI regressions | Premature final label, completed-stage fallback and Reset all fixed and retested |

Fresh verification for `92f1858`: 9 new actual-page regressions, 5 existing
imported-order UI tests and 49 isolated application/SQL foundation tests passed.
Typecheck, targeted lint, optimized build and order/client/stage boundary checks
also passed. The isolated suite uses fictional data and PGlite, not hosted data.

Same-phone/different-name imports, reference conflicts/races, stale/expired
previews, role/tenant denial, retry idempotency and retention behavior are covered
by isolated tests. They are not all separately reproduced against hosted fixtures.
Authenticated live acceptance used an owner/admin session; separate manager-role
hosted acceptance is still to be recorded.

Local evidence is kept outside Git in the sibling directory
`../shopify-test-evidence-20261020/`, particularly `TEST-REPORT.md`,
`UI-FIX-RETEST.md` and their screenshots. Do not publish customer screenshots or
private backup artifacts with documentation.

## Important behavior and limits

- Immutable Shopify identity protects repeated imports. A matching Reference
  order ID on a manual order is skipped for review, not automatically merged,
  linked or treated as proof that all details match. Ambiguous matches conflict.
- Same normalized phone with a different buyer name can reuse an existing local
  customer and still create the order. The source buyer name is retained
  separately; the existing customer is not renamed. Separate customer profiles
  sharing the same normalized phone are not created automatically.
- Shopify source product names, quantities, prices and payment facts remain
  source-controlled. Managers edit operational setup, not Shopify commercial data.
- Payment display is not local accounting synchronization: no OS PLUS receipt,
  GST posting, salary entry or customer notification is created by import.
- Reimporting an already-present order is not a substitute for automatic update
  synchronization. Automatic imports and updates are deferred.
- Retained order/customer details remain available after raw payload expiry.
  Without a scheduler, expiry does not physically delete the raw payload. An
  owner must use Remove expired raw payloads after 24 hours and repeat if more
  expired payloads remain. A hosted elapsed-24-hour cleanup check is still open.

## Another tenant is not yet self service

The data model is tenant-scoped, but current runtime access is restricted by
`SHOPIFY_CONNECTION_TEST_TENANT_ID`, one `SHOPIFY_SHOP_DOMAIN` and the configured
app credentials. `application-config.ts`, `pilot-credentials.ts` and the ingress
and read paths enforce those bindings.

Therefore, “every tenant can now connect its own store” is not an implemented
capability. Do not simply replace global credentials or the Test tenant setting:
that is a cutover, not an independent additional connection, and could affect
existing Test reads and jobs. Tenant-specific connection/credential onboarding
and isolation acceptance must precede adding another store or tenant.

The import and manager flow should be reused, not rebuilt. Each new connection
still needs one-time store authorization, access checks and a small scoped
acceptance check, not a repeat of the entire development and migration history.

## Readiness for chat and CRM development

There is no remaining known blocker in the exercised manual path. Development
can resume using retained orders, linked customer IDs, source buyer identity,
draft/confirmed states and item workflows. This is not production activation
or a claim of zero possible defects. The explicit remaining work is in
[Shopify pending work](47_Shopify_Pending_Work.md).

Do not auto-send confirmations merely because an imported source order exists:
historical and fulfilled orders can be imported, and a source buyer name may
differ from the linked customer. Messaging consent, recipient resolution,
event semantics and send idempotency require the chat/CRM phase's own design and
approval. No chat/CRM branch was changed to prepare this handoff.
