# Staff-only setup correction QA — 31 October 2026

D078 authorizes implementation/test/review/PR preparation only. CH10 engineering scope remains CLOSED LOCAL / accepted under D072; hosted Test acceptance is QA_BLOCKED pending this correction’s separately approved release and actual visitor acceptance. Full real-business/AI/SSO/PartD acceptance stays open. Production main28e6a8efc576572bbdb7b8fc694a7a82e5e7d0a6 and all-off state are preserved.

## Scope and files

Existing channel row gains Off-only action; existing platform workspace gains lazy explicit staff pairing. New service-only `chat_staff_link_configure` command over existing chat_staff_links, no new table, no direct browser writes. Active/login-linked Owner/Admin or Manager only; exact account/native membership and normalized email match, fresh platform access/flags/profile/workspace checks; no collision, replacement or role/login creation. New migration `supabase/migrations/20261031132000_chat_staff_link_commands.sql`, SHA256 `9e6a30e11b7bfac7d573e2a7098b54c36740d2b3f121de2301f23e7a91253d85`, not applied to shared Supabase. All106 historical bytes and old35 installed/packageSHA3acfc26f7af98989d4957a6ab2d64ea2ceb871fca2235e5dc88dd336f61faab9 preserved. Separate manifest/release scope: deploy/chat-release/20261031-staff-only.

## Commands and results

Implementation/build host: Windows, D:/Develop/os-plus-chat-ch0. Existing installed dependencies, D-scoped TEMP/TMP/cache; no C Docker/WSL action or dependency install.

| Command | Fresh result |
|---|---|
| npm run typecheck | PASS after final existing-schema correction |
| npm run lint | PASS after final correction |
| npm run build | PASS after final correction, including TypeScript worker |
| npm run test:roles | PASS, route/Chat integration and23 ingress cases |
| npm run test:v2 | PASS, baseline/work-unit/commands-events-tasks/Laundry-custody groups |
| npm run test:chat | PASS333/333,0fail/skip/cancel/todo; exact corrected source verified |
| node --experimental-strip-types --conditions=react-server --test scripts/test-shopify-import-plan.mjs scripts/test-shopify-import-preview.mjs scripts/test-shopify-commercial-order.mjs scripts/test-shopify-draft-setup.mjs scripts/test-shopify-source-payments.mjs |30/30PASS,0fail/skip; no live Shopify call/import |

Native full runner is the reviewed scripts/chat-release/run-owned-native.py, transferred with an allowlisted source/dependency bundle over the sole authorized rootSSH identity to2.29.113.198. Only nonce-owned internal network/512MiBPostgres+512MiBNode/tmpfs/read-only source mount; no ports, pulls, live env/volumes or live DB. Require1400MiB headroom, attest ownership before database/cleanup, compare all7 live IDs/restarts/states,900s suite deadline, remove owned resources. Focused diagnosis used an ignored same-boundary runner with only the named5-case test and16.5MiB bundle; it is not a full Chat gate. No Rails boot or server configuration change.

## Failed checks, diagnosis and resolution

- Local discovery/core tracer failures were missing method/module; implemented and reran. Off-only2 tests prove fixed fields/no escalation/other-role/disabled/stale-tenant denial.
- First native325 suite324PASS/1fixture failure (workspace active-token/key constraints),63.0s; corrected fixture. Corrected nativeRED328 suite327PASS/1expected missing107,66.0s; metadata-only check confirms no fixture failure. Every run cleaned up with live services unchanged.
- First implemented328/328GREEN,66.0s, bundle08a6a89ed30218c9df66ff910359efe9205b8a5a279ae2273825501a250ab5da. Includes first real106->107 install/forcedtransactionrollback and completed receipt replay. Superseded for final source.
- Expanded full333 suite332PASS/1staff action integration failure, twice66.0s, bundlesaf9e90f1fddd60cce6e904cdc8b8c469eeaaf795c0c5d359bce19b70f44fad45 and5f9e278a8200c5be7a6ddcc7545bddd4c11939dfa12c62ddbce3e66c066f8daf. All other new SQL/Off cases passed. Corrected pg bigint adapter to match PostgREST JSON safe numbers; necessary but not the complete cause.
- Focused5 suite4PASS/1FAIL,6.0s, bundle1dcfff9a1cf7c6815cf1b8d5a3d34bd8e21d583b2f9e3445cb231dcdac46db4e. Safe underlying error plus actual schema inspection exposed new lookup’s mistaken full_name column; existing20260601090000 defines display_name. Corrected new query/Zod/projection/local fixture; no extra migration. This is a real unreleased runtime bug caught by actual database tests, not dismissed as a fixture-only failure.
- Corrected focused5/5PASS,6.0s, bundled6fc3c7290e77aca120ca8b99cb45976f0171d8ecbb8a134a7f0755e4d026386; live services unchanged/cleanupPASS. Final full333 rerun required and pending above.
- Lint reserved test variable corrected; final lintPASS. No unresolved production-build failure on this source.

