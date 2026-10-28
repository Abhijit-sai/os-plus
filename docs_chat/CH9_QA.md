# CH-9 engineering QA — 28 October 2026

Phase READY_FOR_CLOSURE LOCAL under explicit owner acceptance CHAT-D059 (28 October2026). Local engineering implementation/QA and reported product acceptance complete, including unsaved-confirmation Cancel/preservation and invalid-save retention. Local commit authorized; no production release. Earlier pending-owner statements below are historical and superseded by D059. Branch codex/chat-ch1-foundation/no upstream, baseline84cfdb15d70826298bc7547d7d943e30d26617c5, existing D:/Develop/os-plus-chat-ch0. CH8 accepted/committed locally under CHAT-D058.

## Implemented

- Concise owner overview with everyday Chats/Leads CTAs and setup status; focused query-selected settings sections mount only their own forms. Existing OS PLUS tokens/theme/navigation retained.
- Business knowledge exposes description/opening-hours fields for a loaded revision; preserves other pack data, strict validation/versioned publication and deliberate advanced JSON disclosure. No automatic publication or business facts copied.
- Chat action/voice/notification/setup forms participate in existing unsaved guard; dirty state retained through failure/uncertain submit, cleared only confirmed success. Displayed tenant bound to every foundation save, knowledge save and inbox sync.
- Server-authorized mapped website inbox read; pinned provider data reduced to public widget token/name/pre-chat status. Script generated from whitelisted values, no provider HTML/API/HMAC key returned. HTTPS required except explicit disabled-live local mock loopback.
- Website numbers normalize explicit international input only into separate unverified tenant-owned claims. Claims never become verified phone identities/customer lookup keys; composite tenant ownership, atomic capture/audit, replay immutability, PII-safe reads through current conversation ownership after explicit merge/split.
- Staff reply in Chatwoot; website requests remain provisional. Self-asserted phone, REF or voice cannot authorize bookings/history/customer links. Existing typed verification/staff approval retained; statements deferred D047.

No shared Boutique/Laundry/customer/order/payment/permission-helper/app-shell behavior changed. Full file manifest follows at the end. Existing reference-business infrastructure/data/policy was not used or modified.

## Automated gates

| Command | Result | Source log |
|---|---|---|
|npm run typecheck|PASS|outputs/ch9-typecheck-final.log|
|npm run lint|PASS,0 warnings|outputs/ch9-lint-final.log|
|npm run build|PASS optimized build|outputs/ch9-build.log|
|npm run test:roles|PASS, includes23 ingress cases|outputs/ch9-roles.log|
|npm run test:v2|PASS, four scripts|outputs/ch9-v2.log|
|npm run test:chat|PASS264/264,0skip|outputs/ch9-chat-final.log|

Website subsets (not added again): pure2/2, real loopback client1/1, actual disposable PostgreSQL5/5, stale server-boundary2/2. Replay106 actual migrations, independent-connection duplicate race, changed-phone rejection, audit rollback, two tenants/composite FKs/RLS/PII/anon denial, same-number WhatsApp contact separation, actual merge→split phone context. Existing suite covers information/request/typed confirmation guards; static assertions do not replace SQL evidence.

Initial failures: disposable setup timeout retained as failed attempt; first full261 run failed over-escaped phone regexp/capture VM missing actual dependency, corrected; lint apostrophes and preview missing section prop corrected. Final264 pass after fixes. No skipped check counted passing.

## Migration and recovery

Two additive frozen migrations in CH9_LOCAL_UPGRADE.md, applied ONLY owned LOCAL15437 schema104→106; no shared/prod SQL. Native pre144/post145-table restores/rehearsal/data/ACL PASS; all144 prior table row manifests preserved. Same-cluster evidence only, not complete disaster recovery.

## Native provider and actual website browser

Pinned owned local Chatwoot4.18 native callbacks PASS4/4, report outputs/chat-local/ch9-native-report.json:
A901 conversation39/message282 and B902 conversation13/message285, same synthetic phone but separate contacts/leads, one unverified claim/private mock suggestion each, zero customer/public bot reply/cost. Two actual SafeFetch callback replays preserve one claim. These initial fixtures were API/Rails created, not browser pre-chat.

