# Staff-only setup correction — prepared release scope, 31 October 2026

D078 authorizes implementation, testing, review and PR preparation only. This package is NOT authorization to apply SQL, merge, deploy or activate Chat. Production remains on main `28e6a8efc576572bbdb7b8fc694a7a82e5e7d0a6`, with all Chat modules off. Reverify main and runtime before any later release.

## Exact proposed changes

- Existing Channels settings gain an Owner/Admin Off-only control. The server fixes mode=off, canBook=false and approveAuto=false, preserves routing, and uses the existing versioned/audited command. Advanced actions and AI remain disabled.
- Existing platform Chat workspace gains explicit staff pairing. Only active login-linked Owner/Admin or Manager profiles qualify; the server verifies the selected login belongs to that exact native account and has the exact matching normalized email, then rechecks platform access and current state. Collisions/replacements fail. No person, role, membership, password, token or permission grant is created or changed.
- ONE additive canonical migration: `supabase/migrations/20261031132000_chat_staff_link_commands.sql`. Its exact SHA is in manifest.json. It creates only `public.chat_staff_link_configure(jsonb,jsonb)` over existing tables, service-role execution only, atomic link/audit/idempotency. No existing tables/functions or grants are altered. The frozen106 baseline and already-installed35 Chat files remain unchanged. Never replay the previous4575-line script.

## Later approval and execution boundaries

1. After final tests/review, present the exact PR head, migration/hash and this scope for approval. Shared schema affects every tenant even when testing only Test; disposable upgrade tests are the environment isolation evidence.
2. When separately authorized, the owner may apply ONLY the single new transaction in the correct existing OS PLUS Supabase project. Capture success and independently verify installed definition/execute grants, direct-write revocation and existing schema ledger. Do not mark this applied from a local file or test result.
3. Reverify then-current main, approved PR head/tree/CI and all modules off. Merge only that reviewed PR and build the resulting main as fresh Production. No old branch deployment, Preview promotion, environment-secret replacement or unrelated change.
4. Verify exact Production commit/deployment/alias, unauthenticated disabled endpoints, actual authenticated all-off interface and retained Boutique/Shopify behavior. Keep previousmain28e6 available for application rollback. The additive function and existing staff-link rows can remain on rollback; do not delete links/customer/order/payment data. Pause Test and restore capture-only setup guards if continuation fails.
5. A distinct execution approval must cover the two prepared Test staff pairs (selected existing Test administrator→native3 and actually tested Manager→native4, account903/workspace documented privately), with no OS PLUS login/membership/role change. Then resume already approved D075: temporarily enable only Test setup; confirm brand/mapping; use Off-only command and independently verify modeoff before receipt-backed transport/webhook setup; capture fictional visitor→correct Test CRM lead→manual staff reply, replay/isolation/privacy/attachment and actual persona checks. Native browser login is separate; SSO remains unproved.

All real-business activation, Shopify connection cutover/import completion, WhatsApp/Meta, AI/STT, Telegram, n8n automation and purchases remain outside this release. Owner-deferred backups D069 and real-data host security/PartD remain unpassed. Preparation is not full hosted CH10 acceptance.


## Publication receipt — preparation complete

Draft PR12: https://github.com/Abhijit-sai/os-plus/pull/12. Tested/reviewed source checkpoint `76192b4ce72d70b728cae477ede09478eaadb9b9`; any following publication-receipt commit changes records only. Full333/333Chat and separate30/30ShopifyPASS, all six gatesPASS, both reviews0. Vercel feature check9SP1nDhLEbQvH5QhXVqG97VmEw7C succeeded; this is a branch check, not a Production release. Shared SQL107 is still NOT_APPLIED and PR is draft/unmerged. Production remains28e6a8e/alloff. Later approval must name the final PR head and the unchanged migrationSHA, all-off new-main release, and separately the two prepared Test bindings before that execution.
