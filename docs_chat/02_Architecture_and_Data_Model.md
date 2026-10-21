# OS PLUS Chat & Leads — Architecture and Data Model

Everything here is a **proposal for the coding session to verify against the current code** before writing migrations. Where the existing repository already has a pattern (tenant context, service-role access, RLS policy style, Domain Commands, idempotency, permissions, route guards, Zod validation), follow the repository, not this document, and record the difference in the decision log.

## 1. Runtime pieces

| Piece | Where it runs | Owned by |
|---|---|---|
| Chatwoot CE (rails, sidekiq, postgres+pgvector, redis) | Platform Hetzner box, `chat.<platform-domain>` | Platform ops (deploy kit in `deploy/chatwoot/`) |
| OS PLUS web + API routes | Vercel | This repo |
| Database | Supabase Postgres | This repo's migrations |
| Model calls | OpenRouter | `src/integrations/openrouter` |
| Telegram bot | Telegram, webhook to OS PLUS | `src/integrations/telegram` |
| Scheduler | New isolated n8n instance beside Chatwoot, with separate database/storage/credentials; calls the secret-guarded endpoint. No existing business scheduler is reused. | `/api/chat/cron/*` |

The owner has not selected a production domain. CHAT-D029 supersedes the earlier shared-hostname mandate: OS PLUS Chats opens Chatwoot in a new tab at chat.<platform-domain>; Leads remains an OS PLUS workspace module. OS PLUS stays on Vercel; Chatwoot runs on a new isolated server. Domain placement does not authenticate Clerk to Chatwoot; secure one-login handoff remains separately implemented and verified.

## 2. Request flows

### 2.1 Every message (memory + leads) — account webhook
```text
Chatwoot account webhook (message_created, conversation_updated, contact_updated)
  → POST /api/chat/webhooks/chatwoot/{workspaceKey}/events?token=…
  → resolve workspace by workspaceKey; constant-time compare token hash  (404 on any mismatch)
  → assert payload.account.id == workspace.chatwoot_account_id
  → assert inbox is a registered chat_channel of this tenant   (unknown inbox → record + ignore)
  → 200 immediately; continue in after():
      upsert chat_conversations, insert chat_messages (unique on chatwoot_message_id = idempotent)
      resolve contact (exact identities only) → touch lead (clocks, first staff reply → owner)
      staff public reply → set conversation quiet_until = now + quiet_minutes
```

### 2.2 A customer message (the turn) — agent-bot webhook
```text
Chatwoot Agent Bot webhook (message_created, incoming, non-private)
  → POST /api/chat/webhooks/chatwoot/{workspaceKey}/agent?token=…
  → same resolution + assertions; channel.agent_mode == off → 200, nothing
  → 200 immediately; continue in after():
      run the turn (03_Agent_Spec.md) with tenant-scoped context only
      deliver: auto → public message; draft → private note "💬 Suggested reply"
      ACT through Domain Commands (booking request, task, label, contact attribute)
      SAVE chat_turns (understanding, decision, checks, cost, timings, outcome)
      enrich lead from the understanding
```

The pinned v4.18.0 message webhook carries the triggering message. AgentBotListener passes a signing secret to its webhook job; the older unsigned assertion is superseded. Our mandatory URL key/secret authentication remains in force; signature enforcement requires verified deployment wire evidence. Bot tokens may create messages but cannot read history; history comes from our own `chat_messages`.

### 2.3 Scheduled work — `/api/chat/cron/hourly` (Bearer secret)
- Advance lead stages from linked records; close silent leads as lost.
- For each tenant whose local time has just passed `summary_local_time`: build and send the daily summary (once per tenant per local day — idempotent on `(tenant_id, local_date)`).
- Refresh workspace health (last event, failures).

### 2.4 Telegram
- `/api/chat/webhooks/telegram?secret=…` (Telegram `secret_token` header verified).
- `/start <link-code>` in a DM or group links that chat to the tenant target that issued the code (code single-use, 30 min expiry).

## 3. Tenant resolution rules (non-negotiable)

1. A webhook's tenant comes **only** from the workspace found by the URL key + secret. Never from payload account ids, inbox names, phone numbers or contact attributes.
2. Every query inside a turn filters by that tenant id. The context loader takes `tenantId` as a required argument; no function in the agent path may query without it.
3. A conversation, contact, lead, customer, or booking id received from a payload or a model is looked up **within the tenant** before use.
4. Cross-tenant test: a two-tenant fixture with the same phone number in both tenants must produce two separate contacts, two leads, and agent contexts that each contain only their own tenant's history.

## 4. Tables

