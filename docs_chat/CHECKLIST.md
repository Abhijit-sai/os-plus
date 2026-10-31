# Chat & Leads — Owner's Checklist

Work top to bottom. Every box is one action. **You** = the owner; **Codex** = the build session started with `07_Codex_Build_Prompt.md`.

Parts:
- **A** — Start today (things with long waiting times)
- **B** — Platform server and Chatwoot (once)
- **C** — Build with Codex, phase by phase
- **D** — Onboard a client (repeat per client)
- **E** — Keep it running

---

## A. Start today — long waits first

### A1. Meta (the slowest part: days to weeks)
- [ ] A1.1 Meta Business Suite → Business settings → **Security Center → Start business verification** for the business that will own the platform Meta app. Keep GST/registration documents and a matching website ready.
- [ ] A1.2 developers.facebook.com → **Create app** (type: Business), owned by that verified business. Use the new platform branding.
- [ ] A1.3 Add the products **WhatsApp**, **Messenger** and **Instagram** to the app.
- [ ] A1.4 Publish a **privacy policy**, **terms** and a **data deletion instructions** page on the platform domain (Meta review requires all three URLs).
- [ ] A1.5 Note what app review will ask for: Instagram messaging and Messenger permissions (e.g. `instagram_business_manage_messages`, `pages_messaging`, and the pages/instagram basic permissions Chatwoot requests). The review needs a screencast of a working inbox, so it is submitted after B (step B6).
- [x] A1.6 O3 direction resolved: central provider-managed Meta onboarding with separately authorised business assets. Manual WhatsApp onboarding initially.

### A2. Accounts and names
- [ ] A2.1 Choose the platform domain (O1). Once selected, connect the platform domain and use `chat.<domain>` for Chatwoot, opened from OS PLUS Chats. Leads remains in OS PLUS (CHAT-D029). OS PLUS remains on Vercel; final path routing/authentication must be verified. Domain selection can follow placeholder-based local preparation.
- [ ] A2.2 OpenRouter: create a fresh key for the new platform, set a monthly credit limit.
- [ ] A2.3 Telegram → @BotFather → `/newbot` → platform bot name and username → keep the token for `TELEGRAM_BOT_TOKEN`. Create a private "Platform alerts" group, add the bot, and keep its chat id.
- [x] A2.4 Owner approved an isolated CH-0 worktree from deployed origin/main and copying its untracked `docs_chat` files. Use `D:\Develop\os-plus-chat-ch0`; original Shopify and documentation worktrees remain untouched. CH-0 closed and committed locally as 4f74bd6; current branch is codex/chat-ch1-foundation. No public release implied.

---

## B. Platform server and Chatwoot (once)

Needs the deploy kit from **CH-0** (`deploy/chatwoot/`).

- [ ] B1 Hetzner → new server (O2; accepted 4 GB CPX22 / Ubuntu 26.04 LTS under D063–D065; validate capacity before live use), SSH key only, firewall: 22 (your IP), 80, 443. **Enable Hetzner Cloud Backups.**
- [ ] B2 DNS: `A chat.<domain>` → the server IP.
- [ ] B3 Follow `deploy/chatwoot/README.md`: bounded 4 GB profile (no swap; historical swap instruction superseded), fresh `.env` secrets, `db:chatwoot_prepare`, `up -d`, Caddy, open `https://chat.<domain>` → create the **super admin**.
- [ ] B4 Chatwoot Super Admin → **Platform Apps** → create one → keep the token for `CHATWOOT_PLATFORM_TOKEN`.
- [ ] B5 Chatwoot Super Admin → Settings → app config: enter the Meta app id/secret for Facebook and Instagram (and WhatsApp embedded-signup ids if O4 chose it). Restart.
- [ ] B6 Create a **demo account** with one Instagram and one Facebook test page connected → record the screencast → **submit Meta app review** (A1.5).
- [ ] B7 Install the backup cron from the kit after a successful isolated restore drill; check the encrypted archive, freshness marker and cron/host-monitor failure alert. Telegram integration arrives in CH-7.
- [ ] B8 Chatwoot Super Admin → Settings → **Dashboard Scripts**: add `<script src="https://app.<domain>/chatwoot/osplus-reply.js"></script>` (after CH-5 ships the file).

