# CH-1 authenticated local QA — 21 October 2026

Status: **QA_BLOCKED**, pending owner acceptance and the explicit gaps below. This is agent-run local evidence, not hosted acceptance or deployment.

## Environment and identity

- Existing worktree `D:\Develop\os-plus-chat-ch0`, branch `codex/chat-ch1-foundation`, HEAD `24a0af7140c51fd061f2f2054c046a325999a298`. Released Shopify baseline was integrated earlier; its separate hosted OAuth/n8n pending items remain unchanged.
- Actual Next application at http://localhost:4131; isolated owned Docker PostgreSQL/PostgREST/gateway; real Clerk **Development** login `owner-a+clerk_test@example.com`.
- Local QA A / `chat-local-1` and Local QA B / `chat-local-2` are separate synthetic tenants. Local QA Disabled remains off.
- User supplied development keys privately. Verified local identity was added to the local process's superadmin allowlist. Root .env.local was neither copied nor changed. Dry run true, live Chatwoot administration false, provider origins reserved .invalid; no real provider request.
- No new migrations in this browser session. Both CH-1 migrations were already applied only to disposable local databases (73 total repository migrations replayed). No shared migration applied.

## Authenticated Chat checks

| Check | Result and evidence |
|---|---|
| Real login and selection | PASS: verified-email linkage and A/B owner memberships; both dashboards selectable. |
| Brand and branch setup | PASS: actual Next action created Browser QA Inquiry / browser-qa-inquiry and mapped North + South. |
| Knowledge validation and publication | PASS: invalid JSON retained with clear validation; v1 saved and explicitly published; v2 saved as draft while v1 remains published. |
| Viewer grants | PASS: lead viewing saved separately while PII remained denied; default lead denial restored. Finance grants remain denied. |
| Channel guard | PASS: seeded synthetic website channel is draft; sync denied safely in dry run. Mock connector tests cover provider contract; real Chatwoot and authenticated remapping are not claimed. |
| Platform setup | PASS: real locally allowlisted owner accessed platform UI; B prepared pending workspace, disabled/re-enabled module through actual actions; third tenant remains off. No provider account created. |
| Module-off route | PASS after fix: direct settings/chat returns clean 404. Previously rendered an uncaught development error. |
| Tenant switching | PASS: B shows no A brands/drafts; B pending workspace separate from A. |
| Stale-form manager/viewer/finance writes | PASS: real authenticated Next actions rejected all three roles after changing only this local fixture's current membership. |
| Cross-tenant stale form | PASS: disabling A membership while retaining B rejected the A brand write; tenant selector showed A blocked and B available. |
| State restoration | PASS: original active owner memberships restored, rejected brand changes absent; published/draft revisions intact. |
| Narrow layout | DOM-only observation: navigation collapsed, brand editor accessible, no horizontal overflow at measured clientWidth/scrollWidth 401/401. Exact 390px viewport and visual layout are NOT accepted; browser scaling changed the requested size, and screenshots failed/previous capture was blank. Override reset. |

Permission tests used one real Clerk identity with controlled local membership changes; they were not independent logins as manager/viewer/finance/owner-b. The identity stayed locally platform-allowlisted, so these tests do **not** prove denial of platform access for an unallowlisted tenant owner. No Clerk cookies or sessions were fabricated.

One-time pending workspace test URLs were hidden and the unused local credential was retired with an audited rotation after accessibility inspection exposed the synthetic URL. No real endpoint was involved; that URL is no longer usable.

## Boutique Tier A — all 14 local paths passed

| ID | Actual browser result |
|---|---|
| BA-001 | Real Clerk sign-in, A/B tenant selection, restored active owner memberships. |
| BA-002 | Created Browser QA Customer; name search returned exactly that one result. |
| BA-003 | Saved default QA fit reference (Chest 36), selected it on the order, visible on saved item. |
| BA-004 | Created ORD-000001 / CHAT-LOCAL-BROWSER-QA through existing order action. |
| BA-005 | Two distinct items, prices 1000 + 500, saved total 1500. |
| BA-006 | Both items have independent two-stage workflows. |
| BA-007 | Started QA prepare with eligible Synthetic QA worker / QA workgroup. |
| BA-008 | Completed QA prepare; QA finish became ready to start, progress 1/2. |
| BA-009 | Public tracking showed customer-facing item statuses only; no internal worker/stage/notes/payment details. Synthetic “Ready” is a configured public label, not evidence of delivery. |
| BA-010 | Recorded synthetic partial payment 250 via existing form; paid 250, receivable 1250. No money moved. |
| BA-011 | Finance displayed 250 cash-in and ORD-000001 collection, with 1250 order balance. |
| BA-012 | GST report loaded; zero-tax fixture and missing synthetic business GST profile warnings shown as expected. |
| BA-013 | Added reserved browser-qa@example.invalid to synthetic customer; actual UI queued tracking email in dry run. UI history plus DB queued record, dryRun=true and audit log verified. No delivery. |
| BA-014 | Opened existing order and saved notes; confirmed persisted without changing totals. |

