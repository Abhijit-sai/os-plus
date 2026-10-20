# OS PLUS Chat Agent — New-Business Specification

> **Read freely, write through gates.**
> One model reads everything — the session, the ledger, the contact's own history, the brand's knowledge pack — and writes the reply. Code owns everything that must be right: what gets booked, what money is stated, who is quiet, what may not be said twice, and which tenant's data is visible.

Build a new agent against OS PLUS's tenant, command and safety contracts. The reference implementation supplies structure only; do not adopt its business language, operational workflows, credentials, model selections, benchmark fixtures or owner calibration. The capabilities below are proposals. Timing defaults, booking sequences, language/script, review policy and customer-facing sentences require the new business's configuration and approval.

## 1. The turn

```text
agent webhook → 200 at once → after():
  ORDER     latest-message-wins: a newer customer message in the same conversation supersedes this run
  LOAD      tenant-scoped context (session, ledger, contact card, knowledge pack, channel, branch list)
  QUIET?    staff replied < quiet_minutes ago → stop (record outcome 'silent')
  CLOSING?  bare acknowledgement and nothing open → stop BEFORE any model call
  BUDGET?   tenant over monthly budget → force draft mode
  UNDERSTAND  model call 1 → strict JSON (intent flags, slots with quoted evidence, language, gist)
            ∥ CLASSIFY  small decisions-only model for payment claim / vendor / confirm / language
  GATES     pure code → Plan (what to book, what is locked, who needs a person, what the reply must cover)
  ACT       Domain Commands via capabilities (booking upsert/confirm/cancel, task, label, contact attribute)
  WRITE     model call 2 → phrase the planned reply; links are {{PLACEHOLDERS}}
  CHECK     repair mechanical slips, then validate; one rewrite; else locked fallback + handoff
  DELIVER   auto → public message; draft → private note "💬 Suggested reply"
  SAVE      chat_turns (understanding, plan, checks, models, cost_usd, timings_ms, outcome), ledger, lead enrichment
```

Measure end-to-end customer wait for the new implementation. A proposed latest-message-wins design must be tested with synthetic message bursts; do not inherit reference-business latency results.

## 2. Context (LOAD) — all tenant-scoped

| Part | Source | Notes |
|---|---|---|
| Session | `chat_messages` for this conversation | Time on every message. Bands by the silence before the current message: `continuing` < 30 min, `resumed` 30 min–24 h (re-confirm an open task before continuing), `fresh` > 24 h (greet, drop unfinished tasks). The last few earlier messages for "last time…" only. |
| Unanswered | session | A burst of customer messages is answered together. |
| Said this session | session | Everything the bot said, for the repeat check. |
| Ledger | `chat_state.ledger_json` | Open task (booking slots + evidence + what option lists were already shown + saved booking ref), promises made, one-per-session sends (price list, statement link, review link, WhatsApp link), language, handoff. |
| Contact card | `chat_contacts` → linked `customers`, `customer_addresses`, recent orders/bookings, open tasks | **Background only.** Order status questions still hand off. Saved address offered as "same as last time?". |
| Knowledge pack | latest published `chat_knowledge_packs` for the channel's brand | §4. The only facts the agent may state. |
| Channel | `chat_channels` | kind, mode, can_book, can_share_statement, WhatsApp hand-off number. |

## 3. Gates and checks (pure code, unit-tested)

Implement and test the platform safety controls with fresh synthetic fixtures. Business-specific rules below remain proposals until the new business approves them; the model never decides authorization, money truth or booking state.

