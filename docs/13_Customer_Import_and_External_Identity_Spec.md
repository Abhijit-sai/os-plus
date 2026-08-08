# Customer Import and External Identity Implementation Spec

## 1. Objective

Allow a tenant owner/admin to preview and atomically import customer profiles from Shopify-style or OS PLUS CSV/XLSX files without creating duplicate customers, overwriting populated profile data, changing reports, or enabling messaging consent.

## 2. Scope

Included:

- Owner/admin-only customer import from the Customers page.
- CSV and XLSX files up to 5 MB and 5,000 data rows.
- Shopify export headers and generic OS PLUS customer headers.
- Conservative Indian and international phone normalization to E.164.
- Write-free preview with counts, row results, conflicts, and email-only decisions.
- Matching by Shopify customer ID, then normalized phone, then advisory exact email.
- Blank-field enrichment for authoritative matches.
- Structured default addresses when address line 1 exists; legacy text for incomplete addresses.
- Read-only Shopify source metadata.
- Atomic, idempotent confirmation and immutable receipts.

Excluded:

- Direct Shopify OAuth, webhook ingestion, order creation, or historical order backfill.
- Reporting from Shopify totals, order counts, or tags.
- Treating imported marketing flags as OS PLUS messaging consent.
- Automatic fuzzy matching by name or email.
- Database migration application without first completing the collision audit.

## 3. Confirmed Product Decisions

1. Rows without a name are skipped; an email address is never used as a substitute name.
2. Shopify ID and normalized phone are authoritative. A disagreement between them is invalid and never guessed through.
3. A normalized-phone match always reuses the active tenant customer.
4. Exact email alone requires an explicit per-row decision: reuse, create separate, or skip.
5. Reused customers may receive only blank phone, email, legacy address, or notes fields. Existing name and populated fields remain unchanged; conflicts stay visible in preview.
6. Indian national formats default to `+91`. Explicit `+` or `00` international numbers are accepted. Foreign national format requires a reliable ISO country code. Ambiguous foreign numbers are invalid.
7. Complete addresses create a structured address if an equivalent address does not already exist. It becomes default only when the customer has no active default address.
8. Shopify source metadata is inert and private. It does not affect finance, reports, orders, tracking, or communications.

## 4. Data and Transaction Design

- `customers.normalized_phone_e164` stores the canonical match key.
- An active partial unique index on tenant and normalized phone prevents concurrent duplicates.
- `customer_external_identities` links tenant customers to Shopify customer IDs and retains source metadata.
- `customer_imports` records immutable file, preview, idempotency, count, and result evidence.
- `import_customer_rows` is a service-role-only security-definer function. It serializes customer imports per tenant, revalidates all active customer and identity targets, rejects stale previews and cross-key conflicts, and performs all writes in one transaction.
- The RPC catches a normalized-phone race and reuses the winning active customer; other failures abort the transaction.

## 5. Preview and Confirmation Flow

1. The owner/admin selects a CSV or XLSX file.
2. Server validates size, extension/signature, XLSX archive safety, sheet/row/column limits, headers, field formats, and duplicate keys inside the source file.
3. Server loads only active customers and Shopify identities for the selected tenant.
4. Preview classifies each row as create, reuse by Shopify ID, reuse by phone, email review, invalid, or skipped.
5. The user resolves every email-only row.
6. Confirmation re-reads the same file, repeats matching, verifies file and preview fingerprints, excludes invalid/skipped rows, and sends only approved normalized rows to the RPC.
7. The RPC commits every customer, enrichment, address, identity, metadata record, and receipt, or rolls back all of them.

## 6. Security and Privacy

- UI visibility and the server action require `customer_imports:manage`, granted only to `owner_admin`.
- The server obtains tenant identity from authenticated context; no client tenant ID is trusted.
- Every customer and identity lookup is tenant-filtered. The RPC independently repeats tenant validation.
- The private sample customer export remains ignored by Git and is never used as an automated fixture.
- Automated tests generate synthetic customer data.
- Source marketing flags are stored only as metadata and do not grant contact permission.

## 7. Test Plan

- Parser behavior: Shopify CSV, generic XLSX, Indian/US/other international phones, incomplete addresses, invalid emails, conflicting phone columns, malformed files, 5,000-row limit, and XLSX archive preflight.
- Matching behavior: precedence, tenant-local matches, key disagreement, source duplicate keys, exact-email review, conflict reporting, and create path.
- Contract behavior: owner-only permission, pending/close protection, normalized-phone unique index, RLS tables, immutable receipt, service-role-only RPC, tenant revalidation, idempotency, and stale-preview rejection.
- Database QA after migration: backfill count, zero unresolved phones, atomic rollback, replay, tenant isolation, address defaults, metadata isolation, and concurrent duplicate attempts.
- Manual UI QA: desktop and mobile preview, conflict legibility, email decisions, recoverable error, double-click protection, success counts, and customer list refresh.

## 8. Deployment Dependencies

1. The read-only active-customer audit must report zero unresolved active phones and zero collision groups. Completed on 2026-08-08: eight active phones, all resolved as Indian, zero collision groups.
2. Apply `20260809100000_customer_import_and_phone_identity.sql` before deploying code that reads `normalized_phone_e164` or import tables. Completed in the shared production/QA environment on 2026-08-08.
3. Run database contract checks against the approved shared production/QA environment without importing real personal data. Completed with synthetic records and authenticated test tenants on 2026-08-08.
4. Generate a synthetic expanded CSV/XLSX for authenticated QA. Completed; fixtures remain under ignored `outputs/` and contain no real customer data.

### Final review hardening (2026-08-08)

- Country-assisted non-Indian national numbers are parsed using the supplied country before Indian-default inference.
- Imported E.164 phone values remain valid in normal customer edit flows.
- Invalid ISO country codes and malformed UTF-8 CSV bytes fail during preview, before confirmation.
- Every email-only decision remains visible even when a preview contains more than 200 rows, and the decision shows all populated-field conflicts including notes.
- Preview freshness includes matched customer/profile and conflict state, so relevant profile changes require a new preview.
- Parser, matching, UI/permission, source-contract, and authenticated database flows are covered. Forced-failure rollback and concurrency remain candidates for an opt-in integration harness only when a disposable QA database is available; they must not be run destructively against the shared production/QA environment.
5. Import the real tenant file only after the owner verifies the preview counts and email-only decisions.

## 9. Authenticated QA Evidence

- Phantom Threads owner/admin: CSV/XLSX preview and confirmation passed for Shopify-ID reuse, normalized-phone reuse, explicit email review, Indian/US/UK numbers, conflict display, invalid/skipped rows, blank-field enrichment, and structured/incomplete addresses.
- Retry: the corrected all-cases workbook created no additional customers on its second confirmation and added no duplicate structured addresses.
- Role boundary: the Customers page does not render the import action for the Phantom Threads manager role.
- Tenant boundary: the Fundry Laundry tenant showed none of the Phantom Threads synthetic customers.
- Pending feedback: preview and confirmation disabled conflicting controls, prevented close, and displayed operation-specific progress.
- Browser console: no application errors were recorded during the owner/admin confirmation or manager/tenant-isolation checks; Clerk development-key warnings are environment-only.