Conventions (match the repository): `uuid` ids, `tenant_id not null references tenants(id) on delete cascade`, `unique (tenant_id, id)` for composite foreign keys, `created_at / updated_at / created_by / updated_by / deleted_at` where the repo uses them, `set_updated_at()` triggers, RLS enabled, timestamped migration names (`YYYYMMDDHHMMSS_chat_*.sql`). Additive only — no changes to Boutique or Laundry tables except the explicitly listed check-constraint extensions in §4.9.

### 4.1 Module enablement and settings
```text
tenant_modules
  tenant_id, module_key ('chat_leads'), is_enabled, enabled_at, enabled_by, config_json
  unique (tenant_id, module_key)

chat_settings                      -- one row per tenant
  tenant_id (pk/unique), timezone ('Asia/Kolkata'), summary_local_time ('21:30'),
  quiet_minutes (60), lost_after_days (7), hot_hours (24),
  monthly_budget_usd (numeric, nullable = no cap), budget_action ('draft_only'),
  default_currency ('INR')
```

### 4.2 Chatwoot workspace
```text
chat_workspaces                    -- one per tenant
  id, tenant_id (unique), chatwoot_base_url, chatwoot_account_id,
  workspace_key (opaque random, used in webhook URLs; unique),
  webhook_secret_hash, api_token_enc, bot_token_enc, agent_bot_id,
  status ('pending' | 'active' | 'suspended'), last_event_at, last_error, last_error_at
```
Secrets are encrypted in the application (AES-256-GCM, private JSON keyring `CHAT_SECRETS_KEYS` plus `CHAT_SECRETS_ACTIVE_VERSION`, versioned authenticated prefix so keys can rotate). Plain tokens never reach the client or logs.

### 4.3 Brands, branches, knowledge
```text
chat_brands
  id, tenant_id, name, slug, persona_name ('<Brand> AI Assistant'),
  languages text[] (['en']), reply_style_json, review_url, website_url, is_active
  unique (tenant_id, slug)

chat_brand_locations               -- which branches a brand serves, with chat facts
  tenant_id, brand_id, location_id (→ tenant_locations), map_url, lat, lng,
  service_areas text[], service_postal_codes text[], hours_json, is_primary, sort_order
  unique (tenant_id, brand_id, location_id)

chat_knowledge_packs               -- versioned; the agent reads the latest published
  id, tenant_id, brand_id, version, status ('draft' | 'published' | 'archived'),
  pack_json (validated by the Zod schema in 03_Agent_Spec.md §4), published_at, published_by
  unique (tenant_id, brand_id, version)
```

### 4.4 Channels
```text
chat_channels                      -- one per Chatwoot inbox
  id, tenant_id, workspace_id, brand_id, default_location_id (nullable),
  chatwoot_inbox_id, kind ('whatsapp' | 'instagram' | 'facebook' | 'website'),
  name, agent_mode ('off' | 'draft' | 'auto'), can_book (bool), can_share_statement (bool),
  whatsapp_number_e164 (for the hand-off link from IG/FB/website), is_active
  unique (tenant_id, workspace_id, chatwoot_inbox_id)
```

### 4.5 Contacts and identities
```text
chat_contacts
  id, tenant_id, display_name, prefs_json, notes,
  customer_id (nullable; FK (tenant_id, customer_id) → customers),
  merged_into (nullable self FK), first_seen_at, last_seen_at

chat_contact_identities
  id, tenant_id, contact_id, kind ('phone' | 'instagram' | 'facebook' | 'chatwoot_contact' | 'email' | 'web_visitor'),
  value (phone: E.164; others: platform id), verified, source
  unique (tenant_id, kind, value)
```
Resolution is exact-match only, never fuzzy, and never auto-merges two existing contacts. Merge and split are manual, audited (`lead_events` kind `merged` / `split` on the affected leads, plus a domain event).

### 4.6 Conversations, messages, state, turns
```text
chat_conversations
  id, tenant_id, channel_id, chatwoot_conversation_id, chatwoot_contact_id, contact_id,
  status, quiet_until, last_customer_at, last_staff_at, last_bot_at
  unique (tenant_id, channel_id, chatwoot_conversation_id)

chat_messages                      -- our own memory of every message, all authors
  id, tenant_id, conversation_id, chatwoot_message_id, author ('customer' | 'staff' | 'bot' | 'system'),
  private, content, content_type, attachments_json, transcript (voice notes),
  staff_chatwoot_user_id, created_at
  unique (tenant_id, chatwoot_message_id)

chat_state                         -- the code-owned ledger per conversation
  tenant_id, conversation_id (unique), ledger_json (open task, promises made, things sent,
  booking draft, price list sent, review asked), updated_at

chat_turns                         -- one row per agent run; the audit + metrics source
  id, tenant_id, conversation_id, trigger_message_id, engine ('osplus-v1'), knowledge_pack_version,
  mode ('auto' | 'draft' | 'sandbox'), outcome ('sent' | 'drafted' | 'silent' | 'handoff' | 'fallback' | 'error'),
  understanding_json, decision_json, reply_text, checks_json, models_json,
  cost_usd, timings_ms_json ({load, understand, act, write, deliver}), error, created_at
```