Actual SQL cases: retained synthetic Boutique customer/order/partial payment plus external-Shopify draft snapshot unchanged across successful upgrade and deliberate whole-transaction failure; effective service execute/browser denial/table write revocation+RLS; active profile/role/login/workspace/account/fingerprint checks; conflicting key/actor/pair denial; independent-connection replay creates one row/event; forced audit failure rolls back link and receipt; actual Off action persists fixedoff/canBookfalse, one audit/version under replay and stale-version/foreign-channel denial; actual platform staff action+real AAD encryption+native client+realSQL, one verified link, replay skips native call and safe wrapper failure. Only external Clerk/native HTTP boundaries are synthetic. Native agents response shape verified through static pinned4.18 source, no live Rails runner. These cases overlap fullsuite totals; do not add groups.

## Manual interface and live-state evidence

Actual in-app synthetic preview uses production components and explicit simulated actions, no Clerk/Supabase/native runtime or rootenv. Off button changes draft to visibleoff/Staff replies only. Required blank staff choices/confirmation block save; explicit matching selections succeed/reset; simulated failure stays safe. Actual390x844CSS/client378/scroll378, no overflow. Native select clipped identity text: corrected component displays selected email in full below each dropdown, verified in DOM/screenshot. Desktop/mobile screenshots in existing visualization root chat-staff-only-off-preview-20261031.png and chat-staff-link-preview-{desktop,mobile}-20261031.png; fictional data only. Viewport reset/tabclosed. Preview root29372absent/port4126listener0 verified; cleanup emitted a DateTime-string conversion diagnostic, subsequent path/listener ancestry selected only owned processes. Future cleanup uses terminating errors and typedDateTime comparison.

Fresh protected shared READ ONLY confirms enabledChatModules0/channels0/enabledTenantIds[]. Account903/workspace and prepared users3/4/inbox903 preserved. No107 application, actual staff binding, module/brand/channel mapping, webhook/bot, visitor/message or OSPLUS role/membership write in D078. Earlier native/actualOwner+Manager browser evidence remains dated; Viewer/Finance actual logins unavailable/NOTRUN, SSO unproved. No new shared Boutique/Shopify fixture mutation. Narrow Chat types/query/UI and additive function do not touch listed TierA/B shared trigger areas; retained records/role/V2/contracts are tested, full fresh hosted regression is not claimed.

## Review and artifacts

Review skill two-axis working tree fixedbase28e6a8e, including all untracked source. Standards0hard/0advisory; Spec0. Both rechecked mobile/readability, safe-bigint adapter and actual display_name schema correction:0remaining. No source changed after those corrections. Final commit diff/hash comparison required before PR publication.

Ignored outputs/ch10-staff-only-fix-20261031 retains gate logs, bundles/manifests, native selected reports, private-value scan counts and process receipts. Native full runner retains /opt/os-plus-ops/release-qa-<nonce>.json/.log with synthetic-only source/test outcomes; disposable DB/network/source workspace removed after each run. No combined unique count for overlapping groups. Actual private token/key/webhook values were compared in memory against proposed text;0credential matches/no values output (initial UUID false positives classified correctly). No private files in Git or bundle. Arbitrary remote-log print rejected by automatic review; diagnosis used metadata/allowlisted error classes, no bypass.

Feature model/STT/judge spendUSD0; coding-agent billing unmeasured. BackupsD069deferred/notPASS; real-business host security/PartD, nativebrowserlogin/SSO, new Shopify import/actual-store cutover, WhatsApp and real messages remain separate. No new purchase, AI/STT/Telegram/n8n activation. Preparation is not authorization to apply107, merge/deploy or enable a tenant.


## Final corrected full-gate receipt

Native full suite PASS333/333,0fail/skip/cancel/todo,66.0s suite, bundle `a4078d20c5ccc3dc1389acc00c09d760ece970a0d0d9b2c9c5cbc26b9dd314bd`. UTC 2026-10-31T14:23:27.756670+00:00; minimum available memory 1386MiB, all7 live service IDs/restart/state snapshots unchanged, owned cleanupPASS. This supersedes the failed333 runs and earlier328 source. All 24 changed production/test/harness/migration paths match the tested bundle’s exact file hashes; later edits are records only. Fullsuite includes the5actualSQL cases and4core adapter cases; overlapping focused runs are not additional unique tests. All six mandatory gates nowPASS, separate30ShopifyPASS. No provider/model call and no production SQL/tenant/message mutation. Detailed selected receipt in ignored final-verification.json; source may be committed/published only as D078 reviewed preparation checkpoint, not full hosted acceptance or release authorization.