1. **Quiet after staff.** A staff member's public reply silences the bot for `quiet_minutes` (default 60) after their **last** message. Chatwoot's auto-greeting is `system` and does not count. In draft mode, staff sending the bot's own suggestion (even lightly edited) is the bot speaking, not staff.
2. **Vendor pitch.** Someone selling *to* the business gets one locked reply (brand's `vendor_reply`), then quiet for `quiet_minutes`.
3. **Closing detection.** The whole message is an acknowledgement ("ok", "thanks", "👍", brand-configured local forms supplied by the new business) and nothing is open → silent. "yes/ok" while a task is open is a confirmation, not a closing. Runs before the model calls.
4. **Evidence.** A booking detail counts only if its quoted evidence appears in a customer message this session. Models invent details otherwise.
5. **Booking at the first ask.** The booking draft is saved (and alerted) the moment it is asked for, updated as slots arrive, confirmed by the yes, withdrawn on cancel. Never a second booking for the same contact/area/services within 1 h, and never after the ledger already promised one.
6. **Address de-duplication.** Joining saved address parts skips parts already present.
7. **Map links.** A Google Maps link counts as the location (area = "shared on Google Maps"); coordinates are read from the link when present to pick the nearest branch.
8. **One question per turn.** Option lists (services, windows) are shown once per booking.
9. **Locked sentences.** Payment claim → the brand's exact `payment_claim_reply`; a second claim in the session → `payment_claim_again`. Identity question → `identity_reply`. Unreadable message → `unreadable_handoff`. Vendor → `vendor_reply`. The writer may not reword these.
10. **Money.** The reply may state only amounts from the knowledge pack's price list (always marked indicative, never summed into a total) or from this turn's own statement lookup on an **exact** phone match (`can_share_statement` channels only). Any other currency amount → violation.
11. **No promises the business cannot keep.** No delivery/turnaround date confirmed; turnaround stated as a range with the brand's caution line; no express service unless the pack says so.
12. **Repeat check.** Any sentence (or promise in different words) already said this session → repaired once by code, else rewritten once by the model, else handoff. Short acknowledgements may recur.
13. **Links by code.** The model writes `{{STATEMENT_LINK}}`, `{{MAP_LINK:<location_code>}}`, `{{REVIEW_LINK}}`, `{{WHATSAPP_LINK}}`; code fills them. This prevents generated text from corrupting signed links.
14. **Language and script.** Follow the new brand's configured languages and script policy. Do not inherit English-only, transliteration or regional-language examples from the reference business.
15. **Channel rules.** Instagram/Facebook/website without a verified phone: answer information; booking and dues move to WhatsApp via `{{WHATSAPP_LINK}}` (a pre-filled `wa.me` message carrying the lead ref). A WhatsApp message quoting the ref links the two contacts. A website pre-chat phone is self-asserted and remains unverified; approved booking or financial sharing requires a separate verified identity flow.
16. **Handoff topics.** Complaints, damage, refunds, order status, anything in the brand's `handoff_topics`, low confidence, or a failed check → task `CHAT_HANDOFF` + Telegram alert + a short locked handoff line (said once).
17. **Review ask.** Only after a completed order, feedback first, link only after a positive reply, at most once per `review_cooldown_days` (default 90), never after a complaint.
18. **Internal text never reaches customers.** Flags, errors, JSON, tool names, placeholders left unfilled → violation.
19. **Repair before reject.** Mechanical slips (option list repeated, missing "indicative", two map links, a repeated sentence) are fixed by code; throwing good drafts away is what turned cheap-model replies into the generic fallback.

## 4. Knowledge pack (`chat_knowledge_packs.pack_json`)

Validated with Zod on save and on load; versioned; edited in Settings → Chat → Knowledge; published explicitly. Shape:

```ts
type KnowledgePack = {
  schemaVersion: 1
  brand: {
    displayName: string
    personaName: string                 // the new brand's approved assistant name
    oneLiner: string                    // what the business does, one sentence
    languages: ('en' | 'hi' | 'te' | 'ta' | 'kn' | 'mr' | string)[]
    latinScriptOnly: boolean            // explicitly configured; not inherited
    localAcknowledgements: string[]     // supplied by the new business
  }
  hours: { default: string; byDay?: Record<'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun', string>; onlyWhenAsked?: string[] }
  services: { key: string; name: string; aliases: string[]; turnaround?: { min: number; max: number; unit: 'hours' | 'days' } }[]
  prices: { serviceKey: string; label: string; amount: number; unit: string }[]   // always indicative
  priceListImageUrl?: string             // sent once per chat, after the text answer
  booking?: {
    capability: 'laundry_pickup' | 'follow_up_task'
    windows?: { key: string; label: string }[]       // "Morning 10–1"
    minimumOrder?: string | null
    express?: boolean
  }
  areas: { locationCode: string; served: string[]; postalCodes: string[] }[]     // nearest-branch matching
  policies: { topic: string; answer: string }[]      // short, factual
  handoffTopics: string[]                            // e.g. ["damage", "refund", "order status"]
  locked: {
    paymentClaimReply: string
    paymentClaimAgain: string
    identityReply: string
    vendorReply: string
    unreadableHandoff: string
    handoffLine: string
    turnaroundCaution: string
  }
  review?: { url: string; cooldownDays: number }
  style: { maxQuestionsPerTurn: 1; endInformationalWithNextStep: true; noFiller: true; pushy: false }
}
```

Branch facts (address, map link, pins, hours overrides) come from `chat_brand_locations` + `tenant_locations`, not the pack, so one branch edit updates every brand that uses it.

**New-business pack.** CH-0 prepares `docs_chat/examples/new-business.pack.json` as a clearly synthetic, unpublished schema example for owner review. Do not import any existing business's facts, language, services, prices, booking flows, locked sentences or credentials. A publishable tenant pack must be filled and reviewed from that new business's own requirements; examples are never customer-facing facts.

## 5. Models and cost

- Production understand/write models: explicitly selected for the new platform before CH-5; do not inherit the reference model selection.
- Offline unit/E2E tests use stubs. Paid test runs use `deepseek/deepseek-v4-flash` under the owner's cost policy. Production classify/judge models require separate explicit selection for the new platform.
- Record `usage.cost` from OpenRouter on every call into `chat_turns.cost_usd`; stage timings into `timings_ms_json`.
- Establish a new measured cost baseline; no reference-business spend estimate is adopted.
- **Budget:** when a tenant's month-to-date cost reaches `monthly_budget_usd`, all its channels behave as `draft` and the owner and platform are alerted once.
- **Spend discipline during the build:** tests use cheap models; any run that calls a paid model beyond a few cents must state the estimated cost and wait for the owner's yes.

## 6. Voice notes and images

- Voice note: transcribe (`CHAT_MODEL_TRANSCRIBE`), post the transcript as a private note in Chatwoot, store it in `chat_messages.transcript`, and run the turn on the transcript.
- Payment screenshot extraction, vision verification and verification tasks are excluded (CHAT-D023). Inquiry-only unsupported media follows the new business's approved handoff policy; no financial workflow is inherited.
- Unreadable or unsupported media → `unreadableHandoff`.

## 7. Draft mode in Chatwoot

`public/chatwoot/osplus-reply.js`, loaded once per install through Chatwoot Super Admin → Settings → Dashboard Scripts:
- finds private notes starting with the marker "💬 Suggested reply" and adds **Send as is** / **Edit** using the signed-in staff member's own Chatwoot session;
- finds image notes from the bot and adds **Send image**;
- tenant-neutral (no brand names, no hardcoded accounts); versioned string in the file; `window.osplusReplyDebug()` for support;
- Chatwoot 4.17 renders note text inside `span.prose.prose-bubble` with `p` children — include `span` in selectors; test against captured Chatwoot markup (build a new harness using the selected release's markup).

## 8. Testing the agent

| Layer | What | Model |
|---|---|---|
| Unit | gates, checks, repair, quiet, closing, repeat, evidence, session bands, ledger, link filling, knowledge-pack schema, nearest branch | none |
| Context | loader returns only this tenant's data (two-tenant fixture, same phone in both) | none |
| E2E | real routes against a mock Chatwoot (account + agent webhooks, delivery, labels), both modes | stubbed model |
| Bench | replay of real-shaped conversations + simulated customers, judged by the owner-calibrated rubric (`judge.ts`) | cheap by default; paid only with the owner's yes |
| Safety ×5 | amount without match, payment confirmation, invented date, identity leak, prompt injection, data-leak request | cheap |

Create a new synthetic bench and owner-reviewed rubric for the new business. Structural test organization may be referenced; existing-business conversations, expected wording, scores and calibration are not adopted.