### 4.7 Leads
```text
leads
  id, tenant_id, ref_code (5 chars, no 0/O/1/I/L), brand_id, location_id, channel_id, channel_kind,
  contact_id, conversation_id, customer_id,
  kind ('sales' | 'service' | 'spam'), intent, services text[], area,
  stage ('new' | 'engaged' | 'booked' | 'in_progress' | 'won' | 'lost'), lost_reason,
  owner_tenant_user_id (FK (tenant_id, id) → tenant_users), est_value, currency, gist, handoff,
  booking_subject_type, booking_subject_id,         -- e.g. laundry_pickup_request / task
  order_id,
  first_customer_at, first_response_at, first_human_response_at, last_customer_at, last_reply_at,
  closed_at
  unique (tenant_id, ref_code)
  index (tenant_id, stage, last_customer_at desc), (tenant_id, contact_id), (tenant_id, conversation_id)

lead_events
  id, tenant_id, lead_id, at, kind ('created' | 'stage' | 'assigned' | 'note' | 'reply' | 'merged' |
  'split' | 'linked_customer' | 'converted' | 'booked'), from_value, to_value, actor_type, actor_id, meta_json

chat_staff_links                   -- which Chatwoot user is which OS PLUS user
  tenant_id, tenant_user_id, chatwoot_user_id
  unique (tenant_id, chatwoot_user_id)
```
One open lead per conversation. Intent is never downgraded by a later "thanks". Stages and vertical mappings belong to the new business and OS PLUS; no reference-business workflow is inherited.

### 4.8 Notifications
```text
chat_notification_targets
  id, tenant_id, kind ('telegram'), label, telegram_chat_id, events text[]
  ('booking_request' | 'handoff' | 'payment_claim' | 'agent_failure' | 'daily_summary' | 'new_lead'),
  brand_ids uuid[] (empty = all), link_code_hash, link_code_expires_at, linked_at, is_active

chat_summary_runs
  tenant_id, local_date, sent_at, payload_json
  unique (tenant_id, local_date)
```

### 4.9 Reused platform tables (verify first)
- `customers`, `customer_addresses` (`source` already allows `whatsapp`), `customer_external_identities` — link and convert.
- `tasks` — extend the `task_type` check with `CHAT_HANDOFF`, `LEAD_FOLLOW_UP` (payment screenshot tasks excluded) and the `subject_type` check with `lead`, `chat_conversation`. Migration must drop and re-add the constraints by name in one transaction.
- `domain_events` — event types `chat.lead.created`, `chat.lead.stage_changed`, `chat.contact.linked`, `chat.contact.converted`, `chat.booking.requested`, `chat.handoff.created`.
- `command_idempotency` — webhook-triggered commands use the Chatwoot message id as the idempotency key.
- `laundry_pickup_requests` — the Laundry booking capability creates and updates rows through the existing command; `source = 'whatsapp'` (or the channel kind, if the check allows — verify).
- `tenant_locations`, `teams`, `tenant_users`.

## 5. Booking capabilities (vertical-neutral agent)

The agent never writes a vertical table directly. It asks a **capability** registered for the tenant's enabled verticals:

```ts
interface BookingCapability {
  key: 'laundry_pickup' | 'follow_up_task'
  slots: SlotSpec[]                           // what the agent must collect, in order
  upsertDraft(ctx, conversation, slots): Promise<BookingRef>   // at the first ask
  confirm(ctx, ref): Promise<BookingRef>                        // on the customer's yes
  cancel(ctx, ref, reason): Promise<void>
}
```
- `laundry_pickup` (tenants with the Laundry vertical): slots = services, area/location, address, date, window; writes `laundry_pickup_requests`.
- `follow_up_task` (default for every other tenant): slots = what they want, preferred time; creates a `LEAD_FOLLOW_UP` task assigned to the brand's branch team.

Selected by tenant vertical, never by tenant name or slug.

## 6. Permissions

Add to `src/lib/permissions/roles.ts` (verify names against the file):

