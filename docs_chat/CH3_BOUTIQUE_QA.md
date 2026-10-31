# CH-3 post-upgrade Boutique regression — 2026-10-21
Result: 14/14 Tier A critical paths from docs_v2/10 §7 PASS within the local owner scenario. No Boutique runtime changes.

Environment: isolated localhost4131 app, owned LOCAL DB15437 after CH-3 upgrade, in-app browser desktop. Existing real Clerk owner-a session continued, Local QA A/Chat Local1. No fresh credential-entry claim. Selected B and returned A through the actual selector; B denied copied A order404.

| ID | Actual result |
|---|---|
| BA-001 | Existing owner-a authentication retained; selector A/B; opened B dashboard then restored A. |
| BA-002 | Created CH3 Regression Customer; exact-name search returns one result. |
| BA-003 | Saved default CH3 garment fit, QA garment, Chest38; selected on both items and visible after save. |
| BA-004 | Created ORD-000003 / CHAT-CH3-BROWSER-QA, total2000. |
| BA-005 | CH3 top1200 and CH3 skirt800, different selected workflows. |
| BA-006 | Two independent workflow instances/four stages persisted. |
| BA-007 | Started QA prepare with Synthetic QA worker and QA workgroup. |
| BA-008 | Completed top's first stage; QA finish ready; skirt unchanged. |
| BA-009 | Actual tracking renders public order/item statuses; no internal stage/worker/payment/notes. Browser retained authentication; not a fresh anonymous-browser claim. |
| BA-010 | Exactly one synthetic payment300, outstanding1700; no money moved. |
| BA-011 | Finance shows ORD-000003 collection300/receivable1700. Aggregate cash850 includes prior250+300 fixtures. |
| BA-012 | GST report loads; Include non-GST shows ORD-000003 with zero GST. No GST-bearing calculation, export or filing claim. |
| BA-013 | UI queues tracking email to ch3-qa@example.invalid; persisted dryRun=true, localhost URL and audit, no delivery. |
| BA-014 | Edited notes to Synthetic CH-3 regression order — edit verified; payment/items/measurements/workflow/total preserved. |

## Persistence and evidence
Customer36f5f894-f87d-4cb9-8d5c-539b8fcfa55d; order7a5e1a54-09a3-4c22-983c-019482c3147c; top5db3f096-4c8c-47af-b717-c39f8dab201b; skirt923e2546-44c0-4d31-beb1-23026bab6bb2.
node outputs/chat-local/ch3-boutique-assert.mjs PASS7/7 read-only persistence groups after actual browser actions; report outputs/chat-local/ch3-boutique-browser-report.json.
Screenshots C:/Users/abhij/OneDrive/Documents/New project 2/chat-ch3-evidence/: boutique-order.png, boutique-finance.png, boutique-gst.png, boutique-tracking.png, tenant-b-order-denied.png.
Existing CH2 customer/order/workflows preserved; reused synthetic workflow templates rather than changing production definitions.

## Responsive and role scope
Actual owner setup rendered at desktop and in an authenticated same-origin390px iframe. Navigation opened/closed; content scroll reaches channel/access controls without clipped text or horizontal overflow in reviewed screenshots. Evidence chat-desktop.png, chat-narrow.png, chat-narrow-nav.png, chat-narrow-controls.png in the same directory. Wrapper exists only in ignored app snapshot public/local-qa-responsive.html. This is a layout smoke, not physical-device or independent role-login evidence.
Independent manager/finance browser sessions were not repeated; real guard/RPC/role and tenant-isolation automation remain separate evidence. No claim to recertify workbook's stronger historical personas/GST-bearing preconditions.

## QA workbook
Updated docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx with14 CH-3 dated notes, preserving prior CH2/history/persona status. Authored/imported/rendered with bundled artifact tool; then transferred authored notes into original XLSX package to preserve native features. Only sheet3.xml changed; normalizes exactly after removing14 notes/row-height260 edits; all other package parts byte-identical. Changed views first/middle/last visually reviewed, notes legible. Private original/checksums/preservation-report.json in C:/Users/abhij/OneDrive/Documents/New project 2/outputs/chat-ch3-workbook. Artifact process returned1 after EXPORTED/PREVIEWS_SAVED; actual output/PNG files valid and preservation verification PASS. No Excel interactive/native recalculation claim for this text-only edit.

## Defects and phase
Existing P3 measurement dialog stays open after successful save; persistence correct, owner may close it. No new P0/P1 found. A browser tab entered network-suspended error during receipt refresh; fresh tab same local URL recovered and showed exactly one saved receipt. No repeat receipt submitted. Scoped localhost bridge addresses IPv4/IPv6 connectivity; no auth/security bypass.
CH-3 local technical results await owner acceptance and an explicit local-only exception to the two-real-phone/Meta gate. No phase commit or CH-4 start.