---

## C. Build with Codex, phase by phase

For **every** phase:
1. Open Codex in the current approved chat worktree (`D:\Develop\os-plus-chat-ch0`, current branch `codex/chat-ch1-foundation`) → paste `07_Codex_Build_Prompt.md` (the part between the lines).
2. Answer the decisions Codex lists.
3. Do the "You" steps for that phase below.
4. When Codex reports `READY_FOR_CLOSURE`: read its report, try the feature yourself, complete the required owner acceptance; CHAT-D025 already authorizes local phase commits after all gates pass.
5. Apply the phase's migrations to the database yourself (or explicitly authorise Codex to), then deploy.

| ☐ | Phase | You |
|---|---|---|
| [x] | **CH-0** Baseline, decisions, deploy kit | O3/O6/O7 resolved; domain selection may follow local placeholder-based preparation. Review `deploy/chatwoot/` and `examples/new-business.pack.json`. Then do Part B. |
| [x] | **CH-1** Foundation | Local implementation and automated evidence are in [CH1_QA.md](CH1_QA.md); real Clerk owner-a setup and all 14 local Boutique Tier A paths now pass ([authenticated QA](CH1_AUTHENTICATED_QA.md)); independent owner-b/platform denial passes, authenticated390px iframe evidence accepted, and owner acceptance CHAT-D030 recorded. The isolated local database/API is now available; follow [CH1_LOCAL_QA.md](CH1_LOCAL_QA.md) for private Clerk keys, test logins and accepted owner checklist C1–C8. Super admin: enable the module for a **test tenant** and a **second test tenant**. Create one brand + two branches. Paste a pack and publish it. |
| [x] | **CH-2** Chatwoot connector (LOCAL closure CHAT-D034; Meta deferred) | Local two-account connector and owner reply acceptance complete: [CH2_QA.md](CH2_QA.md), CHAT-D034. Still pending production gate: connect approved test WhatsApp and capture real channels via [CH2_META_TESTING.md](CH2_META_TESTING.md). |
| [x] | **CH-3** Contacts & leads — CLOSED LOCAL, CHAT-D038 | Owner accepted local evidence and explicitly deferred two-real-phone/WhatsApp proof until Meta resumes. Commit0d22491; [CH3_QA.md](CH3_QA.md). Real-phone proof remains unexecuted/release-blocking, not PASS. |
| [x] | **CH-4** Pages & lead card — ACCEPTED LOCAL, CHAT-D039 | [CH4_OWNER_ACCEPTANCE.md](CH4_OWNER_ACCEPTANCE.md) C4-L1–L5 covers complete local QA, saved card and CH4.2 dependency alignment.  Click through Leads, a lead, Contacts (merge/split), Performance on phone and laptop. Add the Dashboard App using the verified lead-panel route under `chat.<domain>` and check the lead card. Test viewer access disabled and enabled in tenant role settings, including server-side PII masking. |
| [ ] | **CH-5** Agent (draft) | Approve the cheap-model test cost. Use **Try the bot**. Send real test messages → drafts appear with Send as is / Edit (needs B8). |
| [ ] | **CH-6** Actions & auto | Under D045–D049: first ask → provisional request; verify customer confirmation and separate owner/manager approval before operational pickup/callback task. Callback is not a reserved appointment. Test pending edits/withdrawal and operational-change handoff. Statements deferred: dues/payment claims/complaints hand off. Verify request-only price images, neutral opt-in reviews, channel rules and separately approved local mock auto mode. CH6 engineering QA complete2026-10-27; CLOSED LOCAL underD025/D050 after final records/diff review and authorized phase commit. Authenticated effective-role/tenant/375CSSpx frames and fresh Boutique14/14 pass. Owner/live acceptance deferred under D050, not executed. Local mock owner steps: CH6_OWNER_ACCEPTANCE.md C6-L0–L7; engineering evidence CH6_QA.md. |
| [x] | **CH-7** Telegram & summary — CLOSED LOCAL445770b, CHAT-D055 | Owner accepted reported local results2026-10-27 and authorized local closure/commit plus CH8 planning. Real Telegram and judge testing explicitly deferred/unexecuted/release-blocking. See [CH7_QA.md](CH7_QA.md), [CH7_OWNER_ACCEPTANCE.md](CH7_OWNER_ACCEPTANCE.md) C7-L1–L7 and [CH7_BOUTIQUE_QA.md](CH7_BOUTIQUE_QA.md). Mock-only234/234/sixgates/two-tenant once-per-date delivery pass; no realTelegram or judge acceptance. First test local settings/preview without new keys; do not paste synthetic codes into a real bot. Later with explicit live approval: Settings → Notifications → link your DM and a staff group with `/start <code>`. Set the summary time 10 minutes ahead → check it arrives once. Set up the selected independent hourly scheduler (O7), without changing any existing business's infrastructure. |
| [x] | **CH-8** Voice notes, CLOSED LOCAL under CHAT-D058 | Owner accepted reported local results2026-10-28 and explicitly deferred live testing; local commit authorized before CH9. Earlier pending-owner wording below is historical evidence, not a live gate PASS. See [CH8_QA.md](CH8_QA.md), [CH8_OWNER_ACCEPTANCE.md](CH8_OWNER_ACCEPTANCE.md) C8-L1–L7 and [CH8_IMPLEMENTATION_PLAN.md](CH8_IMPLEMENTATION_PLAN.md), accepted CHAT-D056/D057: one note up to120s/10MB; transcript supports inquiries/provisional requests, typed confirmation plus staff approval still required. Local mock-only first; no new key/provider needed. Later owner acceptance requires private transcript note, correct guarded reply and tenant/role isolation. Real transcription/WhatsApp speech accuracy remains untested/disabled until separately authorized. Payment screenshot handling excluded (CHAT-D023). |
| [x] | **CH-9** Website chat — accepted LOCAL, CHAT-D059 | Owner accepted reported local results and authorized local commit/CH10 planning and local checks,28October2026. Actual widget/pre-chat→lead/private suggestion/staff-approved reply, focused settings, roles/tenant/375px/TierB and264Chat pass. Two frozen SQL LOCAL104→106 only. [CH9_QA.md](CH9_QA.md), [CH9_OWNER_ACCEPTANCE.md](CH9_OWNER_ACCEPTANCE.md), [CH9_LOCAL_UPGRADE.md](CH9_LOCAL_UPGRADE.md), [CH9_BOUTIQUE_QA.md](CH9_BOUTIQUE_QA.md). LiveAI disabled; server/domain/Meta later. No production release. |
| [ ] | **CH-10** Hardening & go-live | Approve the bench cost. Read the leakage and failure-drill results. Run Part D for the second test tenant **without code changes**. Then onboard the first real client. |