Separate actual delivered installation snippet runs on local snapshot-only /ch9-widget-test.html. Fresh top-level127.0.0.1 visitor:
- Temporary optional-name/phone pre-chat form enabled only local inbox901; exact original two-field config backed up, fingerprinted and restored with concurrent-change refusal (ch9-prechat-restore.log PASS).
- Browser submitted CH9 Browser Synthetic, synthetic phone +919000000006 and opening-hours question.
- Native conversation40/message290 → contact8476912b-18d7-4d38-b25a-1c447bf32f23, lead95ba955f-feec-44c5-88ce-61c4cf844a34, private suggestion293.
- Before staff approval: browser-widget-report PASS3 checks, one private suggestion, zero public bot replies/cost.
- Clicked Send as is only in this synthetic conversation. Actual visitor received public reply294. Authenticated sent ledger matches owner_admin/run/receipt exactly; approved report PASS4 checks. This public reply is intentionally classified bot for draft-use analytics by the existing authenticated provenance contract. It is staff-approved, not an autonomous send or a first direct-human reply.
- Initial after-send QA assertion incorrectly still expected zero bot rows/staff classification; pinned existing SQL reviewed, corrected assertion now requires exactly one approved receipt. No runtime behavior changed to satisfy the helper.
- OS PLUS lead and visitor/private/public screens inspected. No arbitrary human audio/model, real number/channel or external message used.

Old local HMR widget request failed; verified owned app ancestry then clean422-source snapshot app-1793156691405 fixed it. No service timeout weakening. Early widget clicks under the pending browser prompt failed; actual reloaded widget/pre-chat/send flow afterward confirmed. Owner’s original localhost visitor conversation6/history untouched.

## Browser roles, tenants and layouts

Retained real Clerk owner-a session. Effective local manager: owner settings redirects/denies, claim visible with PII. Viewer leads-only: contact/details/claim masked, no Chatwoot/edit; separately granted PII: Unverified phone visible read-only; finance contact404. Exact original membership/grants restored; no independent persona login claim.

Normal A→B→A selector PASS. B copied A contact404, own same-phone claim visible, only B mapped website inbox/code. Stale B website Get code after A selection refused and old code removed; server pre/postnetwork scope tests also pass.

Overview desktop and authenticated three375-CSSpx-wide iframe layouts inspected (overview/website/contact). Each inner html clientWidth356/scrollWidth356 due scrollbar, no horizontal overflow. Browser viewport override requested375 yielded actual469CSSpx, so that earlier capture is NOT375 proof; override reset, exact-width frames provide narrow-layout evidence. No physical-phone claim. Screenshots under C:/Users/abhij/OneDrive/Documents/New project 2/outputs/chat-ch9-browser.

Business publishedv4 loads into labelled fields/advanced disclosure. Synthetic unsaved hours triggered warning. Earlier browser dialog getter returned undefined and focus/close timed out; later tab progressed during effective-role QA. Final autonomous retry in a clean tab exposed the documented confirm dialog: dismissed it, verified the exact temporary hours text remained, restored original hours, accepted discard and verified Website navigation. Invalid JSON save then showed a safe validation error, retained the exact invalid input and DOM dirty/preserve flags; original JSON restored and discarded without saving. C9-L2 is now engineering PASS; no owner repetition required. No synthetic knowledge change was saved/published. Known stale data/header in old tabs remains until refresh; actions bind displayed tenant.

## Regression, review and remaining gate

Boutique TierB PASS and read-only retained integrity11/11, CH9_BOUTIQUE_QA.md. Workbook only3 evidence cells changed, SHA947bfce6e3e8d08d4ddc2b26c7dc38e5465c4053e5e8447feaec80a653aa5549. Artifact author process native cleanup exit failure documented there; independently validated file/format/history correct.

Two-axis read-only Spec/Standards reviews fixed contact merge/split projection, unsaved form integration and stale ID-less role grant. Focused rereviews found no residual concrete P0/P1/P2. Final lint rerun PASS0warnings, six new QA helper syntax checks PASS, all422 running snapshot/source hashes match, frozen2SQL/workbook hashes and git whitespace check PASS. No known confirmed new product defect; previously unverified manual Cancel case is now verified autonomously, with no product/runtime change needed.

