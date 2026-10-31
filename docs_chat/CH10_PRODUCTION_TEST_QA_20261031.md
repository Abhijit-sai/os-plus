# Production Test QA - 31 October 2026

Status: all-off application deployed; native Owner/Admin Test regression exercised. Full hosted acceptance remains incomplete. CH10 engineering is CLOSED LOCAL under CHAT-D072. This report is evidence, not tenant activation authority.

## Exact scope

- Authority: CHAT-D073 and owner resume. Production643cf10e7ed7f340f0614b598f23468c12988d6c / VercelBd6qVpC3G9vTTFF8R9qvrdjVcqU4, https://os-plus.vercel.app/.
- Only Phantom Threads Test, tenant7be40f50-94a0-46c5-af57-7eea5e36ea8a. Owner signed in personally in the in-app browser; actual Test header and Owner/Admin role observed. Clerk sign-in displayed Development mode; configuration unchanged.
- Native UI writes only to our labelled synthetic fixtures. No real tenant, employee membership, source Shopify record, provider channel, credentials, workflow activation, money transfer or SQL write.
- Chat/Leads navigation absent; authenticated /settings/chat and /leads return404. Settings has no Chat entry. Global module/workspace/channel rows remain0. No Chat activation.

## Saved fixtures

| Record | Result |
|---|---|
| Customer | Chat Release QA 20261031;9450b8f2-8514-43b9-a3b1-62f03474224e; blank phone, example.invalid email; search finds one matching record |
| Measurement | f77e1cb8-a99b-4689-b4eb-a2179e519522; CHAT-REL-20261031 fit, Shirt, Chest38in |
| Order | ORD-000032;feb236b7-b28e-48b2-a798-92229f484d0d; native walk-in, reference CHAT-REL-20261031; notes clearly synthetic |
| Shirt | e7f9b0d9-faa9-4e31-a088-92a8280e846e;1200;Default5stages; saved measurement linked; persisted in SQL and reopened native editor |
| Pant | 2a4ef4e1-5458-4974-9b57-608cd7cbad79;800;Painting1 seven stages; untouched by Shirt execution |
| Arithmetic | Existing18percent GST added on top: taxable2000/GST360/total2360; no company/GST setting changed |
| Payment | One Other-mode synthetic bookkeeping receipt300, marker CHAT-REL-20261031; no money moved; balance2060/partiallypaid |
| Stage | Shirt Design started with existing eligible Test worker/role, then completed; Cutting ready; later Shirt stages not started. Rate not configured/contribution0. No wage payment or employee change |
| Edit | Native order note saved; amount/receipt/workflow facts retained. Native item edit attached measurement; reopened editor retains it |
| Dry-run queue | One email record3f140dba-653f-4ee6-a2ac-ca09db3c0e08 to synthetic example.invalid; dryRun=true/sent=false/attempts0/no provider message ID |

No fixtures were deleted. Preserve them for the remaining Test acceptance. Native pending/disabled feedback observed; no blind resubmission.

## Browser acceptance matrix

| Case | Fresh result | Limit |
|---|---|---|
| BA-001 | PASS owner-performed sign-in and exact Test dashboard | Independent roles, tenant switch/revocation not tested |
| BA-002 | PASS customer create/search | Synthetic fixture only |
| BA-003 | PASS measurement create/link/reopen/persistence | No new measurement standards or default setting |
| BA-004 | PASS native order creation | One synthetic native order |
| BA-005 | PASS two persisted items | No extra imported order created |
| BA-006 | PASS distinct item workflows | Default5/Painting1 seven stages |
| BA-007 | PASS eligible assigned stage start | Existing Test worker, rate absent/contribution0 |
| BA-008 | PASS completion/next ready/other item unchanged | No final delivery transition exercised |
| BA-009 | PARTIAL public tracking view/privacy | Observed safe public view, no internal notes/worker/measurement. Browser retained sign-in; separate cookie-free anonymous certification and final delivery not performed |
| BA-010 | PASS partial payment record/persistence | Synthetic bookkeeping; no financial transfer |
| BA-011 | PASS Finance receipt and outstanding | New ORD-000032300receipt/2060balance visible |
| BA-012 | PASS GST report | October report shows one GST order, taxable2000/GST360; accountant/legal acceptance not implied |
| BA-013 | PASS native dry-run queue and read-only delivery-state verification | No live email/WhatsApp send |
| BA-014 | PASS note edit and saved measurement reopen | Editor briefly showed prior default after successful save; record and reopened select correct. No second save issued; repeated-save behavior untested |

Actual mobile override390x844 observed innerWidth390/clientWidth375/scrollWidth375 for public synthetic tracking and unsaved order builder with Shirt fit-reference controls. Screenshot-visible controls fit; no horizontal overflow in this slice. Override reset. This is not full device/persona/staff Chatwoot certification.

