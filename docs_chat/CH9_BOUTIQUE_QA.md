# CH-9 Boutique regression — 28 October 2026

Required Tier B under docs_v2/10. Chat-owned settings/contact projection changed; shared app shell, tenant/permission helpers, customer/order/payment/workflow runtime were not changed.

Retained real Clerk owner-a session, synthetic Local QA A, in-app browser desktop. Effective-role tests reuse this identity; no independent persona credentials or fresh Clerk login claim.

| Check | Actual result |
|---|---|
|BA-001 retained login and tenant selection|PASS: normal A→B→A selector; B copied A contact404, own contact allowed. Original owner role/grants restored.|
|BA-014 order detail/editor|PASS: ORD-000006 (56df039f-e6f1-494b-bb4c-be52ad85bbbf) opened; editor opened and closed without edits/save.|
|Production|PASS: retained top/skirt rows, separate workflows, completed first top stage and ready next stage visible. No production mutation.|
|BA-009 public tracking|PASS: two items/customer-safe statuses visible. Separate anonymous HTTP200 omits internal stage, worker, notes, receipt reference and email.|
|Read-only retained SQL|PASS: total2000, exactly one previous receipt300, balance1700, two workflows, same measurement and four stage instances preserved.|

Read-only helper scripts/chat-local/ch9-final-assertions.mjs PASS11/11 adds frozen CH9 hashes/native restore metadata and two unverified website fixture integrity checks. These are not eleven browser test cases. Source report outputs/chat-local/ch9-final-assert-report.json. Final run must occur after role/settings restoration. No new receipt, customer, Boutique order, workflow or communication send was created.

Screenshots C:/Users/abhij/OneDrive/Documents/New project 2/outputs/chat-ch9-browser/boutique-{order,edit,production,tracking}.png. Initial cold order navigation timed out; subsequently loaded final screen and editor confirmed. Initial semantic Edit target reported invisible; current AX control opened it successfully. Failed attempts are not passing evidence.

Workbook updated only Boutique Regression N2/N10/N15 evidence text, retaining all prior actual/status/history/style/layout and other package bytes. Artifact Tool import/authorship/recalculation/error scan0/export/render and visual review completed; package preservation verified separately. Bundled Node exited abnormally during native cleanup after writing outputs (exit -1073740791); output validation succeeded, no clean author-process exit claimed. No native Excel engine was run; no formulas changed.
Final SHA256947bfce6e3e8d08d4ddc2b26c7dc38e5465c4053e5e8447feaec80a653aa5549. Preservation report C:/Users/abhij/OneDrive/Documents/New project 2/outputs/chat-ch9-workbook/preservation-report.json, only xl/worksheets/sheet3.xml differs and normalizes exactly after replacing three notes values. Not a new full14/14 Tier A run. Separate Shopify OAuth/renewal acceptance and owner-deferred existing n8n remain pending.