---

## D. Onboard a client (repeat per client)

### D1. Collect from the client (one form or call)
- [ ] Business name, brands, branches (address, map link, areas/pins served, hours, Sunday/holiday rules).
- [ ] Services, indicative prices, turnaround ranges, booking windows, minimum order, express (yes/no), price-list image.
- [ ] Policies (damage, refunds, delivery), handoff topics, review link.
- [ ] Locked sentences they want (payment claim, identity, vendor, handoff) — or accept the defaults.
- [ ] Languages their customers write in.
- [ ] Staff who will reply (name, email, role, branch).
- [ ] Channels: WhatsApp number (Cloud API ready? on the WhatsApp app today?), Instagram account, Facebook page, website.
- [ ] Telegram: owner and staff group.

### D2. Set up in OS PLUS
- [ ] Create the tenant (if new) and its users; add branches as tenant locations.
- [ ] Super admin → Chat workspaces → **enable the module** → **create the Chatwoot account** (admin user = client owner's email).
- [ ] Settings → Chat → create brands, map branches.
- [ ] Use the synthetic `examples/new-business.pack.json` only as a schema guide → replace all example facts and policy wording from this new client's D1 requirements → validate → owner review → publish. Never reuse another client's facts or credentials.
- [ ] **Try the bot**: 10 typical questions + 1 booking + 1 complaint + 1 "are you human?". Fix the pack until right.

### D3. Connect channels (in Chatwoot, logged in as super admin or the client admin)
- [ ] **WhatsApp:** Inboxes → Add → WhatsApp → WhatsApp Cloud (manual: phone number id, WABA id, permanent system-user token, verify token → set the webhook + verify token in the Meta app, subscribe to `messages`) — or embedded signup if enabled. The client's WABA needs a payment method for conversation charges.
- [ ] **Instagram:** Inboxes → Add → Instagram → log in with the client's account (needs the approved Meta app).
- [ ] **Facebook:** Inboxes → Add → Messenger → log in → pick the page.
- [ ] **Website:** Inboxes → Add → Website → brand colours, pre-chat form asking for name + phone.
- [ ] Back in OS PLUS → Settings → Chat → Channels → **Sync inboxes** → map each to brand/branch → mode **draft**.
- [ ] Teams per branch in Chatwoot; invite staff as Chatwoot agents; link each to their OS PLUS user.
- [ ] Settings → Notifications → link owner DM + staff group; set the summary time.
- [ ] Give the client the website widget snippet.

### D4. Test, then go live
- [ ] One message per channel from a test phone/account → reply draft, contact, lead, right brand and branch.
- [ ] One full booking on WhatsApp → booking record + Telegram alert.
- [ ] Show staff: Send as is / Edit, lead card, Leads page, handoff tasks.
- [ ] Live in **draft** for one week. Check drafts-sent-unchanged and the daily summaries.
- [ ] Switch WhatsApp (then website) to **auto** with the owner's OK; Instagram/Facebook usually stay draft.
- [ ] Set the client's monthly model budget.

---

## E. Keep it running

**Daily (2 minutes)**
- [ ] Read the platform alerts group. Any agent failures or webhook silence → open the tenant's health in super admin.

**Weekly**
- [ ] Super admin → Chat workspaces: last event per tenant, failures, cost month-to-date.
- [ ] Skim each tenant's lowest-rated chat from the daily summary; adjust the pack.
- [ ] Check the backup heartbeat and the latest archive size.

**Monthly**
- [ ] Chatwoot upgrade: read the release notes → bump the tag → `db:chatwoot_prepare` → `up -d` → send a test message on every channel kind.
- [ ] Server updates and reboot in a quiet hour.
- [ ] Restore test: restore last night's dump into a throwaway database and compare row counts with the manifest.
- [ ] Bill or review each tenant's model cost.

**When something changes**
- [ ] Rotate a secret: Chatwoot tokens / webhook secret per workspace (super admin), Telegram token, OpenRouter key, `CHAT_SECRETS_KEYS` + `CHAT_SECRETS_ACTIVE_VERSION` (retain old versions until ciphertext is re-encrypted and verified; see CH1_QA.md).
- [ ] A client changes prices or hours → edit the pack → Try the bot → publish.
- [ ] Meta tokens expire or a page is disconnected → reconnect the inbox in Chatwoot; the workspace health shows silence first.

### CH-2 local evidence checkpoint — 2026-10-21
Local six gates, 64 Chat tests, actual Next capture and OS PLUS 121-table restore pass. Actual local Chatwoot website visitor/staff exchange, two-account isolation, authenticated inbox sync, helper restart and native Chatwoot 100-table restore also pass. See [CH2_QA.md](CH2_QA.md) and [local owner test instructions](../scripts/chatwoot-local/README.md). CH-2 acceptance remains unchecked: owner-scenario post-change Boutique critical paths now pass; real Meta channel evidence, formal owner phase acceptance remain pending; QA tracker reconciliation is now complete (see CH2_BOUTIQUE_QA.md). Server/domain is unnecessary for local testing; hosted Meta checks still require explicit authority.


Owner-facing CH-2 local checks and the separate full-phase gate: [CH2_OWNER_ACCEPTANCE.md](CH2_OWNER_ACCEPTANCE.md). OS PLUS owner-a login is distinct from Chatwoot owner1 login. Owner-a session is now verified and all14 policy critical paths executed; see CH2_BOUTIQUE_QA.md for scope and evidence. User inquiry is open in Chatwoot account901 conversation6.

### Final local / Meta preparation checkpoint — 2026-10-21
Owner confirmed reply works. Actual private-note privacy, owner-a inbox sync,10/10 two-account runtime checks,5/5 pending/capture checks,7/7 Boutique persistence groups pass;14 owner-scenario critical paths are recorded. QA workbook repaired and preservation/visual checks complete. Follow [CH2_META_TESTING.md](CH2_META_TESTING.md) before A1/B5/B6/C-CH2: current Instagram Business Login replaces old Basic Display guidance; app-specific sandbox restrictions and required HTTPS endpoint approval must be checked. No server/domain purchase is needed just to prepare test assets; no public tunnel or real Meta test is authorised/active. Full phase remains QA_BLOCKED.


## CH-3 local technical checkpoint — 2026-10-21
Agent-executed local technical evidence: [CH3_QA.md](CH3_QA.md), [Boutique regression](CH3_BOUTIQUE_QA.md). Three migrations applied only to isolated LOCAL15437 with real pre/post restores; Chat100/100, provider10/10, CRM2/2, Boutique14/14 owner scenario and7 persistence groups PASS. Desktop/authenticated390px iframe smoke PASS, with documented limits.
- [x] Owner C3-L1–L4: accepted under CHAT-D038; [CH3_OWNER_ACCEPTANCE.md](CH3_OWNER_ACCEPTANCE.md).
- [x] Explicit local-progression deferral of PartC CH-3 two-real-phone exercise: CHAT-D038. Exercise remains unexecuted/release-blocking.
- [ ] Actual Meta/WhatsApp/IG/FB wire and channel acceptance before production release. Still deferred/unexecuted, never PASS.
No new Clerk keys needed; existing owner-a session works. CH3 owner gate passed under D038 and local commit0d22491 completed; earlier pending/QA_BLOCKED CH2/CH3 checkpoints above are historical and superseded by D034/D038.


## CH-4 local technical checkpoint — 2026-10-22
[CH4_QA.md](CH4_QA.md), [Boutique14](CH4_BOUTIQUE_QA.md), [local upgrade/restore](CH4_LOCAL_UPGRADE.md).
- [x] Six automated gates; latest Chat119/119, provider10/10, anonymous ingress6/6; counts overlap.
- [x] Only20261021140000_chat_crm_reads.sql applied to isolated LOCAL15437;128 existing-table manifests preserved and both real dumps restored/ACL checked. No shared SQL.
- [x] Owner/manager and configurable viewer/finance privacy, native record boundaries, two-tenant selector/copied URLs,375px authenticated layout/edit and actual Chatwoot card render/save/fallback tested within recorded limits.
- [x] Owner replied "saved"; persisted stage/owner/note and audit verified. A second save or full phase acceptance is not inferred.
- [x] Boutique14/14 owner scenario and7/7 persistence; workbook14 dated notes repaired with package/style/value preservation and visual checks. Renderer exits1 after valid export/previews, independently validated.
- [x] Full owner CH4 acceptance under CHAT-D039 including CH4.2 generation/provenance CH5 and booking CH6 dependency alignment: [CH4_OWNER_ACCEPTANCE.md](CH4_OWNER_ACCEPTANCE.md) C4-L1–L5. Gate satisfied; final local commit before CH5 planning.
- [ ] Existing Meta/two-real-phone/channel production-release proof remains deferred/unexecuted, never PASS. Separate Shopify hosted OAuth/renewal and n8n remain pending.


CH4 post-commit record,2026-10-22: CLOSED LOCAL atf9d195c02388bdcf17c8fb25a294dac32bbe9fe3 under CHAT-D039. Supersedes earlier pending/READY wording; no production release. CH5 planning is recorded separately in CH5_IMPLEMENTATION_PLAN.md; no agent implementation yet.


2026-10-22 CH5 interim: IN_PROGRESS, mock-only rules/runtime/preview source; latest automated evidence and pending implementation/owner gates in [CH5_QA.md](CH5_QA.md). PartC CH5 and B8 remain unchecked. Retained app still CH4; no owner action/new keys required yet, no live-model/Meta readiness claim.


## CH-5 local mock checkpoint —2026-10-22
Supersedes earlier CH4-retained/interim wording. [Current QA](CH5_QA.md),[Boutique14](CH5_BOUTIQUE_QA.md),[owner test C5-L1–L6](CH5_OWNER_ACCEPTANCE.md).
- [x] Six final gates,Chat168/168 after native-composer correction and fresh-chat mock opt-in,provider10/10,actualbrowserSend/Edit+verifiedcapture2/2,anonymousHTTP7/7.
- [x] Four exact additive SQL files applied ONLY ownedLOCAL15437 with actual pre/postrestores,128existingtable manifests preserved; appliedbytesfrozen.
- [x] Ownerpreview/fallback,managerdraftread/edit and report/previewdenial,viewermasking/revocation,financedefaultdenial,two-tenantURLs,authenticated375pxpreview/provenance within documented limits.
- [x] FreshBoutiqueTierA14/14 owner scenario,persistence7/7;QAworkbook14datednotes/height-only preservation and visualchecks.
- [x] B8 LOCAL ONLY: reviewed script installed in previouslyempty owned4.18 DASHBOARD_SCRIPTS; actual native controlsendtestsPASS. OriginalB8productionstep remainsunchecked.
- [x] Owner local C5-L1–L7 evidence acceptance under CHAT-D044; A14 verified sent; A15 unsent; C5-L7 enables fresh synthetic enquiries under CHAT-D043. ExistingClerklogin,no newkeys.
- [ ] PartC CH5 cheap paid-model smoke and realWhatsAppdraft acceptance remainunexecuted and release-blocking, explicitly deferred for LOCAL closure under CHAT-D044. LiveAIoff; local mock engine/private drafts opt-in under D043;USD0.
- [ ] Meta/two-phoneproductionproof and separateShopifyhostedOAuth/renewal/deferredn8n remainpending. Noexternalreleaseauthority.

### CH5 local closure — 2026-10-22
Owner accepts combined local C5-L1–L7 evidence and explicitly defers paid/live/realWhatsApp under CHAT-D044. Six gates168/168, actualfresh5/browser2, frozen4LOCALSQL/restore, priorTierA14/persistence7 and focused final reviewers PASS. CH5 CLOSED LOCAL; local phase commit under D025/D044. PartC paid/live/realWhatsApp and B8production remain unchecked/release-blocking. No CH6 work or external release.

## CH-10 local checkpoint — 28 October 2026
CH-9 accepted/committed locally as fcf0ebc under D059. Available CH-10 local checks pass: two synthetic brands30, actual loopback failure/gate14, actual disposable PostgreSQL3; full Chat311 and all six gates. See CH10_QA.md. This does not check off the CH-10 cost/judge/live acceptance row or D1–D4 real-client steps. CH10_RELEASE_READINESS.md lists the missing production orchestrator/provider/privacy work, server/domain/Meta/Telegram/STT/judge/hosted acceptance and actual draft-week gates. Those remain deferred/release-blocking; no keys, server purchase or settings repetition needed from the owner now. CH-10 QA_BLOCKED, live AI/STT disabled, no deployment.


## New host checkpoint — 30 October 2026 (partial Part B)
B1: owner-created4GB CPX22/Ubuntu26.04LTS confirmed; SSHkey-only verified. Providerfirewallrule/backups state not independently verified, so full B1 staysunchecked. B2exactDNS/TLSdeferred. B3privateboot/nativeDBinitialization and16syntheticflow/soakchecks pass, but publicHTTPS/realownerSuperAdmin setup remainpending. B4PlatformAppproductionbinding notconfigured. B5/B6Metadeferred. B7actualencryptedbackup/offhostverification andfreshisolated8-checkrestore pass; recurringcron/offsite-retention/failurealert acceptance stillpending, no scheduleactivated. B8hostedOSPLUSintegration notdeployed. Detailed evidence CH10_HOST_SETUP.md; do notcheckfullPartB/PartD/go-live frompartialsyntheticresults. LiveAI/STTdisabled, no realprovider messages orsharedSQL.


## 30 October 2026 — Phantom Threads owner DNS completed
B2's DNS A step was executed by the owner and verified from the server: chat.phantomthreads.in ->2.29.113.198; no AAAA observed. Public TLS is not enabled. Owner requests DNS questions directly, without DNS browser automation. B1 provider firewall/backups/fingerprint remain unverified. B3 HTTPS, operator roles/password recovery and storage security remain open; owner selects manual passwords/no invitation emails, not SMTP setup. B4 production binding, B5/B6 Meta, B7 independent recurring backup/alerts, B8 hosted integration and PartD stay open.
See CH10_PHANTOM_LAUNCH_PLAN.md for exact real/Test destination IDs, current main/build, native SQL rehearsal, public-host proposal and rollback. Raw Chat SQL has a confirmed pgcrypto schema compatibility blocker; separate qualified proposal tested only in disposable infrastructure. Full six-gate/manual/PartD/channel/staged acceptance is incomplete. No CH10 closure or production release.


## 30 October 2026 - Synthetic HTTPS acceptance complete; real business still blocked
Owner's explicit "yes. go ahead" authorized the presented existing-synthetic-only HTTPS activation. It completed at12:12:46UTC on30October on2.29.113.198, project osplus-chat-private. No further permission was inferred. https://chat.phantomthreads.in now serves Chatwoot with valid trusted TLS and HTTP redirect. Certificate SAN/chain verified externally without bypass (Let's Encrypt YE1; expires28January2027). Public browser login page rendered; no browser credentials entered. Native API password logins are a separate result, not proof of authenticated browser login/Clerk/SSO/mobile/OSPLUS linkage.

