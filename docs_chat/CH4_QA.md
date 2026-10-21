# CH-4 QA — local technical evidence complete
Status: READY_FOR_CLOSURE LOCAL under owner acceptance CHAT-D039,2026-10-22; CH4.2 dependency alignment accepted. Branch codex/chat-ch1-foundation, base0d22491. No CH4 commit/deployment/production enablement.

## Built
- Leads inbox/detail with exact scoped counters/pagination, brand/branch/channel/stage/owner/priority filters, clocks/high interest, public conversation mirror/history and versioned audited edits. Existing stored suggestions expose text and recorded knowledge version only.
- Contacts list/detail, exact customer candidates, guarded link/convert through platform rules, native customer/order access checks, reviewed merge and guarded undo. No automatic merging.
- Owner Performance (full filtered population, mapped public staff counts, median first-human time, attention queue), optional explicit reporting schedule and dashboard waiting widget. Missing schedule means unknown, never0.
- Module/role-gated Leads and Chats navigation. Chats opens separate credential-free Chatwoot tab. No SSO or native composer.
- /chat/panel verified Clerk/membership plus exact parent origin and tenant/account/inbox/conversation lookup. Exact public GET is a data-free fallback shell; actions/reads remain authenticated.
- Generation/provenance beyond stored knowledge version and booking actions are CH5/CH6 dependencies, unimplemented here. CH4.2 original WBS wording remains explicitly partial until owner accepts this sequencing. No new business workflow policy.

## Automated gate
All six required commands PASS:
| Command | Evidence |
|---|---|
| npm run typecheck | PASS |
| npm run lint | PASS,0 warnings |
| npm run build | PASS |
| npm run test:roles | PASS,18 exact proxy cases plus platform role checks |
| npm run test:v2 | PASS,four scripts |
| npm run test:chat | latest119/119,0 skipped |
Logs outputs/chat-local/ch4-final-*.log and ch4-final-gate-results.json. The last added draft privacy test changes tests only; affected-file eslint also PASS.
Focused new projection7/7 and actual SQL/read-adapter12/12 are subsets of119.79 real repository migrations replayed only into disposable synthetic PostgreSQL. Two tenants;54-row stable paging/full counters; grants/revoke/module disabled; PII and native customer/order boundaries; public staff vs bot/private metrics; canonical timezone parity; panel mapping; note-only automatic ownership and explicit unassign; exact retry identity; stored draft text/version without model/error/private metadata. No AI-generated draft claim.

Actual local Chatwoot4.18 provider qa.mjs10/10 PASS on this snapshot, accounts901/902, conversations10/5. Synthetic local website/staff/private-note traffic only, no Meta/real external recipients. Public note and label behavior retained.
Anonymous actual HTTP6/6 PASS: exact panel GET200 safe shell, unauthenticated POST/panel suffix/Leads/Contacts/Performance307 to auth. Separate CRM/role/merge/anonymous-tracking persistence5/5 and Boutique persistence7/7 PASS. Counts overlap; do not sum them.

## Migration and recovery
Applied ONLY20261021140000_chat_crm_reads.sql to owned isolated LOCAL PostgreSQL15437. Prior78 migrations not replayed. New read RPC/indexes/internal helper and79 marker transaction; no customer/order/table data rewrite. All128 existing public table counts/content hashes unchanged.
Native pre-upgrade dump1388707bytes restored to chat_restore_37be4fac6897; post-upgrade1408646bytes restored to chat_restore_d757e3abf1eb. Full manifests and restored anon/authenticated ACL denials PASS.
See CH4_LOCAL_UPGRADE.md and private outputs/chat-local/ch4-upgrade-report.json. Same-cluster DB restore only. No shared/hosted SQL.

