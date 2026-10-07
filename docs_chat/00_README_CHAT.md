# OS PLUS Chat & Leads Module — Documentation Layer

## Purpose

`docs_chat` is the planning and build layer for the **Chat & Leads module** of OS PLUS.

The module turns every customer conversation on **WhatsApp, Instagram, Facebook Messenger and the tenant's website** into:

1. a reply — from a guarded AI agent or from staff, in one shared inbox;
2. a **contact** (one person, however many numbers and handles);
3. a **lead** (staged, valued, owned, timed);
4. and, when the person buys, an OS PLUS **customer** with the full order → production → delivery → payment pipeline that already exists.

It is sold as a module of OS PLUS. A tenant can buy it alone (chat + leads only) or with the order/production verticals.

This is a new implementation for new businesses. The separate Fundry repository may be consulted only for structural patterns (integration boundaries, storage, deployment and test organization). Its implementation, infrastructure, language, operational workflows, business facts, branding, credentials, model selection and calibrations must not be copied or changed. There is no Fundry onboarding, migration or cutover in scope. Fresh business configuration and credentials are required.

## Reading order for a coding session

1. `/project_summary.md` (root — the only living session log, V2-D025)
2. `/docs_chat/00_README_CHAT.md` (this file)
3. `/docs_chat/01_PRD.md`
4. `/docs_chat/04_Rules_and_Pitfalls.md`
5. `/docs_chat/02_Architecture_and_Data_Model.md`
6. `/docs_chat/03_Agent_Spec.md` (before any agent phase)
7. `/docs_chat/05_Phase_Plan_WBS.md` — the current phase only
8. `/docs_chat/06_Decision_Log.md`
9. `/docs/06_Rules.md` and `/docs_v2/06_Rules.md` — the platform rules still apply in full
10. `/docs_v2/10_Phase_Gate_QA_and_Commit_Policy.md` and `/docs_v2/13_Project_Summary_Update_Protocol.md`

`/docs_chat/07_Codex_Build_Prompt.md` is the session start prompt. `/docs_chat/CHECKLIST.md` is the owner's step-by-step list (what a person must do outside the code, interleaved with the build phases).

## The one-paragraph architecture

```text
 Customer                          Platform server (Hetzner)            OS PLUS (Vercel + Supabase)
 ─────────                         ─────────────────────────            ──────────────────────────
 WhatsApp  ─┐                      Chatwoot CE (one install)
 Instagram ─┼──► Meta / widget ──► account per TENANT
 Facebook  ─┤                        inbox per BRAND × CHANNEL (× BRANCH)
 Website   ─┘                        staff reply here (web + mobile apps)
                                     │  account webhook  (every message)  ──► /api/chat/webhooks/chatwoot/events
                                     │  agent-bot webhook (customer msg)  ──► /api/chat/webhooks/chatwoot/agent
                                     ◄── replies / private-note drafts / labels  (Chatwoot API)
                                     Dashboard App iframe  ◄── /chat/panel (lead card)

                                                                         chat_* tables  → contacts, leads, turns
                                                                         Domain Commands → customers, pickup
                                                                           requests, tasks, domain_events
                                                                         Telegram (alerts + daily summary)
                                                                         OpenRouter (agent model calls)
```

- **Chatwoot is the transport and the staff inbox.** We do not rebuild an inbox.
- **OS PLUS owns everything that must be right:** tenancy, who a person is, the lead and its stage, what the agent may say and do, customer creation, bookings, tasks, money statements, notifications, cost.
- **One Chatwoot install serves every tenant.** One Chatwoot *account* per tenant. Brands and branches are *inboxes* (and Chatwoot *teams*) inside that account. Nothing is deployed twice.

## Hierarchy

```text
Tenant (os-plus tenants)                       ↔ Chatwoot account (chat_workspaces)
  └─ Brand (chat_brands)                         — own name, persona, knowledge pack
       ├─ Branch (tenant_locations, via chat_brand_locations)
       └─ Channel (chat_channels)                ↔ Chatwoot inbox
            kind: whatsapp | instagram | facebook | website
            agent_mode: off | draft | auto
            optional default branch
```

A single-brand, single-branch business is just the smallest case of this hierarchy.

## Glossary

| Term | Meaning |
|---|---|
| Workspace | The link between one OS PLUS tenant and its Chatwoot account (URL, account id, encrypted tokens, webhook secret). |
| Brand | A customer-facing business identity inside a tenant. Owns the agent persona and knowledge pack. |
| Channel | One Chatwoot inbox mapped to a brand (and optionally a branch). |
| Contact | A person who has messaged us. Not yet necessarily a customer. |
| Identity | One exact identifier of a contact: E.164 phone, Instagram id, Facebook PSID, Chatwoot contact id, email, website visitor id. |
| Lead | One enquiry from a contact: kind, intent, services, stage, owner, value, clocks. |
| Customer | The existing OS PLUS `customers` row. A contact is *linked* to one when it is the same person, or *converted* into one. |
| Turn | One agent run in reply to a customer message (`chat_turns`). |
| Knowledge pack | The brand's facts the agent may state (services, indicative prices, hours, areas, windows, policies, locked sentences). Contains only the new brand's reviewed facts. |
| Gate | Pure code that decides what may be booked, said, or stayed silent on. Models never decide these. |
| Draft | A suggested reply posted as a Chatwoot private note with "Send as is / Edit" buttons. |

## Reference implementation (Fundry)

This inventory is a structural reference only, not a porting checklist. No business language, workflow, production fixtures, credentials, model choice, customer records or deployment is inherited. Do not modify that repository or its services. Build new modules and synthetic tests against the new business's requirements and OS PLUS's platform contracts.

| Concern | Fundry file(s) |
|---|---|
| Agent v4 pipeline | `src/lib/agent/v4/*` (turn, context, session, ledger, quiet, order, repeat, understand, classify, gates, write, check, payment, pickup, receipt) |
| Formatting, link placeholders, English-alphabet enforcement | `src/lib/agent/v3/format.ts` |
| Business facts the agent reads | `src/lib/business.ts` → becomes the knowledge pack |
| Webhook routes | `src/app/api/chat/agent/route.ts`, `src/app/api/chat/events/route.ts` |
| Lead rules (pure) and store | `src/lib/leads/rules.ts`, `store.ts`, `performance.ts`, `pii.ts` |
| Judge (owner-calibrated rubric) | `src/lib/agent/judge.ts` |
| Daily summary | `src/lib/summary.ts`, `src/app/api/cron/nightly/route.ts` |
| Chatwoot draft buttons | `public/chatwoot/fundry-reply.js` |
| Dashboard App lead card | `src/app/ops/panel/*` |
| Chatwoot deploy kit | `deploy/chatwoot/*`, `deploy/backups/*` |
| Tables | `supabase/migrations/0010`–`0016` |
| Design history | `docs/26`–`docs/30`, `PROJECT_SUMMARY.md` sections "ERP & Chat era", "Lead inbox + CRM", "Chat agent" |
| Tests worth porting | `scripts/test-v4-gates.ts`, `test-v4-context.ts`, `test-leads.ts`, `test-drafts.ts`, `test-summary.ts`, `scripts/bench/*` |

Fundry-specific content that must **not** be ported as code: store names, pins, prices, hours, review link, Zoho calls, `customer_phones`, Telugu/Hinglish examples as hardcoded rules, the statement page on `bill.fundry.in`. Each becomes tenant configuration or an OS PLUS-native equivalent.
