# Manual Shopify import test — 20 October 2026

## Scope and database status

This application-only correction removes the scheduler dependency from manual
Test imports. No new SQL migrations or environment variables are required.
The seven migrations in document 43 were already applied to the shared hosted
Supabase database during the separately approved release; do not rerun them.
The production tenant and Chat/CRM are outside this test.

## Correction

The old service required a worker flag and secret even for the owner's manual
enable action. The failing real-service/disposable-SQL test reproduced
CONFIGURATION_INVALID with both worker settings absent. Manual enable, import
and processing now work without them. The owner explicitly acknowledges manual
raw-payload cleanup. Automatic sync still requires worker configuration, and the
screen does not claim that endpoint configuration proves a schedule is running.

Keep the import page open while it processes queued orders. If interrupted,
return, acknowledge manual cleanup and choose Continue import. Retried jobs and
Reference order ID matches retain duplicate protection.

Remove expired raw payloads calls the existing bounded, connection-scoped expiry
function after current owner/Test authorization. Each click removes at most 100
expired raw payloads; repeat if the result says more remain. Payloads younger than
24 hours are preserved. Orders, customers, retained source details and workflows
are not deleted. Without a scheduler, expiry alone does not perform deletion:
the owner must return after 24 hours and run this action.

## Hosted acceptance — still pending

This session has no authenticated browser-control tool. A local fixture pass is
not a hosted Phantom Threads Test pass. Use the signed-in UI, not a fabricated
actor, direct database row edits or a production Shopify test order.

1. Verify the header says Phantom Threads Test. Open Settings → Shopify.
2. Acknowledge data retention/manual cleanup and choose Verify and enable Test
   imports if not already connected. Existing pilot drafts may refresh in place.
3. Leave automatic sync off. Set both dates to one recent day and Preview orders.
4. Check New / Already in Orders / Reference match / Conflict results. A reference
   match is skipped, never silently linked to or overwritten in a manual order.
5. Import the new orders and keep the page open until processing finishes.
6. Open Orders → All. Verify one row per imported order, Shopify source, populated
   Reference order ID, customer, items and Shopify payment facts. Missing team
   setup must not hide the order or require global variant mappings.
7. Open an imported draft. Save an incomplete setup; it must remain a draft with
   no production workflow. For a pants item select Pant, Pant default workflow
   and Store pickup, save, then Complete setup. Verify the normal workflow exists.
8. Preview the same day again. Imported orders must be Already in Orders, not new.
   Reopening/completing an already completed setup must not duplicate its items.
9. After 24 hours, run Remove expired raw payloads until no expired payloads
   remain. Confirm the imported orders/customer details remain accessible.

Do not describe the hosted flow, timed cleanup or genuine webhook delivery as
verified until those actual observations are recorded. n8n remains separate.

## Local verification

- 45 unified foundation tests pass, using actual services and disposable SQL
  with synthetic Shopify HTTP. The manual path now follows the same imported
  order through manager save/completion and exact retry without worker settings.
- Regression checks cover manual cleanup acknowledgement, automatic-enable
  rejection before Shopify calls, Reference matching, repeated import, one
  workflow creation, no local payment receipts, and wrong-role/tenant denial.
- 19 loopback browser assertions pass using fictional actions on desktop and
  375px mobile, including manual consent, disabled automatic sync, cleanup,
  draft save/error feedback and Pant/Store pickup completion.
- Typecheck, lint and optimized production build pass. Windows sandbox-specific
  browser/build failures were resolved by running those local tools outside the
  sandbox; no personal browser session or real database data was used.

The UI skill guided explicit disabled-state explanations and manual cleanup
feedback; the diagnosis skill supplied the failing-before/passing-after test.
