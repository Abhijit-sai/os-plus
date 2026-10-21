# CH-4 Pages, lead card, permissions/PII
Status: IN_PROGRESS,2026-10-21. Base0d22491f14eb82f246d2d17f50b9c97c4269a0a0; same codex/chat-ch1-foundation. CH3 locally CLOSED underD038; real Meta/two-phone proof remains release blocking.

## Scope / sequence
1. Pure explicit server DTO projections and filter/performance rules, synthetic red-green tests. Never send raw message text/metadata/attachments/identity or free-form notes to non-PII roles.
2. Server guards and tenant-filtered, bounded/paginated reads; full-scope counters/aggregates without silent truncation. Leads inbox filters brand/branch/channel/stage/owner, waiting/hot/handoff and value; detail read-only mirror/history, versioned actions through CH3 commands.
3. Contacts list/detail and customer/order boundaries, guarded conversion/link/merge/split UI; existing commands only. Performance owner/admin only; eligible staff mapping, separate bot/human clocks and per-person counts.
4. Add module/permission-gated Leads navigation and Chats external new tab for owner/manager. Preserve all other module permissions/default routes. Dashboard count only for permitted enabled tenants.
5. Minimal /chat/panel: authenticate Clerk inside frame; source=parent and exact resolved workspace Chatwoot origin; strict handshake payload/account/inbox/conversation mapping. Browser message is never tenant authority. Safe top-level OS PLUS link fallback when iframe authentication fails. No unauthenticated data or credentials in URLs.
6. Role access/PII on server DTO/RSC/action responses, exact page/ID/filter negatives, disabled module, two-tenant fixtures, real DB/HTTP/browser375px+desktop and panel session evidence; all six gates and Boutique TierA, review/owner acceptance before commit.

## Reconciliation with existing code
- Actual tenant route group exists; use src/app/(tenant)/leads and src/app/chat/panel. AppShell currently has only platform rolePermissions; add separate safe Chat nav props, never broaden fixed roles.
- Chat guard uses current active membership/module/tenant grants (D026/27); reuse it for every read/action/route. Viewer/finance configurable read-only; cannot open Chatwoot or reports, even with PII.
- CH3 command boundary already supports conversion/link/manual merge/split/stages/owner/notes. No new direct writes. Preserve optimistic versions/idempotency and server confirmation.
- Captured raw messages/turns/events contain PII and internal errors/model identifiers. Explicit whitelist DTOs; no raw spread, HTML injection, model/error/meta JSON, attachment token URLs. Public conversation mirror only; no reply composer.
- Existing knowledge pack hours are human text; no reliable structured weekly schedule. After-hours reporting is unavailable until explicit machine-readable schedule, never guessed. Existing timezone alone is insufficient.
- Customer/order links require the relevant existing platform view permission AND leads:pii; imported drafts/payment source facts retain CH3 contracts.
- Draft generation/booking actions are later phases. Show truthful availability/existing native record links; do not execute CH5/6 or manufacture drafts/bookings.
- Exact deployment domain still unset; local actual Chatwoot link/panel QA possible, no domain purchase/SSO or production settings change. Authenticated panel or safe fallback is accepted per02§7.
- Skill search matched dashboard style after retry, but generic landing-page recommendations do not fit this existing work tool. Preserve PRODUCT.md and existing semantic components/tokens/fonts; accessible labels/touch targets, responsive lists, clear empty/error/pending states.

## Expected files
src/features/leads/{pii,read-schemas,queries,actions,performance,panel}.ts as needed; src/components/leads/*; src/app/(tenant)/leads/{page,layout,loading,error}.tsx, detail, contacts/detail, performance; src/app/chat/panel/*; src/components/layout/app-shell.tsx; tenant layout/dashboard additive entry; src/features/chat/module.ts narrow reusable access results if needed; src/types/chat.ts read RPC types.
Potential additive read-only CRM query/index migration if required for correct full counts/pagination (timestamped chat file); never edit applied CH3 SQL. No shared/hosted apply.
Tests scripts/test-chat-crm-*.mjs plus actual DB/browser harness; update CHECKLIST/WBS/QA tracker and SAME project_summary.md.
No open product-policy question now; routine display choices follow approved roles/plan. New conflicts will be recorded before dependent work.

## Executed local checkpoint — 2026-10-22
Implementation and technical QA complete, full owner phase acceptance pending (CH4_OWNER_ACCEPTANCE.md). Actual modules also include transport.ts, reporting-hours.ts, editor-state.ts and confirmed-command.ts. No performance.ts needed; query/report mapping is in queries.ts and service SQL. Optional named reporting schedule is reporting-only; none seeded/published for a business.
Only20261021140000 read migration applied to owned LOCAL15437 with128-table pre/post restore/preservation. Six gates green, latest Chat119/119, real provider10/10, role/PII HTTP/RSC and tenant denial,375px/desktop, actual frame render + owner save + fallback and Boutique14/14 pass; workbook appended/preserved. Details CH4_QA.md.
Closure alignment C4-L4 is explicit: existing suggestion/knowledge version display now; generated provenance and Create booking in CH5/CH6. WBS CH4.2 stays partial until owner accepts sequencing, not silently marked complete. No phase transition or CH4 commit yet.


## Owner closure accepted —2026-10-22
CHAT-D039 explicitly accepts local results and CH4.2 dependency alignment: stored draft text/knowledge version now; generation/richer provenance CH5; booking CH6. Supersedes pending-owner notes above. READY_FOR_CLOSURE LOCAL; commit before CH5 planning.