## Shopify evidence and correction

The absent new OAuth row is NOT proof of missing Test import authorization. Released tenant-credentials.ts explicitly preserves the legacy Test credential path before an OAuth credential has been stored. Read-only released reference docs48/49 corroborate this. Previous records describing OAuth absence as an import blocker were too strong; retain those dated observations and use this correction for current status.

Fresh authenticated native preview17-20October2026 inclusive India time succeeds:14found,0new,14already present,0needs review. Import0new was not clicked. This proves current source read and duplicate preview behavior, not a fresh new import/resume or hosted OAuth activation. Preview can persist its bounded temporary snapshot through the normal application; it is not a business-record import or source modification.

Retained pending Shopify draft opens on current production: draft-needs-setup, Shopify net payment is explicitly not a local receipt, observation is not a live Shopify balance, product/quantity/price are source facts, complete setup creates no receipt/message. No Save draft/Complete setup clicked. No real customer PII, tracking capability URLs or source-order monetary details copied into this repository report. Same-store real-tenant cutover and OAuth activation remain separate; automatic sync/n8n stayoff.

## Verification and preservation

Protected TLS-verified REPEATABLE READ READ ONLY checks, using unchanged DPAPI/ACL/project/CA safeguards:

- Before baseline07:37:55.825UTC; new-fixture snapshot07:46:44.856UTC; after-integrity07:49:48.009UTC.
- Existing16/16 Test invariants PASS after writes:8ownership joins0errors,2amount errors0, retained ORD-000012 unchanged4items/1652total/300paid/1352balance, Test binding/storage privileges preserved, Chat alloff.
- Separate16/16 saved-fixture assertions PASS. These groups overlap; no combined unique total and no claim of authenticated RLS/persona denial from service-role reads.
- Count changes match our native fixtures: customer+1/order+1/items+2/payment+1/workflows+2/stages+12; Shopify orders unchanged15. Count comparison is not a cryptographic before/after proof of every unrelated business row.
- Current remote main reverified643cf10.535app/config/SQL hashes and106canonical migration byte hashes preserved. No source/env/migration change;35alreadyowner-applied, none reapplied.
- No six-platform-gate rerun for documentation/UI-only evidence. Prior actual typecheck/lint/build/roles/V2 and315Chat/7atomic remain dated evidence.

Evidence outsideGit: outputs/ch10-release-20261030/interactive-qa-20261031/{plan.json,before.json,fixture-after-native.json,after-integrity.json,results.json}, guarded read-only runners/SQL. Safe synthetic screenshots outsideGit in the current visualization directory: release-qa-customer-20261031.png, release-qa-order-20261031.png, release-qa-payment-20261031.png, release-qa-mobile-fit-20261031.png. No password, token, provider keys or real customer PII included.

Browser diagnostics: DOM click sometimes reported hidden despite screenshot-visible controls; documented accessible-index actions worked. Date fill initially did not persist; native date setters plus observed values preceded successful preview. Two later navigation errors (network suspended and timeout) were followed by observing the intended loaded destinations; no blind reload/resubmit. No new P0/P1 product defect demonstrated. Successful native forms retain the editor/dialog; saved data independently verified.

## Remaining stop/go boundary

1. Separate manager/viewer/finance access, tenant switching/revocation and complete mobile journeys remain untested. Do not impersonate identities or change memberships as a shortcut.
2. Fresh new Shopify import/resume/draft-completion cases were not repeated on this deployment. Current preview all existing and retained-draft provenance checks do not replace them.
3. Dedicated NEW Test Chatwoot account/inbox, exact URL-key/secret/account mapping and visitor -> Test lead -> native staff reply still require a separately reviewed activation scope. Never reuse901/902. Current D073 all-off install/test authority does not grant this.
4. Hosted duplicate/wrong-secret/foreign-account/role/PII restrictions and Shopify-linked CRM provenance remain open. Native API login, separate browser login and SSO must be reported distinctly.
5. Real Phantom Threads binding/store cutover, Meta WhatsApp-first onboarding, real messages and second-client PartD remain later gates. BackupD069 stays owner-deferred/notPASS; operational storage encryption/key custody/access/maintenance response remain unresolved. No new backup work or question.
6. Live AI orchestration is still mock-only; AI/STT/Telegram/draft delivery/notifications/cron/lead-refresh and n8n workflows remainoff. No auto-suggestion promise or full go-live claim.

Feature provider/STT/judge spendUSD0; coding-agent billing not measured. No service purchase. Next preparation uses existing TEST_SCOPE.md/test-scope.json flag sequence; reverify exact deployment/security/operator scope before asking for its distinct activation approval. No authority is inferred from this report.
