# OS PLUS Chat & Leads — Product Requirements

Status: PLANNED (2026-10-05). Not started. Build begins only when the owner directs (see `07_Codex_Build_Prompt.md` § routing).

## 1. Problem

Small service businesses (laundry, boutiques, salons, clinics, repair shops) take most enquiries on WhatsApp and Instagram. Today:

- messages sit on one owner's phone; nobody else sees them;
- replies take hours, or never happen;
- nobody knows how many enquiries came in, how many became customers, or what they were worth;
- an enquiry that becomes an order is typed again by hand into the business system.

OS PLUS will implement this module for entirely new businesses. Existing implementations are structural references only; their workflows, language, branding, credentials and models are not inherited.

## 2. Users

| User | Needs |
|---|---|
| Owner (tenant `owner_admin`) | See every enquiry and its value; trust the bot; daily summary on Telegram; configure brands, channels, bot facts. |
| Manager | Reply, assign, move stages, convert to customer, book. |
| Front-desk / staff | Reply in Chatwoot (web or mobile app), act on handoff tasks. |
| Platform super admin (us) | Create the tenant's Chatwoot account, enable the module, connect channels, monitor cost and health across tenants. |
| End customer | Fast, correct answers in their language; booking without friction; a human when needed. |

## 3. Scope — v1

### 3.1 Channels (all through Chatwoot)
- WhatsApp Business (Cloud API) — primary channel; can book and share statements.
- Instagram DMs.
- Facebook Messenger.
- Website chat — the Chatwoot website widget on the tenant's site, answered by the same agent. Captures a phone number before booking.

Per channel the tenant chooses the agent mode: `off`, `draft` (suggestions only), or `auto` (sends directly). Default for a new channel is `draft`.

### 3.2 Multi-brand, multi-branch
- One tenant may run several brands. Each brand has its own name, persona, languages, knowledge pack and channels.
- A brand may have several branches (OS PLUS `tenant_locations`). The agent picks the nearest branch from the customer's area/pin/map link, using the brand's branch list.
- Staff can be grouped by branch with Chatwoot teams; leads carry `brand_id` and `location_id` for filtering and reporting.

### 3.3 Shared inbox (Chatwoot)
- Staff reply in Chatwoot. OS PLUS adds:
  - **Draft buttons** — "Send as is" / "Edit" under each agent suggestion (Chatwoot Dashboard Script, installation-wide, tenant-neutral).
  - **Lead card** — a Chatwoot Dashboard App iframe showing the lead's stage, owner, value, notes, linked customer and orders, with stage/owner/notes actions.

### 3.4 AI agent
Proposed guarded-agent capabilities (see `03_Agent_Spec.md`). Business-specific behaviour, booking flows, language/script, messages, timings and models require the new business's configuration and approval; structural reference behaviour is not automatically approved:
- reads the whole conversation, the contact's own history and the brand's knowledge pack; writes a short, structured reply using the new brand's approved language and script configuration;
- answers prices (indicative only), services, hours, areas, turnaround (never promised), branch locations with one map link;
- handles booking requests through the enabled OS PLUS capability and the new business's approved steps and required details;
- shares a statement link (never an amount) only on an exact phone match;
- says a locked sentence for payment claims and never confirms a payment;
- hands off complaints, damage, refunds, order status and anything uncertain to a person, with a task;
- goes quiet for the configured interval after a staff reply; says nothing after a bare "ok/thanks/👍" when nothing is open; never repeats a sentence; is not pushy;
- on Instagram/Facebook: answers information, and moves bookings and dues to WhatsApp with a code-written link carrying the lead's ref;
- transcribes voice notes, answers them, and posts the transcript as a private note;
- target reply time ~5 s from the customer's message; no typing indicator.

### 3.5 Contacts and leads (OS PLUS pages)
- **Lead inbox:** counters (open, awaiting first reply, hot, open pipeline value), filters (brand, branch, channel, stage, owner), SLA clocks, hot / needs-a-person flags, newest first.
- **Lead detail:** conversation (read-only mirror), unsent suggestion, "what the bot drew on" chips, stage / owner / notes, history, "Open in Chatwoot", **Convert to customer**, **Create booking**.
- **Contacts:** stats, segments, search; record page with identities, preferences on file, leads, linked customer, orders, lifetime value; merge and split.
- **Performance:** owner/admin-only reporting on median first human reply, waiting / unassigned / flagged, per-person replies / owned / won / after-hours, needs-a-look queue.
- **Role settings:** owner/admin configures the viewer's Chat & Leads access per tenant. Existing Boutique/Laundry permission policies remain unchanged.
- **Dashboard widget:** "N enquiries waiting for a reply".

