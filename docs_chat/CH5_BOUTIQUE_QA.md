# CH-5 Boutique regression —2026-10-22
Status: COMPLETE LOCAL,14/14 owner scenario plus7/7 persistence. App4131 snapshot app-1792654429903, owned isolated PostgreSQL15437, retained real Clerk owner-a/Local QA A. No production data. This fresh run supersedes use of CH4 evidence for CH5.
|ID|Actual result|
|---|---|
|BA-001|Existing sign-in retained; actual A->B->A selector; B copied A new lead and new order404. No fresh credential-entry claim.|
|BA-002|Native Customers form created CH5 Boutique Regression Customer; exact-name search returns one result.|
|BA-003|Saved default CH5 garment fit for QA garment,Chest38; selected and retained on both items.|
|BA-004|Created ORD-000005 / CHAT-CH5-BROWSER-QA,total2000.|
|BA-005|CH5 top1200 and CH5 skirt800, distinct existing workflows.|
|BA-006|Two independent workflow instances,four stages persisted.|
|BA-007|Started QA prepare using Synthetic QA worker and eligible QA workgroup.|
|BA-008|Completed top first stage; QA finish ready; skirt unchanged.|
|BA-009|Actual tracking UI public-only status; independent anonymous HTTP200 excludes internal stage/worker/notes/receipt-reference/email.|
|BA-010|Exactly one synthetic QA cash receipt300,balance1700. No money moved.|
|BA-011|Finance shows ORD-000005 collection300/balance1700; aggregate1450 includes prior fixtures.|
|BA-012|GST report loads; Include non-GST includes new order,0GST. No GST-bearing calculation/export/filing claim.|
|BA-013|UI tracking email queued dry-run only to ch5-qa@example.invalid; dryRun=true and queued audit persisted. No delivery.|
|BA-014|Edited note to Synthetic CH5 Boutique regression order — edit verified; payment,total,items,measurement and production preserved.|

Customerf1a779a6-beb3-4577-ac3c-93dc5080c2eb; order01a9ae50-20b8-4deb-a9fa-34aa4dbb1780; top6b672afe-9208-4150-b678-6c81a516427d; skirt9060d5ab-2e4a-468b-ae6d-ebebef284851.
Read-only outputs/chat-local/ch5-boutique-assert.mjs PASS7/7, ch5-boutique-browser-report.json; HTTP ingress/tracking7/7 in ch5-http-report.json (overlapping claims,do not sum). Screenshots C:/Users/abhij/OneDrive/Documents/New project 2/chat-ch5-evidence/boutique-{order,finance,gst,tracking}.png and tenant-b-order-denied.png.
Existing P3 measurement dialog remains after successful save, manually closed once. Boutique runtime rules were not changed. No independent Boutique role sign-ins/physical-device/full GST acceptance inferred.

## QA workbook
Updated existing docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx with14 appended dated CH5 owner evidence notes N2:N15; historical statuses/results/personas retained. Only row2–15 heights409.5pt adjusted for readable history. Artifact import/export and first/middle/last previews visually reviewed. Saved export produced despite known runtime exit1; independent native package/value/style/preservation checks PASS, not an unqualified process PASS.
Only xl/worksheets/sheet3.xml changed; it normalizes exactly after removing14 note/height edits. Every other package part byte-identical, unrelated formulas/styles/merges/tables/validations/panes/widths retained. Source verified before copy. Final SHA2560E8BE846FE4FCB1A018D9FC35C32E9F977E9087F53920F67FB8F12BD83B65B60.
Private builder/baseline/authored/final/previews/preservation-report.json in C:/Users/abhij/OneDrive/Documents/New project 2/outputs/chat-ch5-workbook. No interactive Excel/native recalculation certification.


## Separately observed existing dashboard issue
P2,not introduced by CH5: Dashboard Today cash shows prior-day1150 while Finance correctly shows new300 collection and monthtotal1450. Reproduced local2026-10-22 Asia/Calcutta midnight -> dashboard key2026-10-21 because unchanged dashboard/page.tsx toIsoDate uses toISOString().slice(0,10). Verified same function at baselinef9d195c and no diff to that file. Deferred outside Chat scope under owner instruction not to alter Boutique behavior; native receipt/Finance/14 defined TierA checks still pass. This is not a claim that every dashboard/date calculation is correct.