Fresh HTTPS native QA PASS18/18 on existing synthetic901/902: both password logins/account reads, visitor enquiry, private note hidden, public staff reply, foreign account token denied, attachment download/hash and ten bounded followups per account, private n8n health, service bounds and stability.22 incoming synthetic visitor messages total, no customer/provider transport.30 samples over354.9s; max aggregate app1678.1MiB, min host available1707.6MiB, no new crash/OOM/restart. This light test is not a production capacity guarantee. Do not combine overlapping historical groups into a unique total.

Checklist disposition: B2 DNS A and public certificate/redirect verified; B3 synthetic HTTPS checks complete within the above scope. Full B1/B3/B7/B8 and PartD stay open. Provider firewall/backups existence remains owner-confirmed, exact provider rules not independently inspected. Fingerprint comparison independently owner-confirmed through provider console marker. Real user/operator membership, password delivery/recovery and browser/role/mobile acceptance remain pending.901/902 are not real or Test tenant mappings. No Phantom Threads production binding, shared OSPLUS SQL, Vercel release, new real user/password/invitation, Meta/Telegram message or workflow activation.

CH10 QA_BLOCKED; READY_FOR_CLOSURE:NO; no local commit/push/merge. No canonical SQL or Boutique/Laundry/Shopify runtime change. Frozen106 migration history preserved. Live AI/STT/realTelegram OFF, n8n active workflows0. Feature model/STT/judge spendUSD0; no purchase. This completes the approved synthetic public-host slice only, not real-business go-live or full CH10 acceptance.


