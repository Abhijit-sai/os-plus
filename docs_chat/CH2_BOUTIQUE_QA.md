# CH-2 local Boutique regression — 2026-10-21

Result: 14/14 critical paths from docs_v2/10 §7 passed in the local owner scenario, with scope qualifications below. This does not recertify every older workbook persona or GST-bearing precondition.

Environment: isolated localhost:4131 OS PLUS / owned local database; desktop in-app browser, owner-a+clerk_test@example.com, Local QA A / Chat Local 1. User supplied the Clerk sign-in. No production data or services used. No mobile rerun in this slice.

| ID | Result and evidence |
|---|---|
| BA-001 | PASS: observed owner-a authenticated session; tenant selector listed A/B; Open business A returned Local QA A dashboard. Fresh Clerk credential entry was not repeated. |
| BA-002 | PASS: created CH2 Regression Customer, exact-name search returned one record. |
| BA-003 | PASS: saved default general and garment measurement Chest 37; selected garment reference for both order items. |
| BA-004 | PASS: created ORD-000002 / CHAT-CH2-BROWSER-QA; total 2000. |
| BA-005 | PASS: top 1200 and skirt 800, different selected workflows. |
| BA-006 | PASS: separate workflow per item; database confirms two instances and four stages. |
| BA-007 | PASS: started QA prepare with Synthetic QA worker and QA workgroup. |
| BA-008 | PASS: completed first item's stage; next stage ready; second item unchanged. |
| BA-009 | PASS: public tracking showed safe item/order statuses; no internal worker, stage, payment or notes. Browser retained authentication; not a fresh anonymous-session test. |
| BA-010 | PASS: one synthetic receipt 300; remaining balance 1700. No money moved. |
| BA-011 | PASS: Finance showed order collection 300 and receivable 1700; aggregate cash-in 550 includes prior 250 fixture. |
| BA-012 | PASS for policy's report-load smoke: GST report loaded; including non-GST showed ORD-000002 with zero tax. GST-bearing calculation/export/filing not tested. |
| BA-013 | PASS: UI queued tracking email dry-run to ch2-qa@example.invalid; persisted dryRun=true, localhost tracking URL and audit. No delivery. |
| BA-014 | PASS: edited notes to “Synthetic CH-2 regression order — edit verified”; detail retained items, workflow, payment and total. |

## Persistence and fixture evidence

Command: node outputs/chat-local/ch2-boutique-assert.mjs — PASS, 7/7 assertion groups after real browser actions. Report: outputs/chat-local/ch2-boutique-browser-report.json. Groups: order edit/total; two distinct workflows; both measurement references; stage progression; exactly one receipt; dry-run queue; queue audit.

Customer: 76e26e61-1ac6-47e3-baae-113b146aadff. Order: 64addc61-ec0f-4286-8ace-d0e861c5b44e. Garment measurement: 4840b203-8059-41e4-9e6f-be7e5daf0760.
Added one alternate synthetic workflow a74f0924-dec4-4713-ade0-3ea9a332d521 and two stage templates in a local transaction via ignored outputs/chat-local/ch2-extra-workflow.mjs. No schema/application changes.

Screenshots: C:/Users/abhij/OneDrive/Documents/New project 2/chat-ch2-evidence/boutique-order.png, boutique-stage.png, boutique-tracking.png, boutique-finance.png, boutique-gst.png. Prior owner-b attempt to access known A order returned404 (boutique-a-denied-for-b.png).

## Limits and defects

All mutation/report checks above used the owner role. Independent Manager and Finance browser sessions were not repeated. Prior role/isolation automation remains separate evidence. The existing workbook's stronger historical persona/GST-bearing requirements are not claimed by this smoke.

Existing P3: measurement modal stays open after successful save; persisted measurement is correct. Accessibility incorrectly reported selection options disabled; actual DOM and normal selection proved enabled, so no product defect was inferred. No Boutique runtime fixes made.

Workbook update attempted through the prescribed artifact tool. Import and 14 dated note edits/export succeeded in a temporary file, but preservation verification detected 1,916 cell-style changes; source workbook was NOT replaced. Rendering also exited1 without an image in two bounded attempts. Historical source workbook remains intact. Reconcile the dated evidence into its notes with a format-preserving writer before phase closure; do not mark new Manager/Finance/GST-bearing tests PASS. Evidence in this document is complete for the 14 owner-scenario critical paths.

## Chatwoot handoff

Owner's new visitor message43 “Hey you” is visible in account901 conversation6 at http://localhost:4141/app/accounts/901/conversations/6. Open All-status conversations to include pending bot-assigned inquiries. A stale session produced list-error toasts; reloading exposed login, existing local owner1 login restored the list, and the same All-status filter passed. No provider code/configuration changed; session expiry is an inference from recovery, not a proven server root cause.

Click Take over, switch composer to Reply (it currently shows Private Note), then reply; compare visitor http://localhost:4142/1. Separate Chatwoot authentication remains expected until SSO. Screenshot: chat-ch2-evidence/your-inquiry.png.

Phase remains CH-2 QA_BLOCKED: local owner acceptance and approved Meta captured-channel/test-inbox evidence remain; QA workbook preservation follow-up also remains. No new migration, deployment, model calls or spend.


## Workbook / public HTTP follow-up — 2026-10-21
Supersedes the workbook blocker above. Correct style-content comparison found zero unintended cell-style changes; prior1916 count was a verifier defect. Artifact previews are valid despite exit1 after rendering and were reviewed. Installed the updated tracker with14 dated evidence notes and fitted rows only. Native package preservation verified: only the exact worksheet part changed, and it normalises identically after removing14 notes/height edits; all other parts byte-identical. Verification report and original backup: C:/Users/abhij/OneDrive/Documents/New project 2/outputs/chat-ch2-workbook. Historical role/GST-bearing results remain historical. No tracker follow-up remains.

Seven persistence groups rerun PASS. Two additional default-Accept anonymous HTTP probes pass (valid200 safe DTO / invalid404 without order details). Explicit browser-like Accept:text/html instead reaches Clerk Development handshake307; fresh anonymous-browser flow remains unclaimed. This extra limitation does not change the earlier actual authenticated-browser critical-path evidence. No runtime changes.
