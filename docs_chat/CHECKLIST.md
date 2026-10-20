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
- [ ] A2.1 Choose the platform domain (O1). Once selected, connect the platform domain and use one `chat.<domain>` hostname for both Chats and Leads. OS PLUS remains on Vercel; final path routing/authentication must be verified. Domain selection can follow placeholder-based local preparation.
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
1. Open Codex in the current approved chat worktree (`D:\Develop\os-plus-chat-ch0` for CH-0) → paste `07_Codex_Build_Prompt.md` (the part between the lines).
2. Answer the decisions Codex lists.
3. Do the "You" steps for that phase below.
4. When Codex reports `READY_FOR_CLOSURE`: read its report, try the feature yourself, complete the required owner acceptance; CHAT-D025 already authorizes local phase commits after all gates pass.
5. Apply the phase's migrations to the database yourself (or explicitly authorise Codex to), then deploy.

| ☐ | Phase | You |
|---|---|---|
| [x] | **CH-0** Baseline, decisions, deploy kit | O3/O6/O7 resolved; domain selection may follow local placeholder-based preparation. Review `deploy/chatwoot/` and `examples/new-business.pack.json`. Then do Part B. |
| [ ] | **CH-1** Foundation | Super admin: enable the module for a **test tenant** and a **second test tenant**. Create one brand + two branches. Paste a pack and publish it. |
| [ ] | **CH-2** Chatwoot connector | In Chatwoot, create the test tenant's account (or let Codex's onboarding do it); connect one **test WhatsApp number**; paste the two webhook URLs Codex shows. Send a message → check it appears in OS PLUS. |
| [ ] | **CH-3** Contacts & leads | Message from two phones, one of them an existing test customer. Check: two contacts, two leads, one linked to the customer. Try Convert to customer. |
| [ ] | **CH-4** Pages & lead card | Click through Leads, a lead, Contacts (merge/split), Performance on phone and laptop. Add the Dashboard App using the verified lead-panel route under `chat.<domain>` and check the lead card. Test viewer access disabled and enabled in tenant role settings, including server-side PII masking. |
| [ ] | **CH-5** Agent (draft) | Approve the cheap-model test cost. Use **Try the bot**. Send real test messages → drafts appear with Send as is / Edit (needs B8). |
| [ ] | **CH-6** Actions & auto | Book a test pickup/appointment by chat → booking record at the first ask, task when needed. Ask for dues, claim a payment, complain → check the locked replies and handoffs. Switch the test channel to auto and repeat. |
| [ ] | **CH-7** Telegram & summary | Settings → Notifications → link your DM and a staff group with `/start <code>`. Set the summary time 10 minutes ahead → check it arrives once. Set up the selected independent hourly scheduler (O7), without changing any existing business's infrastructure. |
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
- [ ] Rotate a secret: Chatwoot tokens / webhook secret per workspace (super admin), Telegram token, OpenRouter key, `CHAT_SECRETS_KEY` (versioned — re-encrypt).
- [ ] A client changes prices or hours → edit the pack → Try the bot → publish.
- [ ] Meta tokens expire or a page is disconnected → reconnect the inbox in Chatwoot; the workspace health shows silence first.