## 30 October 2026 - Verified release inventory and Test-first launch sequence
B4/B8 and PartD remain open. Add planned production Test checks PT-01 through PT-15 in CH10_PHANTOM_LAUNCH_PLAN.md; none executed by this audit. B5 WhatsApp-first scope now selected with a new private number ending6161; Meta business assets/number/inbox/token/callback/authorized phones/real inbound-reply proof still pending. B6 Instagram/Facebook explicitly later. Shopify real activation also needs reviewed same-shop cutover because it is presently bound only to Test; preserve historical Test data.

### Audit verification / status / next action
No application code, canonical SQL or deployment changed. Six platform commands were NOT rerun for this read-only/planning slice; earlier results remain dated evidence. Fresh production read-only schema/connection/channel inspection and Git/GitHub checks passed within stated limits; supplementary OAuth exact-body refresh timed out at connection and browser dashboard was unavailable. No new confirmed runtime bug; cutover/gating limitations and unresolved compatibility/regression are launch blockers. All existing work preserved; no stash/reset/switch/worktree/commit/push/merge/sharedSQL/real messages or account/credential changes. CH10 QA_BLOCKED, READY_FOR_CLOSURE:NO. Feature model/STT/judge spendUSD0. Next concrete engineering slice: final versioned Chat SQL/app release package and cross-surface native acceptance, plus a separate preservation-first Shopify real-account cutover design. No more DNS input is required now.


