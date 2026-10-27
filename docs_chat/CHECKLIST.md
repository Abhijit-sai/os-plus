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

- [ ] B1 Hetzner → new server (O2; 8 GB RAM class, Ubuntu LTS), SSH key only, firewall: 22 (your IP), 80, 443. **Enable Hetzner Cloud Backups.**
- [ ] B2 DNS: `A chat.<domain>` → the server IP.
- [ ] B3 Follow `deploy/chatwoot/README.md`: swap, `.env` secrets, `db:chatwoot_prepare`, `up -d`, Caddy, open `https://chat.<domain>` → create the **super admin**.
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
| [x] | **CH-7** Telegram & summary — ACCEPTED LOCAL, CHAT-D055 | Owner accepted reported local results2026-10-27 and authorized local closure/commit plus CH8 planning. Real Telegram and judge testing explicitly deferred/unexecuted/release-blocking. See [CH7_QA.md](CH7_QA.md), [CH7_OWNER_ACCEPTANCE.md](CH7_OWNER_ACCEPTANCE.md) C7-L1–L7 and [CH7_BOUTIQUE_QA.md](CH7_BOUTIQUE_QA.md). Mock-only234/234/sixgates/two-tenant once-per-date delivery pass; no realTelegram or judge acceptance. First test local settings/preview without new keys; do not paste synthetic codes into a real bot. Later with explicit live approval: Settings → Notifications → link your DM and a staff group with `/start <code>`. Set the summary time 10 minutes ahead → check it arrives once. Set up the selected independent hourly scheduler (O7), without changing any existing business's infrastructure. |
| [ ] | **CH-8** Voice & images | Send a voice note (transcript note appears, reply is right). Payment screenshot handling is excluded (CHAT-D023). |
| [ ] | **CH-9** Website chat | In Chatwoot add a **Website** inbox for the test brand → map it in OS PLUS → paste the snippet into a test page → chat → lead appears. |
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
