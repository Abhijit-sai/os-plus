# CH-3 QA record
Status: CLOSED LOCAL — owner acceptance CHAT-D038, local commit0d22491f14eb82f246d2d17f50b9c97c4269a0a0. Branch codex/chat-ch1-foundation; base00718d6e395ea652eb2a7ceb79b39ae1471e863c. No external release. Header reconciled2026-10-22.

Implemented: tenant-owned contacts/scoped identities/conflict candidates, exact automatic existing-customer link, one open inquiry lead, callback-order-safe public reply clocks and eligible automatic ownership with manual provenance; audited atomic link/convert/edit/record/merge/split commands; explicit record stage refresh/inactivity; optional published CRM configuration; configured hot/value/SLA rules and idempotent historical backfill. Leads pages are CH-4; no model replies, SSO, Meta, notification delivery or scheduler activation.

## Migrations and actual recovery
Applied ONLY these three to owned LOCAL PostgreSQL15437:
- 20261021123000_chat_contacts_leads.sql
- 20261021124000_chat_contact_lead_commands.sql
- 20261021125000_chat_lead_refresh.sql

Prior75 migrations NOT replayed on persistent data. All121 prior public tables' counts/content hashes preserved (ignore only added nullable conversation.contact_id). Three migrations/checksum marker atomic. SYSTEM/AUTOMATION backfill synthetic A33/B15 messages, no invented historical profile/phone/source facts.
Actual pre-upgrade restore: chat_restore_d8f8edc7afcc,121 tables,1300073-byte dump.
Actual post-upgrade restore: chat_restore_d44476af6654,128 tables,1383312-byte dump; complete count/hash equality and anon leads denial PASS.
Private report: outputs/chat-local/ch3-upgrade-report.json. Same-cluster DB recovery only; no host/Clerk/attachment recovery claim. Owned REST/worker paused and restored. No hosted/shared/production SQL.

## Automated evidence
All required gates PASS:
- npm run typecheck
- npm run lint
- npm run build
- npm run test:roles (14 exact ingress cases)
- npm run test:v2 (four suites)
- npm run test:chat (98/98 at application gate; latest affected local harness rerun100/100,0 skipped)
Logs: outputs/chat-local/ch3-gate-*.log and ch3-gate-results.json; latest lint/Chat outputs/chat-local/ch3-final-{lint,chat}.log.
Chat includes22 actual disposable PostgreSQL tests replaying78 SQL files, pure rules7, parser8, knowledge5, server2, and local bridge2. Covers two-tenant same phone, composite FK/ACL isolation, concurrency with uncommitted platform customer insert, rollback, receipt retries, reference collision, merge/split/stale undo, native booking evidence, newest Shopify generation/current hold, actual HTTP->SQL and production server guard->RPC.
Synthetic harness authorization is not a fresh Clerk browser role login.
Review fixes: mapped owner role eligibility; delayed auto-owner provenance; trusted configured monotonic intent; Shopify current hold/newest generation/no older fallback. Focused standards/spec review: no unresolved actionable findings. Reviewers did not execute tests.
Local IPv4/IPv6 bridge preserves Host/auth bytes, rejects occupied listeners and publishes only after owned Next readiness. Narrow review clear; actual browser now reaches local app. No security bypass.

## Actual isolated provider evidence
Refreshed app snapshot app-1792602418008. Actual Chatwoot4.18 provider qa.mjs10/10 PASS, two synthetic accounts. CRM assertion2/2 PASS: fresh callbacks produce one contact/lead, engaged stage, profile/scoped identities/public clocks. Historical inquiry completeness asserted only for synthetic A/B; disabled earlier HTTP fixture tenant excluded, no global completeness claim.
Reports: outputs/chatwoot-local/qa-report.json and outputs/chat-local/ch3-provider-report.json.
No real WhatsApp/IG/FB/Telegram/model traffic.

## Remaining gate evidence
Post-upgrade Boutique Tier A PASS14/14 in owner scenario; persistence7/7; tenant B copied A-order404; desktop/authenticated390px iframe smoke PASS. See CH3_BOUTIQUE_QA.md for limits and workbook14-note preservation evidence. Final local launcher HTTP200 on IPv4/IPv6 and authenticated reload PASS; final diff/check PASS; owner acceptance C3-L1–L4 satisfied under CHAT-D038 in CH3_OWNER_ACCEPTANCE.md.
Meta stays deferred under D033/D034, a production-release blocker. Real channel wire fixtures and two-phone owner acceptance are NOT PASS. CHAT-D038 explicitly carries that boundary for local closure/CH4 progression.
Model/API spend USD0.
