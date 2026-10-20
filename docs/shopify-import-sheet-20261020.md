# Shopify import sheet and customer identity visibility

Scope: the existing Test-only Shopify feature. No migrations, database writes,
credentials, environment changes, scheduler activation or chat/CRM changes.

## User flow

Settings → Shopify → Import orders opens a side sheet:

1. Choose an inclusive India-time date range (maximum 31 days).
2. Review new orders, already-linked orders, matching references and conflicts.
   Search/filter affects the display, not the import selection. Import includes
   all eligible new rows in the preview. Existing-order comparison opens another
   tab; a reference match is not presented as proof of identical business data.
3. Submit and see queued/skipped counts. Queued does not mean created.
   Closing the sheet pauses its manual driver, not already-accepted server work.
   Reopen and Continue import to resume. Preview state is kept only for the
   current page session; durable server jobs survive navigation.

Preview expiry disables a fresh submission. An unconfirmed import can retry
with its original request key after expiry to recover an already-accepted
receipt. SQL remains the authority for expiry, identity, tenant boundaries and
duplicate checks.

## Customer matching

The existing database policy can reuse an active tenant customer with the same
normalized phone even when the Shopify buyer name differs. It does not reject
the order or rename that customer. This release does **not** change that policy,
the unique-phone constraint, or turn a reference match into an automatic merge.
The retained order keeps the Shopify buyer's original name separately.

The manager form now displays that source buyer name and a non-blocking warning
when the selected local customer has a different name, including searched
selections. The manager can review/change the link while keeping the draft.
Creating separate customer profiles with the same phone would be a separate
data-model decision, not an implicit UI change.

## Verification

- Actual application services and SQL in disposable, fictional PGlite fixtures:
  same-phone/different-name import, retained source identity, repeat recovery,
  date ranges, duplicate races, tenant/role isolation, retention and manager
  completion into garment workflows.
- Loopback headless Edge: stepped sheet, filters/search, expiry, close/reopen,
  focus return, mobile layout, pause/resume, interrupted import recovery and
  two-garment manager setup.
- Production compilation, TypeScript, targeted lint and existing UI/boundary
  regressions.

No hosted tenant orders are created or changed by this verification. Live Test
acceptance and n8n scheduling are distinct from these local checks. No migration
needs to be run for this release.