## 30 October2026 - Step1 candidate prepared; no release
Versioned release/rollback instructions: ../deploy/chat-release/20261030/README.md. Candidate35 hash3acfc26f7af98989d4957a6ab2d64ea2ceb871fca2235e5dc88dd336f61faab9;106 canonical bytes preserved. Fresh six platform gates now pass, including313/313 actual native Chat onPG16 and production-matching17.6; exact-package atomic/recovery7PASS. Standards/Spec targeted reviews0new confirmed findings. Exact evidence and failures retained in CH10_QA.md and SAMEsummary; CH10_RELEASE_REVIEW.md records both axes. This supersedes only earlier native-test-unavailable/raw-package-preparation blockers, not hosted/manual/Boutique/SSO/ops acceptance. B1/B3/B7/B8/PartD remainopen. Owner's enabledHetzner daily7-slot diskbackup acknowledged; allDockerdata onrootdisk confirmed, but application encryption/schedule/independentretention-alerts and separate freshsharedSupabasebackup remain distinct. No commit/deploy/sharedSQL/realbinding/message/workflow/AI/STT activation; CH10QA_BLOCKED. No new cost.


## 30October2026 - Owner defers backup work; Test-only scope prepared
CHAT-D069: owner says "no backups for now. We'll plan this later please." No backup/storage/upload/schedule action; existing Hetzner backups preserved. Authenticated separate Supabase project Free page has no scheduled project backups. Backup gate deferred/not PASS; no release authority inferred. Seven focused checks finalPASS (order UI9cases plus source/pure contracts), test-only feedback correction with unsafe-submit rejection; runtime/106SQL/candidate unchanged. Current-main Test browser read-only partials and interaction/mobile limits are in CH10_BOUTIQUE_RELEASE_QA.md; full Tier A/persona/mobile remains pending. Concrete staged flags and unchanged disabled-AI scope: ../deploy/chat-release/20261030/TEST_SCOPE.md and test-scope.json, proposal only. Same summary records exact commands/failures. CH10 QA_BLOCKED; no commit/sharedSQL/deploy/real message/workflow/AI/STT.