Customer ID: `2ae2527d-16bd-4e93-bff6-0ffb77dfddda`. Order ID: `f18f2e92-18fa-40b2-9cc0-9d1180744206`. Data are local synthetic fixtures.

Non-blocking inherited UX observation: the measurement dialog remained open after save, reset some fields and retained custom fields; the measurement was saved correctly. No Boutique behavior changed. Dev navigation sometimes takes 10–30 seconds for cold compilation; this is not hosted performance evidence.

## Fix and automated verification

- `src/features/chat/module.ts`: typed ChatAccessError for expected access denial.
- `src/app/(tenant)/settings/chat/page.tsx`: maps only this error to notFound; unexpected errors are rethrown.
- `scripts/test-chat-page.mjs`: two regression cases added, verified failing before and passing after fix.
- `scripts/chat-db-harness/server-adapter.mjs`: TSX-aware test module compilation.
- `scripts/chat-local/manage.mjs`: reserved local provider origins; existing dry-run/live guards retained.
- Owned running snapshot's two Chat runtime files and recorded hashes refreshed. No environment files copied.

| Command | Result |
|---|---|
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm run build | PASS, 51/51 pages |
| npm run test:roles | PASS, platform route policy + Chat guarded integration |
| npm run test:v2 | PASS, four suites |
| npm run test:chat | PASS, 32/32, zero skipped |

Current logs: `outputs/chat-local/authenticated-*.log`; actual mutation evidence: `authenticated-write-report.json`, `boutique-browser-report.json`. Prior local HTTP QA (8 groups), payment/workflow/order DB smokes, lifecycle checks and real 117-table dump/restore remain recorded in [CH1_LOCAL_QA](CH1_LOCAL_QA.md). They were not rerun just for browser activity. Prior Shopify regressions remain in [CH1_QA](CH1_QA.md).

## Remaining owner steps and limits

1. No more keys are needed. Review the saved local A/B setup and results above using [C1–C8](CH1_LOCAL_QA.md#owner-acceptance-checklist--all-pending).
2. For the independent identity/platform negative check, sign up/sign in as `owner-b+clerk_test@example.com` in the same Clerk Development application, using verification code 424242 and a new test password if required. Do not add owner-b to the superadmin allowlist. Tell Codex when signed in; Codex can test B-only selection, A denial, and platform denial. Password creation stays with the owner.
3. Review the actual setup at desktop and 390px phone viewport (C6). The automation's narrow DOM check and earlier component iframe screenshots do not replace actual visual acceptance; current browser screenshot capture failed.
4. State which C1–C7 results you accept and any failures (C8). Owner acceptance cannot be inferred from “go ahead” to run QA. Final phase review and local commit follow only after required gaps pass.

No CH-2 work, production enablement, push, deploy, shared migrations, real messages, paid model calls or n8n activation. Model/API spend this session **USD 0**.

## Final follow-up and owner acceptance — 21 October 2026

This section supersedes the earlier remaining-check status and 32-test count, preserving that earlier evidence as history.

- Independent real Clerk owner-b login verified: selector exposes only Local QA B / chat-local-2; B setup contains no A brands, pack history or channel; /super-admin/chat-workspaces returns404; copied A order URL returns404. No local membership alteration was needed for this pass.
- Screenshot capture recovered. Actual owner-b app rendered at desktop width and inside a same-origin local-only iframe of390 CSS pixels. The signed-in page's clientWidth/scrollWidth were363/363 (scrollbar gutter); brand form and collapsed navigation visually inspected. This is authenticated iframe responsive evidence, not a full browser/device viewport or physical-phone claim. Disposable wrapper is only in the ignored app snapshot, not shipped source.
- Images: C:/Users/abhij/OneDrive/Documents/New project 2/chat-ch1-evidence/owner-b-desktop.png and owner-b-mobile.png. Earlier blank screenshot is not evidence.
- Final standards/spec review found three P2 issues; all corrected: permission-table query failures now remain safe operational errors; local Docker calls validate a local npipe/unix endpoint and pin it, rejecting remote/TCP/context/argument overrides including Windows casing; malformed multibyte gateway credentials compare byte lengths and cannot crash constant-time comparison.
- New regression cases failed before fixes and passed afterward. Actual loopback HTTP malformed API/control headers returned401/501 and gateway remained healthy200. Remote Docker override was rejected before contacting an engine. Evidence: outputs/chat-local/review-live-check.json.
- Final gates: typecheck PASS, lint PASS, build PASS51/51, roles PASS, V2 four suites PASS, Chat **37/37**, zero skipped. Full gates reran after main fixes; Chat/lint reran after the final Windows-case hardening. No affected runtime source changed after build. Logs final-*.log.
- Both reviewers re-read focused fixes and reported no unresolved actionable code/spec findings. Current documentation status/counts reconciled.
- Owner explicitly accepted: **“Accept CH-1 foundation; continue to CH-2 after final records/checks.”** This accepts the foundation scope and evidence limits described in the question, not a delivered staff inbox/Leads/AI or external release.
- C1–C8 owner acceptance recorded. CH-1 may move to READY_FOR_CLOSURE after final diff hygiene; existing D025 authorizes the local phase commit. No real service or production release authority is implied. No new migrations; no spend.
