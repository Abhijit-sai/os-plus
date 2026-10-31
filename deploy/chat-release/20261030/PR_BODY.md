The additive Chat/Leads implementation keeps staff replies in separate tenant Chatwoot workspaces and CRM in OS PLUS. This branch preserves CH0-CH9 plus CH10 bench, hardening, 4GB host and release tooling; the only recent shared UI fix adds two layout classes for a long fit-reference select.

Owner accepted the implemented CH10 engineering scope on31October (CHAT-D072). This draft remains a production-release review: full hosted/manual/security/Test-first gates are open. AI/STT/Telegram, delivery and n8n workflows remain off; no live orchestrator or one-login claim.

The owner manually applied the reviewed35-addition SQL package. Read-only production checks verify40RLS tables,69functions, matching definitions/effective grants and no enabled modules/workspaces/channels. One redundant trigger grant variance is documented. Frozen106 migration sources are unchanged; no migration ledger exists, so never replay historical files or reapply35.

Validation: preceding typecheck/lint/build/roles/V2 PASS; final ownedPG17.6 Chat315/315,0fail/cancel/skip/todo; checkout3/3 and exact-SQL atomic/recovery7PASS. Existing Boutique/persona/mobile/SSO and hosted Test Chat->CRM evidence remains partial/pending. Vercel preview e5ec13e passed; current production alias/env still needs verification. No merge or production promotion has occurred.

See docs_chat/CH10_OWNER_ACCEPTANCE.md, CH10_QA.md and deploy/chat-release/20261030/TEST_SCOPE.md. Backup work is owner-deferred/notPASS; real Shopify cutover and WhatsApp onboarding follow Test acceptance. This PR grants no execution authority by itself.