## 30October2026UTC - Interactive checks resumed; checkpoint review proposal
See CH10_BOUTIQUE_RELEASE_QA.md for fresh search/measurement/unsavedforms/GST/publicview and limits. Local2classfit-referenceoverflow fix; synthetic390/768/1440layout checks pass, wholeappnotcertified. Freshsixgates313/313ChatPG17.6 pass; exactSQLunchanged, no migrations. Standards0/Spec1testinventorygapfixed0remaining; latesttest-onlyguardfocusedcheck/lintpass. Main/Vercelc686337CurrentProductionReadyreverified. Candidate commit/push/DRAFTPR scope is deploy/chat-release/20261030/CHECKPOINT_PROPOSAL.md (relative torepo); approvalpending, not prodrelease/closure. Backupsremainowner-deferredD069; AI/STT/Telegram/workflowsOFF. CH10QA_BLOCKED. SAMEsummary updated with exact evidence/sourcehashes/failedattempts.


31 October2026 IST checkpoint note (CHAT-D070): owner explicitly approves preserved implementation checkpoint/branchpush/DRAFT PR only, not B1-B8/PartD acceptance or phase closure. Fresh production READ ONLY catalogue has0Chat relations/functions;35 additions still pending. New checkout-portability3/3 and narrow two-axis0findings preserve exact SQL hash and frozen106. Hosted/manual/security gates stay open; backup work deferred D069, live executionOFF.


31October2026IST CHAT-D071 observed schema update: owner manually executed combined35Chat SQL and reportsSuccess. READ ONLY production40tables/allRLS,69functions match reviewed candidate in definitions/effective permissions; detailed ACL variance and schema/ledger limits in CH10_QA.md. Zero module/workspace/channel enablement. SharedSQL installation is observed, not B1-B8/PartD/fullCH10 closure. HostedTest/browser/Boutique/persona/SSO/ops acceptance remain open; D069backups deferred/notPASS. No app promotion or realbinding/messages. Keep module/executionOFF.


31October2026IST CHAT-D072: owner "ch10 can be accepted, go ahead." CH10 implemented engineering scope accepted/CLOSED LOCAL; phase commit authorized underD025. Full PartsB/D, hosted Test/candidate Boutique/persona/mobile/SSO/ops and live-model/draft-week gates remain open production-release work. No unattendedAI/STT/Telegram/workflow enabled; backupsdeferredD069/notPASS. See CH10_OWNER_ACCEPTANCE.md. This supersedes only phase-acceptance status, not the unexecuted checkbox evidence.
