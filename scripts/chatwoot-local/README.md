# Isolated local Chatwoot

This is the actual Chatwoot 4.18.0 Community Edition connected to the isolated OS PLUS environment. No purchased server or domain is needed. This harness is only for the existing synthetic Chat Local 1/2 fixtures, not production installation.

## Owner test now

1. Open http://localhost:4141 (staff inbox). Login details are in the ignored local file `outputs/chatwoot-local/LOGIN.txt`. Account 1 uses `owner1@chat-local.example`; account 2 uses `owner2@chat-local.example`. Each can access only its own business.
2. Open http://localhost:4142/1 in another tab and use the chat bubble to send a synthetic inquiry. Page /2 is the second business. No real personal or customer information is needed.
3. In the staff inbox choose All conversations and All statuses if the bot-pending inquiry is hidden. Open the conversation, click Take over, reply, and check the visitor receives it.
4. OS PLUS http://localhost:4131/settings/chat remains owner configuration; Sync inboxes now reads the actual local Chatwoot account. The latest verified Clerk session is owner-a / Chat Local 1 (Local QA A); choose the matching Chatwoot account when comparing.

A separate Chatwoot login is required in this phase. OS PLUS single-login handoff, the Chats dashboard link, Leads screens and AI responses are not implemented by this local setup. Native Chatwoot email prompts are system messages, not our chatbot. No email delivery is configured.

## Start / stop

Run from D:\\Develop\\os-plus-chat-ch0 with Docker Desktop's local Linux engine running. Existing OS PLUS local DB and private Clerk setup must already be prepared (see ../../docs_chat/CH1_LOCAL_QA.md). Never replace that database with shared Supabase.

```powershell
npm run chat:local -- up
node scripts/chatwoot-local/manage.mjs up
# One-time synthetic fixture setup only:
node scripts/chatwoot-local/seed.mjs
# Re-run up after first seed to start the callback relay and visitor page:
node scripts/chatwoot-local/manage.mjs up
$env:NODE_EXTRA_CA_CERTS = Join-Path (Get-Location) 'outputs/chatwoot-local/ca.crt'
node --conditions=react-server --experimental-strip-types scripts/chatwoot-local/connect.mjs
# Start only if the existing localhost:4131 app has been stopped:
npm run chat:local -- app --chatwoot
```

For routine restart of this prepared instance, run the two up commands, then npm run chat:local -- app --chatwoot only if it is stopped. The npm entry supplies the required react-server condition; do not invoke chat-local/manage.mjs with plain node. Do not reseed/reconnect unnecessarily. Docker images must already be present: chatwoot/chatwoot:v4.18.0-ce, pgvector/pgvector:pg17, redis:7 and caddy:2-alpine. manage up records and reuses their local immutable image IDs. The tested Chatwoot digest is sha256:faaa58a911cda8f2ab9d717ddf8ca4332163b07da4c5da10711d896e5d667442.

```powershell
node scripts/chatwoot-local/manage.mjs status
node scripts/chatwoot-local/manage.mjs stop
```

Stop retains data, stops only owned Chatwoot services and its relay/visitor helpers. OS PLUS has its own lifecycle. Keep the computer awake while testing. The harness does not install auto-start services.

## Verification

```powershell
$env:NODE_EXTRA_CA_CERTS = Join-Path (Get-Location) 'outputs/chatwoot-local/ca.crt'
node --conditions=react-server --experimental-strip-types scripts/chatwoot-local/qa.mjs
node scripts/chatwoot-local/check-runtime.mjs
node scripts/chatwoot-local/restore-check.mjs
npm run test:chat
```

Run these sequentially: restart/restore deliberately interrupts local Chatwoot. Restore pauses Rails/Sidekiq, saves a native pg_dump, restores into a fresh database in the same owned cluster, compares every public table's row count/content hash, then restarts writers. Dumps and restore databases are retained. It does not test attachments, Redis, Clerk, host replacement or complete disaster recovery. qa.mjs creates incoming fixtures via the Rails model and staff messages via API; separate actual browser evidence is documented in ../../docs_chat/CH2_QA.md.

## Isolation and credentials

Separate project osplus-chatwoot-local-8e8d10a9c1 owns its DB, Redis, storage and private CA. Nonce labels and prospective name checks refuse foreign resources. Rails/worker/DB/Redis use an internal network with no internet egress; Caddy alone bridges local host callbacks. UI4141, API TLS4444, relay4132 and visitor4142 are loopback-only. No Meta, SMTP, Telegram, paid model, public tunnel or n8n is configured.

The local app --chatwoot launch verifies owned resources, targets https://localhost:4444 and scopes CA trust to its process. CHAT_DRY_RUN=false and CHAT_ADMIN_LIVE_ENABLED=true are local-only to exercise actual local provider writes; never reuse these overrides for real services. CHAT_WEBHOOK_ORIGIN=https://osplus-bridge resolves only within the private Docker network. SAFE_FETCH_ALLOW_PRIVATE_NETWORK is enabled only in this local Chatwoot compose so its worker can call the local bridge. Production deployment files and root .env.local are unchanged.

Private account tokens, password, callback secrets, dumps and logs stay ignored under outputs/chatwoot-local. Do not commit or paste them. The callback relay does not log URLs/bodies, and the local Next snapshot disables incoming URL logs because callback queries carry credentials. Login credentials are local synthetic credentials only. Workspace origin rebinding is restricted to the two existing synthetic fixtures and records prior origins/audit; it is not a production reconfiguration feature.

Remaining external test preparation: ../../docs_chat/CH2_META_TESTING.md. Do not expose or remove egress isolation from this existing local stack to connect Meta; a separately approved disposable test environment is required.