| Permission | owner_admin | manager | finance | viewer |
|---|---|---|---|---|
| `leads:view` | ✓ | ✓ | Tenant-configured | Tenant-configured |
| `leads:manage` | ✓ | ✓ | – | – |
| `leads:pii` (full numbers/handles) | ✓ | ✓ | Tenant-configured; masked unless granted | Tenant-configured; masked unless granted |
| `chat_settings:manage` | ✓ | – | – | – |

Masking is applied on the server in the DTO, never only in the UI. Module routes also require `tenant_modules.chat_leads.is_enabled`.

The current platform uses a fixed `rolePermissions` map; configurable role settings do not yet exist. Proposed additive `chat_role_permissions` stores tenant-owned chat/lead viewing and PII grants by existing role (unique tenant + role + permission). Only owner/admin manages this configuration, through audited tenant-scoped actions. Viewer and finance lead-view/PII grants default to denied until configured (CHAT-D026); both receive read-only lead access when granted. Viewer Chatwoot entry remains disabled pending equivalent capability verification (CHAT-D027). Chat-specific resolvers apply those grants; do not broaden or rewrite existing Boutique/Laundry permissions. Chat reports remain owner/admin-only under the owner's earlier requirement. Read-only viewer access to Chatwoot itself needs separate edition/capability verification; OS PLUS toggles cannot bypass Chatwoot authorization.

## 7. Surfaces and routes

CHAT-D029: Leads pages are OS PLUS workspace routes; Chats opens Chatwoot in a separate tab. Optional embedded lead-card routing is independently verified.

```text
src/app/(tenant)/leads/                      lead inbox
src/app/(tenant)/leads/[leadId]/             lead detail
src/app/(tenant)/leads/contacts/             contacts list
src/app/(tenant)/leads/contacts/[contactId]/ contact record (merge/split, convert)
src/app/(tenant)/leads/performance/          team performance
src/app/(tenant)/settings/chat/              brands · channels · knowledge · notifications · try the bot · widget
src/app/chat/panel/                          Chatwoot Dashboard App (lead card), minimal chrome
src/app/(super-admin)/chat-workspaces/       create/link workspace, enable module, health
src/app/api/chat/webhooks/chatwoot/[workspaceKey]/events/route.ts
src/app/api/chat/webhooks/chatwoot/[workspaceKey]/agent/route.ts
src/app/api/chat/webhooks/telegram/route.ts
src/app/api/chat/cron/hourly/route.ts
public/chatwoot/osplus-reply.js              draft buttons (Dashboard Script)

src/features/chat/        agent engine, context, gates, capabilities, knowledge schema, turns
src/features/leads/       rules (pure), store, performance, pii, conversion
src/integrations/chatwoot/   API client, payload parsing, platform onboarding
src/integrations/openrouter/ model client with cost + timing capture
src/integrations/telegram/   bot client, link codes, formatting
```

**Dashboard App session.** Chatwoot loads `/chat/panel` in an iframe and posts the conversation via the `chatwoot-dashboard-app:fetch-info` handshake. Accept the message only from the workspace's Chatwoot origin. The OS PLUS (Clerk) session must be verified inside the iframe; sharing a registrable domain is not sufficient proof of authenticated or tenant-scoped access. Verify in CH-4 and record the result. If Clerk will not authenticate in the frame, fall back to a "Open lead in OS PLUS" link — never to an unauthenticated panel.

## 8. Environment variables (new)

```text
CHAT_SECRETS_KEYS           JSON map of key version to 32-byte base64 encryption key
CHAT_SECRETS_ACTIVE_VERSION Active key version (for example v1); retain old keys while ciphertext references them
CHAT_CRON_SECRET            Bearer secret for /api/chat/cron/*
CHATWOOT_PLATFORM_URL       https://chat.<platform-domain>
CHATWOOT_PLATFORM_TOKEN     Chatwoot Platform App token (super admin onboarding)
OPENROUTER_API_KEY
CHAT_MODEL_UNDERSTAND       new-platform production model, explicitly selected before CH-5
CHAT_MODEL_WRITE            new-platform production model, explicitly selected before CH-5
CHAT_MODEL_JUDGE            new-platform production judge model; cheap test model selected separately
CHAT_MODEL_TRANSCRIBE       audio-capable model for voice notes
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
TELEGRAM_PLATFORM_ALERT_CHAT_ID   platform-level failures (us, not tenants)
CHAT_DRY_RUN                when set, no outbound sends and no writes beyond chat_turns (read at call time)
```
Add each to `.env.example` with a comment. Flags are read at call time, never at module load (ESM hoisting once made a Fundry dry run send real Telegram messages).
