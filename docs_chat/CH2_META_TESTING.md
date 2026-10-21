# CH-2 Meta test runbook

Status: DEFERRED BY OWNER — 2026-10-21 (CHAT-D033). Resume only when owner requests Meta connection/testing again. No Meta app, channel, public tunnel, server, deployment or real message has been created/connected by this session.

Start with WhatsApp, then Messenger and Instagram DM. The existing phase requires actual captured-channel fixtures for all three; a WhatsApp-only result does not close CH-2. Instagram comment automation is excluded.

## 1. Owner: prepare the accounts and test assets

1. Sign in to [Meta for Developers](https://developers.facebook.com/) using the person who manages the platform's Meta apps. Complete developer registration, 2FA and any terms/identity checks yourself.
2. Select/create the business portfolio that will own the OS PLUS platform app. Use new platform branding. Do not reuse another business's app, tokens or inbox. One person can administer the assets, while each business/number/Page remains separately identified and mapped to its OS PLUS tenant.
3. Create a fresh app with the WhatsApp/customer messaging use case. Meta's labels change; select the WhatsApp use case shown in the current dashboard rather than assuming the older “Business app” wizard.
4. Open WhatsApp -> API Setup (sometimes Use cases -> WhatsApp -> Customize -> API Setup). If a Meta-provided test number is available, use it for the first test. Add your own chosen tester phone as a recipient and complete its verification yourself. If no test number appears, stop before adding/migrating a business number and report the non-secret status.
5. Record App ID, WhatsApp Business Account ID and Phone Number ID. These are distinct IDs. Keep the access token/App Secret/OTP private. Do not paste credentials or full webhook URLs into this chat. A short-lived dashboard token can be used for a bounded sandbox test where supported; record its expiry. Persistent manual onboarding requires the correctly scoped system-user token, with expiry/revocation managed. Do not expand access to unrelated assets.
6. Prepare a separate test Facebook Page you administer and a test Instagram professional account. Add the appropriate developer/tester roles and accept invitations yourself. Use synthetic inquiries, not customer conversations. Instagram Business Login is the supported preferred flow for our v4.18 build; do not follow the old Instagram Basic Display setup.

Business verification, privacy/deletion pages, App Review and required advanced permissions remain public-production readiness tasks. They are not all assumed prerequisites for every restricted sandbox test. Check the restrictions actually shown for each selected use case/account.

## 2. Owner decision: approve the specific HTTPS test environment

Ordinary localhost cannot receive Meta callbacks. A purchased server/domain is not necessary for a temporary test, but a publicly reachable HTTPS endpoint is necessary. Our existing loopback stack intentionally has no Rails/worker internet egress and synthetic website-only credentials.

Owner selected the temporary tunnel route on2026-10-21 (CHAT-D032). The exact endpoint/asset scope is not yet activated. Routes below retain the alternative for reference:
- Temporary HTTPS tunnel to a dedicated test copy on this computer: computer stays awake, URL may change; route only required Chatwoot webhooks/OAuth endpoints and keep administration authenticated. Do not tunnel the existing OS PLUS dashboard, databases, Redis, local control endpoints or all existing localhost ports.
- Dedicated staging deployment with its own database/storage and test tenants. Production remains on its current release. Domain/server/purchase/deployment and staging SQL each need their explicit scope/approval before execution.

Codex will first prepare a concrete route/egress/secret plan and verify locally, then request approval for the named endpoint and intended assets. Approval must specify the test OS PLUS tenant (proposed: isolated Chat Local 1 only), the Meta test WABA/Phone Number ID, Page and IG account as relevant, and named tester recipient(s). No existing platform production Supabase or business data is to be used. No public endpoint is active now.

Use fresh test credentials and separate Chatwoot accounts/inboxes. Permit only the required Meta API egress. Keep OS PLUS CHAT_DRY_RUN=true for tests against real services; no AI, notification delivery or n8n activation. Any manual staff/Meta test message is separately authorised for named recipients and is not prevented by OS PLUS dry-run. No channel/model charges or purchases are silently approved by the INR2,000 hosting ceiling.

## 3. Codex + owner: connect WhatsApp after endpoint approval

1. Prepare the isolated test Chatwoot and OS PLUS capture service, secure HTTPS, private credentials, backups/restore and exact authenticated callback routes. Run the already reviewed CH-2 SQL only against the new dedicated test database if explicitly authorised; never reapply historical migrations to production.
2. In the intended Chatwoot account, Settings -> Inboxes -> Add Inbox -> WhatsApp / Cloud API -> manual setup. The installed v4.18 fields may differ from current online screenshots. Enter the test Phone Number ID, WABA ID and appropriate token privately.
3. Use the webhook URL and verify token generated/shown by that Chatwoot inbox in Meta's WhatsApp configuration; subscribe to messages and verify the subscription. Never replace this with an OS PLUS agent/events URL.
4. In OS PLUS, connect the workspace to that Chatwoot account; sync/map only the test inbox to the approved test brand/branch in draft mode. Reconcile the existing bot and account webhook using the authorised secret/origin, preserving their identities.
5. There are two hops: Meta -> Chatwoot channel webhook; Chatwoot -> OS PLUS tenant-key/secret events + agent callbacks. Chatwoot remains the staff reply inbox. OS PLUS selects the tenant from workspace URL credentials, never Meta payload IDs.
6. Once the owner approves the named test recipient/message, send a distinct WhatsApp inquiry from the tester phone, for example “OS PLUS CH2 WA test A”. Observe it in Chatwoot and one OS PLUS message/one silent turn under the right tenant. Take over and send one approved synthetic staff reply; confirm receipt. No AI reply is expected.
7. Codex captures a sanitised real provider payload, records latency and verifies duplicate replay gives no extra message/turn; verifies staff/private/template classification and tenant-B denial. Template sending, if needed for the required captured fixture, needs its approved test template/recipient and any applicable charge disclosed before sending.
8. Save evidence, remove/revoke temporary access after the test as approved, and record what remains untested. Do not enable auto mode or onboard customer numbers.

Do not register an existing WhatsApp Business app number through manual Cloud API setup merely for testing. The current Chatwoot manual-flow documentation states coexistence is unsupported in that flow. Use Meta's test number or an explicitly approved dedicated number.

## 4. Facebook Messenger and Instagram DM

- Messenger: configure the platform app's Facebook login/callback and test Page subscription for the approved HTTPS Chatwoot endpoint, then create that Page's inbox in the correct Chatwoot account. Use a permitted app-role tester to send one inquiry and receive one authorised staff reply. Capture the real Facebook payload and assert the same tenant/idempotency rules.
- Instagram: use Instagram Business Login, a professional test account and accepted tester roles. Configure Chatwoot's Instagram app settings, exact HTTPS redirect and webhook URL generated for this build. Current upstream guidance says Live mode may be required for webhook delivery even in tester setup; do not flip app mode or grant broad access blindly. Review the actual dashboard restrictions together and authorise that test-only change explicitly if necessary. Capture one DM/staff exchange. No comments/ads automation.
- Production use for unrelated businesses requires the relevant review/access approvals and legal URLs. Tester success is not general production onboarding approval.

## 5. What to send back now

Only non-secret details:
- Meta app created? WhatsApp API Setup accessible? Test number available?
- App ID / test WABA ID / Phone Number ID (or simply confirm they are ready for private entry).
- Names of the intended test Page / Instagram professional account.
- Test environment: temporary tunnel to a separate test copy, selected2026-10-21; do not ask this choice again.
- Confirmation that the selected phone/accounts are yours and will be the only approved test participants.

No passwords, access tokens, App Secrets, OTPs or private callback query strings in chat. Codex will provide a scoped private-entry location when the environment is approved.

## References checked 2026-10-21

- [Meta official Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api) — developer setup/assets, dashboard tokens and permissions.
- [Chatwoot manual WhatsApp setup](https://www.chatwoot.com/hc/user-guide/articles/1756799850-how-to-setup-a-whats_app-channel-manual-flow) — app/number IDs/token, inbox/webhooks and manual-flow coexistence restriction. New screenshots may exceed pinned v4.18 UI.
- [Chatwoot self-hosted Messenger](https://developers.chatwoot.com/self-hosted/configuration/features/integrations/facebook-channel-setup) — Page/test subscriptions and HTTPS requirement. Recheck current Meta permissions/version; do not copy the old v17 example as current.
- [Chatwoot Instagram Business Login](https://developers.chatwoot.com/self-hosted/configuration/features/integrations/instagram-via-instagram-business-login) — professional account/testers, callbacks and webhook-mode caveat.
- Meta's direct developer documentation returned a login wall in this session. No authenticated Meta dashboard state was inspected, so account-specific eligibility is unverified.

Related: [CH2_OWNER_ACCEPTANCE.md](CH2_OWNER_ACCEPTANCE.md), [CHECKLIST.md](CHECKLIST.md) A1/B/C-CH2 and [phase plan](05_Phase_Plan_WBS.md).
