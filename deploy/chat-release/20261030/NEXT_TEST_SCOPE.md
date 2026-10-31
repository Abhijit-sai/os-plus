# Next Test Chat activation - review only, 31 October 2026

**Not approved for execution. Chat remains disabled.** CHAT-D073 covered the already-executed all-off production installation and existing-flow Test checks. This document makes the next scope concrete without consuming new authority or waiving open gates.

## Owner-facing outcome

Create a separate Test chat space, send a fictional enquiry from its private Test preview, see the lead under Phantom Threads Test in OS PLUS, and answer from Chatwoot. The real store website, real Phantom Threads account and WhatsApp remain unchanged. Staff reply manually; AI suggestions and transcription are unavailable.

## Pinned destination and preservation

- Current production app643cf10e7ed7f340f0614b598f23468c12988d6c / deploymentBd6qVpC3G9vTTFF8R9qvrdjVcqU4. Reverify current main/runtime before any environment-driven deployment; never deploy the older receipt branch over newer main.
- Exact eligible tenant: Phantom Threads Test,7be40f50-94a0-46c5-af57-7eea5e36ea8a. Real364f9052-2ec4-45c1-aeca-70618b37265c and all other tenant modules stayoff.
- Use existing host2.29.113.198, projectosplus-chat-private, checked4GB profile and digest pins. Rails/n8n/DB/Redis remain private; no bootstrap or volume replacement.
- Create a NEW Chatwoot account and website inbox. Account/inbox/workspace IDs remain unset until creation is observed and receipt recorded. Existing synthetic901/902 must never become these mappings.
-35Chat migrations are installed; no SQL deployment/replay is part of this scope. Shared app/database still affect all tenants; Test-only flags do not create environment isolation.

## Preconditions before asking to execute

1. Finish available existing staff-role checks; list unavailable personas separately. Owner has confirmed an existing Test staff login and is signing in; no role change is needed for that check.
2. Reconcile the exact Test operators with their current OS PLUS memberships and proven Chatwoot role restrictions. Do not infer permission from an email or grant every operator admin. Owner selected one Chat administrator and two staff privately; keep addresses out of public records. Viewer Chatwoot entry remains disabled.
3. Review host access/storage/key custody and the named rollback/response owner before additional credentials. Keep real data withheld. Backup work remains explicitly owner-deferredD069/notPASS; no new storage/export/schedule/purchase or repeated destination question. Any staged disposition must remain explicit.
4. Prepare a safe owner-controlled credential-entry/custody path, including any new platform token or encryption key. No secret values in chat, repository, screenshots or logs. Password entry/confirmation/submission is an owner handoff; no SMTP/invitation emails.
5. Present exact environment/mapping/access/synthetic-message changes and obtain their distinct action-time approval. No authorization comes from this review document.

## Existing implementation sequence after approval

Use existing server actions/audited commands and idempotency receipts, not direct SQL mutations or forged identity. Platform setup is protected by requireSuperAdmin. configurePlatformChat supports workspace.prepare/create/link and module.set. Uncertain account creation must be reconciled before another attempt; never blindly retry it. Account token is encrypted with tenant/workspace/purpose binding. Inbox mapping uses the exact new account and allowed brand/channel configuration.

Origins: Chatwoot API/browser https://chat.phantomthreads.in; OS PLUS webhook origin https://os-plus.vercel.app. Server-only names include CHAT_SECRETS_KEYS, CHAT_SECRETS_ACTIVE_VERSION, CHATWOOT_BASE_URL, CHATWOOT_PLATFORM_TOKEN and CHAT_WEBHOOK_ORIGIN. Names are review material; no values have been generated, read or set by this document.

| Stage | Foundation | Dry run | External admin | Scope |
|---|---|---|---|---|
| Current installation | false | true | false | All tenants off |
| Temporarily approved Test provisioning | true | false | true | Exact Test module/account/inbox only; channel agent_mode=off |
| Test staff-operated capture | true | true | false | Exact Test module; channel agent_mode=off; no live OS PLUS delivery |

Flags are CHAT_FOUNDATION_ENABLED, CHAT_DRY_RUN and CHAT_ADMIN_LIVE_ENABLED. In Vercel, environment changes require a reviewed deployment of then-current main; this plan does not promote a Preview build or authorize a runtime source patch.

All other flags stayoff as listed in test-scope.json: agent/live models/mock previews/staff draft send/draft delivery/voice/live STT/Telegram/mock Telegram/notifications/notification cron/platform alerts/lead refresh. Model/transcription modes unset; no paid run, n8n activation, Meta registration or real message.

Transport setup verifies the exact workspace URL key plus secret and stored account/inbox relationship. Payload tenant/account IDs never establish authority. The receipt-backed setup can create an unattached bot and account webhook; agent_mode=off must leave every inbox bot unattached. Capture is independent of model execution. Never print returned once-only webhook URLs; preserve their secret securely.

## Synthetic acceptance and rollback

- Use only the native new Test inbox preview after observing its generated preview/origin. Do not install a widget on phantomthreads.in or guess root/www origin allowlists. Use fictional names, no real phone and example.invalid email.
- Verify visitor -> exact new Test inbox -> conversation/contact/lead in Test -> manually typed native Chatwoot reply -> visitor receipt. Staff use Chatwoot opened from OS PLUS in a new tab; Leads stays in OS PLUS.
- Observe duplicate/wrong-secret/malformed/foreign-account rejection, private-note privacy and attachment handling through HTTPS. Keep destructive concurrency/restore/chaos in owned disposable infrastructure. Never use the real tenant as a fixture.
- Exercise permitted and denied personas after module enablement; all-off404 alone is not Chat role-denial evidence. Retained Shopify context must respect source payment/draft/delivery/consent boundaries; do not send retained real customer facts to Test transport.
- Report native API login, separate browser login and SSO distinctly. No one-login claim without proof.
- On failure, disable only Test module through the audited command, return foundation/admin/live flags to all-off and deploy then-current reviewed main if needed. Preserve new account/data/receipts for investigation; no broad deletes, SQL rollback or secret rotation by inference. Stop on an uncertain remote outcome.

Evidence must record exact IDs, non-secret hashes, deployments, commands, tenant/persona/viewport, fixture counts and every unresolved gate. Real-business Shopify cutover and WhatsApp-first Meta onboarding follow separate accepted Test results and authorization.