Owner acceptance pending; earlier live-gate exceptions do not waive CH9 checks. Real model/STT adapters/selection/privacy/cost/accuracy, judge/Telegram, Meta/two phones, domain/server, SSO restrictions/one-login and new isolated n8n runtime/activation remain unexecuted/release-blocking. CH10 bench/leakage/failure drills/second-tenant runbook/release review still required. Feature model/API/STT spendUSD0. No purchases/downloads/public tunnel/real message/sharedSQL/push/merge/deployment or workflow activation.

Next: owner review of the ordinary Chats→Leads journey and local product acceptance; then authorized local commit before CH10 planning. No technical settings checklist is required from the owner. Production deployment needs concrete separate authority and comparison against then-current released main; never overwrite newer Shopify work.

## Final current file manifest

```text
docs_chat/05_Phase_Plan_WBS.md
docs_chat/06_Decision_Log.md
docs_chat/CH9_BOUTIQUE_QA.md
docs_chat/CH9_IMPLEMENTATION_PLAN.md
docs_chat/CH9_LOCAL_UPGRADE.md
docs_chat/CH9_OWNER_ACCEPTANCE.md
docs_chat/CH9_QA.md
docs_chat/CHECKLIST.md
docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx
docs/agents/domain.md
docs/agents/issue-tracker.md
project_summary.md
scripts/chat-local/ch9-browser-assertions.mjs
scripts/chat-local/ch9-browser-role.mjs
scripts/chat-local/ch9-final-assertions.mjs
scripts/chat-local/ch9-viewer-grants.mjs
scripts/chat-local/sync-ch9-snapshot.mjs
scripts/chat-local/upgrade-ch9.mjs
scripts/chat-preview/app/page.tsx
scripts/chatwoot-local/ch9-prechat-qa.mjs
scripts/chatwoot-local/ch9-qa.mjs
scripts/test-chat-capture.mjs
scripts/test-chat-page.mjs
scripts/test-chat-website-client.mjs
scripts/test-chat-website-rules.mjs
scripts/test-chat-website-runtime.mjs
scripts/test-chat-website-settings.mjs
src/app/(tenant)/leads/contacts/[contactId]/page.tsx
src/app/(tenant)/settings/chat/page.tsx
src/components/chat/action-settings.tsx
src/components/chat/knowledge-editor.tsx
src/components/chat/notification-settings.tsx
src/components/chat/settings-overview.tsx
src/components/chat/setup-form.tsx
src/components/chat/setup-panel.tsx
src/components/chat/voice-settings.tsx
src/components/chat/website-widget.tsx
src/features/chat/actions.ts
src/features/chat/capture.ts
src/features/chat/settings-navigation.ts
src/features/chat/website/actions.ts
src/features/chat/website/queries.ts
src/features/chat/website/rules.ts
src/features/leads/queries.ts
src/integrations/chatwoot/admin-client.ts
supabase/migrations/20261028100000_chat_website_phone_claims.sql
supabase/migrations/20261028101000_chat_website_claim_reads.sql
```


## Final autonomous handoff confirmation
28 October2026: both discard navigations observed; temporary QA tab30 closed. Read-only native SQL confirms exactly versions1draft/2archived/3archived/4published and exact original hours remain. No draft/publication created by validation tests. All engineering checks complete; earlier owner C9-L2 request withdrawn after successful autonomous verification. Only owner product acceptance remains. Original three user tabs preserved, A owner session restored; actual visitor and conversation40 retained for a simple ordinary-flow review.

## Local acceptance and closure gate — 28 October2026
CHAT-D059 explicitly accepts reported local CH9 and authorizes local commit, then CH10 planning/local checks. All local scope/automated/manual/tenant/TierB/migration/diff gates complete; no known P0/P1/P2. READY_FOR_CLOSURE LOCAL; final staged manifest/checks preceding commit. Earlier pending owner references are historical. Final source422/frozenSQL2/workbook hashes and existing sixgate logs rechecked for documentation-only closure; no redundant runtime execution claim. Commit SHA recorded in root summary after successful local commit. No external release/live action.
