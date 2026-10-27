# CH-6 Boutique regression
Executed 2026-10-24; records reconciled 2026-10-27. COMPLETE LOCAL:14/14 TierA,7/7 read-only persistence assertions. In-app browser, retained real Clerk owner-a / Local QA A, current-source snapshot app-1792779888152 plus reviewed CH6 UI corrections. No production tenant/database data.

|ID|Actually executed|
|---|---|
|BA-001|Retained sign-in, actual business selector A→B→A. B cannot open copied new A order, customer or lead URLs (404). No fresh credential-entry claim.|
|BA-002|Native form created CH6 Boutique Regression Customer; exact name search returns one result.|
|BA-003|Saved default CH6 garment fit, QA garment, Chest38. Selected/retained on both new items.|
|BA-004|Created ORD-000006 / CHAT-CH6-BROWSER-QA, total2000.|
|BA-005|CH6 top1200 and CH6 skirt800, distinct existing workflows.|
|BA-006|Two independent workflow instances, four stage instances persisted.|
|BA-007|Started QA prepare with Synthetic QA worker and eligible QA workgroup.|
|BA-008|Completed top first stage; QA finish ready; skirt unchanged.|
|BA-009|Actual public tracking shows safe public statuses. Separate anonymous HTTP200 excludes internal stages/worker/notes/receipt-reference/email.|
|BA-010|Exactly one synthetic QA cash receipt300, balance1700. No money moved.|
|BA-011|Finance shows ORD-000006 collection300 and balance1700; aggregate1750 includes prior retained fixtures.|
|BA-012|GST report loads; Include non-GST contains new order with0GST. No GST-bearing calculation/export/filing acceptance.|
|BA-013|Native UI tracking email queued dry-run only to ch6-qa@example.invalid; dryRun flag and queued audit persisted. No delivery.|
|BA-014|Edited note to Synthetic CH6 Boutique regression order — edit verified; total/payment/items/fit/workflow preserved.|

Customer034162ac-5309-4146-91c6-931fd55aae6e; order56df039f-e6f1-494b-bb4c-be52ad85bbbf; measurementfbd2dba4-cbb8-4424-a36e-42440f4b5777; topd3837b0f-a61a-44fe-8b0f-4553582e5c86; skirtd0a70fa2-5c3c-46f7-9488-6ee155356fe1.
Read-only outputs/chat-local/ch6-boutique-assert.mjs7/7 and ch6-boutique-browser-report.json. Additional ch6-browser-assert.mjs4/4 covers provisional request, manager task persistence, exact original role/grant restoration and anonymous tracking. Counts describe distinct checks with overlapping safety claims, not extra unique Chat tests.
Screenshots C:/Users/abhij/OneDrive/Documents/New project 2/chat-ch6-evidence/boutique-{order,finance,gst,tracking}.png and tenant-b-{order,lead}-denied.png.
Known baselineP3 measurement success dialog stays open; manually closed. Historical dashboard midnight timezone issue remains outside Chat scope (CH5_BOUTIQUE_QA.md); no shared Boutique runtime changes made. Not independent persona sign-ins, physical-device or full GST acceptance.

## Workbook
Updated existing docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx: L2:L15 remainPASS; M2:M15 current exact results; N2:N15 prepend dated CH6 evidence and preserve prior notes plus former actual results. N width38→68 so accumulated history fits existing409.5pt rows. No row/tab/formula/style/validation/table/pane changes.
Artifact import/edit/recalculate/inspect/formula-error scan/export and first/middle/last visual previews executed. Bundled exporter exits1 after successful export/render, so independent package/value/style/preservation checks verify saved output; not an unqualified processPASS or Excel recalculation claim.
Only xl/worksheets/sheet3.xml changed; removing28 value edits and one notes-width edit normalizes exactly to baseline. Every other ZIP member byte-identical. SHA256706574901efc9f6b03c48400acef77a33307172bb94930f6dc6f7923a16eb8ec. Source checked against baseline immediately before replacement.
Support evidence in workspace outputs/chat-ch6-workbook; final repository workbook hash independently verified. Historical persona/preconditions retained, not recertified as independent role logins.