## Actual browser / roles
In-app browser, retained real Clerk owner-a session, local app4131 snapshot app-1792608784756. No new keys or credential entry.
Owner: inbox/detail/public mirror, note save, contact conversion, incompatible-customer merge rejection, compatible synthetic merge/undo, Performance and waiting dashboard all pass. Exact-name native customer search passes.
Role checks used reversible effective membership changes in synthetic Local QA A, not independent Clerk role accounts. Manager reads/edits and report404. Viewer default/revoked404; explicit view grant masks customer/free text in actual rendered HTML/RSC, no edit/Chatwoot; PIIgrant exposes contacts but no native customer/orders/manage/reports/Chatwoot. Finance default denial and explicitly granted masked view pass. Original owner role and grant policy values restored. QA changed fixture timestamps; not a byte-identical row-metadata restore.
Real selector A->B->A: B copied A lead and new Boutique order404. Actual Chats launcher retains OS PLUS tab, target_blank/noopener and opens account901 in a separate Chatwoot tab.

## Dashboard App session
Created only LOCAL account901 DashboardApp1, OS PLUS Leads — Local QA, URL http://localhost:4131/chat/panel. Initial real frame reuses Clerk session and resolves conversation10 to lead55715c4c-8fa6-4302-92d6-4f8720f320ce.
Owner replied "saved"; SQL verifies in_progress, explicit manual owner, note"inquired", stage/assigned/note audit. Do not claim two saves from that reply. Fresh launcher/card reload after restoring businessA shows the saved values.
After temporary role/business changes, frame safely falls back with no enquiry data. Refresh Chatwoot after selecting the matching OS PLUS business to obtain fresh context. Cross-origin session persistence for every browser/deployment is not guaranteed; safe new-tab fallback is required and tested.
Automation cannot activate the enabled cross-origin frame button (target/focus root unavailable); owner-assisted save supplies the actual mutation evidence. Normal and same-origin narrow forms save automatically.

## Layout / accessibility
Desktop plus authenticated same-origin375px outer frame (356px content after scrollbar): Leads, detail/edit, Contacts, Performance; scrollWidth equals clientWidth, no horizontal overflow, mobile nav opens/closes, labelled controls and readable stacked content, actual narrow note save PASS. Not physical-device, independent screen-reader or every-browser certification.
Screenshots C:/Users/abhij/OneDrive/Documents/New project 2/chat-ch4-evidence, including saved card, Leads, masked viewer, narrow views, tenant denial and Boutique.

## Regression / review / owner gate
Boutique TierA14/14 owner scenario, persistence7/7; exact results/limits/workbook in CH4_BOUTIQUE_QA.md. Existing P3 measurement dialog remains open after success; saved once, manually closed. No new P0/P1 unresolved.
Five review P2s fixed: note editing must not set manual ownership; truthful closed/unanswered label; full attention-queue scope; inline ambiguous transport retry; named timezone/SQL parity. Focused spec/standards rereviews clear; reviewers did not run services/tests.
QA workbook14 dated notes appended, historical statuses/personas retained, only sheet3 XML changes; all other package parts byte-identical, three previews visually reviewed. Artifact runtime exits1 after successful export/previews; separate native package/value/style checks PASS. No Excel engine recalculation claim.
Owner phase acceptance still pending: CH4_OWNER_ACCEPTANCE.md C4-L1–L5, CHECKLIST PartC. Existing card "saved" is action evidence, not full phase acceptance. CH4 cannot be marked READY_FOR_CLOSURE/committed yet. Carry Meta/two-real-phone release blocker under D038; separate Shopify hosted OAuth/renewal and n8n remain pending. No purchases, shared SQL, real external messages, public tunnel, push/merge/deployment or model calls. Model/API spendUSD0.


## Accepted closure checkpoint —2026-10-22
CHAT-D039 satisfies the full owner C4-L1–L5 gate, including generated provenance CH5 and booking CH6 sequencing. Earlier pending-gate statements above are superseded. READY_FOR_CLOSURE LOCAL; final local commit next. External release blockers remain unchanged.
