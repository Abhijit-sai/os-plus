# CH-2 owner acceptance

Status: LOCAL ACCEPTED under CHAT-D034, 2026-10-21. Owner approved local closure/commit and CH-3 progression; live Meta acceptance remains deferred as a production-release blocker.

## First, distinguish the two logins

OS PLUS: http://localhost:4131. Owner-a+clerk_test@example.com is now signed in to Chat Local 1 (Local QA A), and the owner-scenario Boutique checks are complete. No further Clerk sign-in or keys needed.

Chatwoot: http://localhost:4141. Its owner1@chat-local.example login is separate until the later SSO phase. Local credentials are in ignored outputs/chatwoot-local/LOGIN.txt. Signing into Chatwoot does not sign into OS PLUS. Your new inquiry is open at http://localhost:4141/app/accounts/901/conversations/6 (message: Hey you). Click Take over, then choose Reply; the composer was in Private Note mode.

## Local owner checks

Use synthetic text only. Keep Docker and the local app running. No server/domain purchase needed.

- [x] **L1 Inquiry (owner/agent verified):** open http://localhost:4142/1, use the chat bubble and send a distinct inquiry such as “Owner acceptance A — consultation question.” In Chatwoot account Chat Local 1, select All conversations and All statuses if needed; confirm the same text appears once.
- [x] **L2 Staff reply (owner explicitly confirmed working):** open that inquiry, click Take over, reply “Owner acceptance reply A,” and confirm it reaches the visitor page.
- [x] **L3 Private note (agent verified note49 in actual staff/visitor UI):** add “Internal acceptance note A” as a Private Note. Confirm staff can see it and the visitor cannot. Return the composer to Reply before further public replies.
- [x] **L4 Business separation (agent runtime/API checks pass for both accounts; separate owner browser login not claimed):** sign into Chatwoot using the separate Chat Local 2 credentials and use http://localhost:4142/2. Confirm its new inquiry appears there and that Chat Local 1's conversation is absent. Separate browser profiles avoid the shared Chatwoot session switching both tabs.
- [x] **L5 OS PLUS connection (agent verified owner-a inbox sync; prior owner-b sync separate):** in the matching OS PLUS business, Settings -> Chat -> Sync inboxes shows only that business's website inbox. Confirm the saved brand/branch mapping and draft mode. This is configuration, not a native conversation inbox.
- [ ] **L6 Report:** tell Codex which L1-L5 passed or failed and the unique inquiry text used. Codex will verify tenant-correct database capture, one message/turn despite duplicate callbacks, staff quiet state and private-note behavior without exposing credentials. This is acceptance of the local connector behavior only.

CH-2's agent intentionally records a silent turn. No AI answer, Leads screen, customer conversion, Telegram alert, dashboard Chats CTA or one-login handoff is expected from this phase. Native Chatwoot email prompts are system prompts, not an AI reply.

## Agent regression result

All14 policy Boutique critical paths passed in the local owner scenario;7/7 database persistence groups passed. Exact results and scope: [CH2_BOUTIQUE_QA.md](CH2_BOUTIQUE_QA.md). Independent Manager/Finance browser sessions and GST-bearing tax calculations were not claimed. The QA workbook now contains14 dated evidence notes; changed ranges visually reviewed, historical statuses preserved, all unrelated package content byte-preserved. Earlier style-loss report was a verifier error, now resolved.

## Full CH-2 phase gate

Local owner checks do not silently waive the existing phase plan:
- [x] Preserve the completed owner-scenario Boutique evidence and reconcile its QA tracker notes without altering historical results or unrelated formatting.
- Obtain actual required captured-channel fixtures, including WhatsApp/Instagram/Facebook and the remaining bot/template classifications; existing synthetic fixtures remain distinct.
- Complete CHECKLIST Part C / CH-2 using an explicitly approved test WhatsApp number, inbox and message. This needs an approved publicly reachable HTTPS callback and Meta test setup, with separate hosting/tunnel/deployment/migration/message authority. Do not buy hosting or expose localhost just to satisfy this checklist without that authority.
- Review the captured evidence, resolve required defects, and obtain explicit owner phase acceptance before the local phase commit. No production release authority follows from acceptance.

Source of these gates: [phase plan](05_Phase_Plan_WBS.md#ch-2--chatwoot-connector--capture), [checklist](CHECKLIST.md), [QA evidence](CH2_QA.md), and [phase policy](../docs_v2/10_Phase_Gate_QA_and_Commit_Policy.md). Current CH-2 status remains QA_BLOCKED.

Meta preparation and exact owner actions: [CH2_META_TESTING.md](CH2_META_TESTING.md). No public endpoint or Meta connection has been activated. Historical bot-error activity47 was not reproduced by fresh pending/replay checks; details and limits in CH2_QA.md.

CHAT-D034 supersedes the original live-Meta gate for LOCAL progression only. All technical local closure checks and final reviews pass; final Chat suite65/65. Production Meta/channel acceptance still requires the preserved runbook and concrete authorisation.
