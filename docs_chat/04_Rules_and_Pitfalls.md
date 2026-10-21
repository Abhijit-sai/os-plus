# OS PLUS Chat & Leads — Rules and Known Pitfalls

The platform rules in `/docs/06_Rules.md` and `/docs_v2/06_Rules.md` apply in full. These are additional.

## 1. Module rules

1. The module is enabled per tenant (`tenant_modules.chat_leads`). Every module route, action, webhook and cron step checks it.
2. Tenant context for webhooks comes only from the workspace resolved by URL key + secret (see `02` §3). Payload ids are data, not authority.
3. Every chat/lead table is tenant-owned and follows the platform tenant rules (tenant_id, composite FKs, server-side filtering, RLS as defence in depth).
4. Chatwoot is the only message transport and the only place staff type replies. Do not build a native inbox or a second reply box.
5. Webhook handlers return 200 at once and do their work in `after()`. They must be idempotent on the Chatwoot message id.
6. Capture paths (messages, contacts, leads) make no model calls. Only the turn calls models.
7. All writes that change business state (customer, booking, task, lead stage, merge/split) go through Domain Commands with tenant, actor (`agent` / `webhook` / `user`), source and correlation id, and write domain events.
8. Contacts are resolved by exact identity only. Never fuzzy-match, never auto-merge two existing contacts, never auto-create a customer from an Instagram/Facebook handle.
9. Linking a contact to a customer requires an exact, country-validated E.164 match within the tenant; creating a customer follows `/docs/06_Rules.md` §3 in full.
10. A lead's stage moves forward from real records (booking, order, payment, delivery) or a person; the agent may set intent/services/area/gist/handoff but never `won` or `lost`.
11. Personal data is masked server-side for roles without `leads:pii`.
12. No campaign or broadcast sending. Outbound outside a customer conversation stays in the existing communications foundation.
13. Telegram alerts go only to targets the tenant linked; platform failures go only to the platform chat.
14. Secrets (Chatwoot tokens, webhook secrets) are encrypted at rest, never returned to the browser, never logged.
15. Environment flags are read at call time, never at module load.
16. No tenant-name, slug or id checks in code. Behaviour differences come from configuration, the knowledge pack, or enabled verticals.
17. The agent rules in `03_Agent_Spec.md` §3 are code with unit tests, not prompt text alone.
18. Customer-facing text never contains internal flags, errors, ids, JSON, model names or unfilled placeholders.

## 2. Proposed new-business conversation standards

- Never repeat yourself — the worst-rated habit.
- Language and script come from the new business's approved configuration; do not inherit the reference language policy.
- Pick up a booking fast and in a structured way; one question per turn.
- Not pushy; no upsell; no filler.
- Informational answers end with one next step.
- Internal flags/errors never reach customers.
- ~5 s reply target; no typing indicator.

## 3. Technical reference findings (verify against the selected versions)

These are structural/integration observations, not inherited business workflows. All customer-facing policies and wording require new-business approval.

### Chatwoot
- Send the API auth header **hyphenated**: `api-access-token`. The underscore form is dropped by reverse proxies (401 through Caddy, 200 direct).
- Authenticate using workspace key + URL secret. The old unsigned-webhook assertion is superseded: pinned v4.18.0 AgentBotListener supplies a signing secret to the job. Verify signing headers against the selected deployment before enforcing them; never drop the mandatory URL authentication.
- The Agent Bot webhook carries **only the last message**; bot tokens can create messages but not read them. Keep our own `chat_messages` from the **account** webhook (`message_created` fires for customer, bot and staff messages).
- Agent Bots are under **Settings → Bots**, not Integrations.
- `POST /labels` **replaces** the label list — read, merge, write.
- Old Chatwoot routed Instagram DMs through the Facebook Page channel and marked them in `additional_attributes.type = 'instagram_direct_message'`. Detect both.
- Message type arrives as a string (`incoming`, `outgoing`, `template`) or a number (`0`, `1`, `3`); handle both. `created_at` may be epoch seconds or ISO.
- Chatwoot's inbox auto-greeting arrives as an outgoing non-agent message within seconds of the customer's first message — classify it as `system`, not staff (it otherwise corrupts first-reply times and quiet rules).
- Dashboard Scripts are installation-wide: one script must serve every tenant.
- Chatwoot 4.17 renders note text in `span.prose.prose-bubble` (with `p` children).
- Postgres needs `pgvector` (`pgvector/pgvector:pg16`).

### Models
- Models copy long strings wrong (8/8 statement tokens corrupted) → placeholders filled by code.
- Models "extract" details that were never said → evidence quotes checked against customer text.
- Gemini 3.7 Flash reasoning cannot be disabled; thinking tokens count against `max_tokens`.
- Cheap models produce more mechanical slips → repair by code before rejecting.
- The model's own turn timer under-reports what the customer waits; measure from message timestamps.

### Infrastructure
- `supabase-js` retries ~7 s internally before surfacing a network error, and the gateway stalls ~5 s on ~1.4 % of requests — budget health checks and timeouts for it.
- A DB error in a lookup must read as `unavailable`, never as "not a customer".
- A Supabase HEAD count on a missing table returns no error — not an existence check.
- ESM hoists imports → read env flags at call time (a Fundry dry run once sent real Telegram messages).
- Middleware matchers that skip paths containing a dot break signed tokens like `<data>.<signature>`.
- Vercel env changes need a redeploy.
- Polling a Vercel site in a loop trips bot mitigation for your IP (403 challenge) — not an outage.
- Copy a live SQLite (n8n) with `sqlite3 .backup`, never `cp`.
- Windows shells mangle escaped backslashes in heredocs — use the file editor for regex/`\n` content.

### Meta
- One webhook per Meta app per product; Chatwoot owns the WhatsApp webhook for each number it serves.
- Instagram and Facebook messaging need Meta business verification and app review (`instagram_business_manage_messages` / `pages_messaging` and related). Start early; it takes days to weeks.
- WhatsApp's 24-hour customer-service window: outside it, only approved templates can be sent.
