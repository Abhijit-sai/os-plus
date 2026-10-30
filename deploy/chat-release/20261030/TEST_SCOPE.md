# Initial Phantom Threads Test release scope - proposal only

30 October 2026. CH10 QA_BLOCKED. Companion `test-scope.json` is review material, never an executable deployment instruction or approval.

The first hosted trial is staff-operated Chatwoot plus OS PLUS contacts/leads. The exact Test tenant alone is eligible; real Phantom Threads and every other tenant stay disabled. SQL and the app remain shared, so a Test-only feature flag does not isolate migration or application risk. Account/inbox IDs remain unset until NEW dedicated resources are approved and provisioned. Synthetic901/902 and their history remain separate.

## Minimum flag sequence

| Step | Foundation | Dry run | External admin | Tenant/channel |
|---|---|---|---|---|
| Install approved shared SQL/app | false | true | false | All tenant modules disabled |
| Separately approved Test provisioning | true | false | true temporarily | Exact Test only; channel agent_mode=off |
| Proposed staff-operated capture acceptance | true | true | false | Exact Test only; channel agent_mode=off |

This sequence comes from the existing `connection.ts`, `module.ts`, `ingress.ts`, `capture.ts`, `transport-setup.ts` and `onboarding.ts`. Setup needs external admin access and dry-run=false; the event capture path is database-backed and does not require external admin access or dry-run=false. Existing real-database capture tests explicitly prove events remain captured when agent_mode=off while agent callbacks are ignored. The full313-test PG17.6 pass includes that case. This source/runtime evidence is NOT yet a hosted flag-combination acceptance result.

All model, mock preview, draft delivery, voice/transcription, Telegram/notification/platform alert and scheduler/lead-refresh gates remain OFF. Model/transcription modes and provider keys remain unset. External setup creates the receipt-backed bot/webhook through existing commands; with every channel mode off, no inbox bot is attached. An unattached setup bot is not a running AI pipeline. No n8n workflow activation is needed or authorized. Page-view lead refresh is distinct from a scheduler and continues to enforce existing contact/order/payment provenance.

Approved operator addresses stay in private session context. Chat admin/staff roles must be reconciled with existing OS PLUS membership; matching email is not SSO or proof of role equivalence. Viewer entry stays disabled. No SMTP/invitations or password creation happens in this package.

## Backup decision and remaining acceptance

Owner explicitly says: "no backups for now. We'll plan this later please." Respect that deferral: no new backup, storage purchase, upload, schedule, key change or further destination selection now. Hetzner server backups remain owner-confirmed enabled. A fresh authenticated Supabase backup page shows this OS PLUS project is on Free and says project backups are not included. Do not claim the separate shared database is protected by the VPS backups. The backup gate is owner-deferred, not passed; this is not shared-SQL/app/commit authority or full CH10 closure. Any future concrete release proposal must carry the recorded deferral, rather than silently treating it as completed or reopening storage selection.

Fresh browser work observes current released MAIN only: retained Clerk Owner/Admin enters exact Phantom Threads Test; dashboard, order list, retained four-item synthetic order, production and finance render. Imported order list separates external Shopify payment from local collections; the retained native order shows its existing receipt and remaining balance. Order form renders workflow/item type/fit reference, GST and initial payment controls without submission. Browser clicks, screenshots and GST navigation repeatedly time out; edit, actual stage/payment changes, customer create/search, GST, independent roles and mobile interactions are NOT passed. The viewport capability requested390 but observed468, so no390px acceptance is claimed. No record was created, updated, deleted, payment recorded or communication queued by these checks.

Complete the missing Boutique Tier A and candidate/authenticated persona/mobile acceptance in a healthy approved setup. Read-only main-page observations and focused static/pure tests do not substitute for that gate. Hosted OS PLUS -> NEW Test Chatwoot -> visitor inquiry -> exact-tenant lead -> native staff reply, duplicate/secret/foreign-account denial and Shopify provenance checks follow reviewed release approval. PT-01..PT-15 remain planned until observed. Real business binding, same-store Shopify cutover and WhatsApp onboarding follow Test acceptance; Instagram/Facebook remain later.

Current candidate SQL and prior-main rollback are unchanged. Preserve hashes, newest main, unrelated env and additive data. No destructive restore or broad database smoke may run against shared production; legacy smoke scripts which pick the first active tenant are unsuitable for this trial. Do not substitute source assertions for manual results.


## 30October2026UTC - Interactive checks resumed; checkpoint review proposal
See CH10_BOUTIQUE_RELEASE_QA.md for fresh search/measurement/unsavedforms/GST/publicview and limits. Local2classfit-referenceoverflow fix; synthetic390/768/1440layout checks pass, wholeappnotcertified. Freshsixgates313/313ChatPG17.6 pass; exactSQLunchanged, no migrations. Standards0/Spec1testinventorygapfixed0remaining; latesttest-onlyguardfocusedcheck/lintpass. Main/Vercelc686337CurrentProductionReadyreverified. Candidate commit/push/DRAFTPR scope is deploy/chat-release/20261030/CHECKPOINT_PROPOSAL.md (relative torepo); approvalpending, not prodrelease/closure. Backupsremainowner-deferredD069; AI/STT/Telegram/workflowsOFF. CH10QA_BLOCKED. SAMEsummary updated with exact evidence/sourcehashes/failedattempts.