### 3.6 Contact → customer
- On WhatsApp, an exact E.164 match to an active tenant customer **links** automatically (link, never create).
- **Convert to customer** (button, or automatically when a booking is confirmed) runs the existing customer creation command with the platform customer rules (`docs/06_Rules.md` §3: name mandatory, E.164 normalisation, no duplicates, select existing on match).
- After linking, the lead's stage follows the customer's real records: booking request → booked; pickup/order created → picked up / in progress; order paid or delivered → won. Seven days of silence closes a new/engaged lead as lost.
- A Laundry tenant's confirmed booking creates a `laundry_pickup_requests` row through the existing Domain Command. A tenant without a booking capability gets a `LEAD_FOLLOW_UP` task instead.

### 3.7 Notifications
- One OS PLUS Telegram bot for the platform. A tenant links one or more Telegram chats (owner DM, staff group) with a one-time code.
- Instant alerts (configurable per target): new booking request, handoff, payment claim, agent failure.
- **Daily summary** at the tenant's chosen local time: chats, customer messages, bot/staff replies, real reply time, handoffs by reason, bookings, payment claims, tasks, new leads, won value, errors, model cost, and an experience rating (each chat scored by the judge rubric on a cheap model; the worst one linked).

### 3.8 Tenant settings → Chat & Leads
- Brands (name, persona name, languages, review link, knowledge pack editor with validation and versioning).
- Channels (list of Chatwoot inboxes, map to brand/branch, agent mode).
- Notifications (Telegram targets, events, summary time).
- Agent limits (monthly model budget; at the cap the agent drops to draft mode and alerts).
- **Try the bot** — a sandbox chat against the current knowledge pack (no Chatwoot, no writes) for onboarding.
- Website widget snippet for the brand's website channel.

### 3.9 Super admin
- Enable/disable the module per tenant.
- Create the tenant's Chatwoot account, admin user, agent bot and webhooks through the Chatwoot Platform/Account APIs; store tokens encrypted.
- Health: last webhook received, last turn, failure count, cost month-to-date, per tenant.

## 4. Non-goals (v1)

- Instagram comment automation is excluded; no assumed V2 commitment. Instagram DMs remain in scope.
- Broadcast / marketing campaigns. (Transactional outbound remains the existing communications foundation.)
- Telephony / missed-call leads.
- Website **voice** bot.
- Auto-posting payments from screenshots (a verification *task* is in scope as an optional phase; posting money is not).
- Replacing Chatwoot, or building a native inbox.
- Self-serve tenant signup for the module (super admin enables it).

## 5. Success measures

- Every inbound message on a connected channel produces a contact and a lead with no manual entry (100 % in the replay test; checked daily from `chat_conversations` vs `leads`).
- Median customer wait to bot reply ≤ 6 s (target 5 s), measured from `chat_messages`, not the turn timer.
- Drafts sent unchanged ≥ 70 % before a channel moves to `auto`.
- Zero cross-tenant data in any agent context, webhook resolution or page (automated tests, two-tenant fixture).
- Zero safety failures in the bench (amount stated without match, payment confirmed, invented date, leaked identity).
- Model cost per customer message measured and reported per tenant; no inherited cost baseline or production model selection.

## 6. Acceptance (module)

1. A message sent to a test tenant's WhatsApp, Instagram, Facebook and website channel each appears in Chatwoot, gets a draft (or auto reply), and creates a contact + lead visible in OS PLUS under the right brand and branch.
2. A booking taken in chat creates the booking record (pickup request or task) at the first ask and alerts Telegram; confirming moves the lead to booked and links or creates the customer.
3. A second tenant on the same Chatwoot install cannot see, receive, or influence the first tenant's data in any surface or test.
4. The daily summary arrives for each tenant at its own time with correct counts.
5. A new client can be onboarded by following `CHECKLIST.md` Part D without code changes.
