# CH-9 owner review — Chats and Leads

Local engineering QA is complete (CH9_QA.md). You do not need to configure technical settings, repeat the unsaved-changes test, add keys or connect Meta. LiveAI and transcription remain disabled.

Use the existing local session, Local QA A / Chat Local1.

1. **Chats:** open http://localhost:4141/app/accounts/901/conversations/40. A synthetic visitor asked about opening hours. Staff received a private suggestion, approved it, and the visitor received the reply.
2. **Leads:** open http://localhost:4131/leads/95ba955f-feec-44c5-88ce-61c4cf844a34. The same enquiry and reply are stored here for follow-up. Staff continue replying in Chatwoot.
3. Tell us whether this ordinary workflow matches your expectation, or describe what should change. Explicit local acceptance is still required before the CH9 phase commit; no production release is implied.

Settings at http://localhost:4131/settings/chat are occasional owner configuration. Routine staff work happens in Chats and Leads. The website widget, inbox mapping and business facts are already configured for this local demonstration.

Engineering checklist references: C9-L1 overview PASS; C9-L2 Cancel/preserved text/discard and invalid-save retention PASS autonomously; C9-L3 scoped widget code PASS; C9-L4 actual pre-chat→lead→private draft→staff-approved visitor reply PASS; C9-L5 installed local test page PASS; C9-L6 role/PII/two tenants/stale form/narrow layout PASS. C9-L7 product-owner acceptance remains pending; no claim of independent owner execution.

Optional visitor view: http://127.0.0.1:4131/ch9-widget-test.html, chat bubble. This is a snapshot-only local page using the actual installation code. Original optional pre-chat settings were restored after testing. Do not install the loopback code on a public website. Real models/speech/Meta/Telegram/one-login and production infrastructure still have separate release gates.

## Accepted local disposition — 28 October2026
Supersedes pending C9-L7 above. Owner explicitly accepts local CH9, authorizes local commit and CH10 planning/local checks (CHAT-D059). Reported evidence accepted; independent owner execution of every listed engineering test is not claimed. LiveAI disabled, server/domain/Meta later; no production or paid/live action authority.
