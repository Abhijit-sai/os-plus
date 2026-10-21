# Current closure status — 21 October 2026

READY_FOR_CLOSURE: final gates pass (Chat37/37); authenticated owner-a/owner-b QA and Boutique14/14 complete; desktop/390px iframe evidence and owner acceptance recorded in [CH1_AUTHENTICATED_QA.md](CH1_AUTHENTICATED_QA.md), CHAT-D030. Earlier counts/blockers below are retained as dated implementation history and are superseded by that final follow-up. Final local commit next; no external release.

# CH-1 Foundation — local QA evidence

Date: 2026-10-21 (Asia/Calcutta). Status: **QA_BLOCKED**.
Later local-environment evidence and exact owner login steps: [CH1_LOCAL_QA.md](CH1_LOCAL_QA.md). The historical 27-test count below is now 30 with local-launcher guards; local PostgREST/restore evidence is additional. Authenticated browser acceptance is still pending.
Worktree: D:/Develop/os-plus-chat-ch0. Branch: codex/chat-ch1-foundation.
HEAD: 24a0af7140c51fd061f2f2054c046a325999a298. No upstream.
CH-1 runtime changes remain uncommitted. The approved planning checkpoint 1619c61 and released-baseline merge 24a0af7 are the only new commits; neither closes CH-1.

## Scope delivered

Tenant-owned module/workspace/brand/branch/channel configuration; accepted owner/manager/viewer/finance permission rules; versioned authenticated encryption; strict knowledge-pack validation, immutable revisions, explicit publication and per-brand history pagination; atomic idempotent configuration commands with domain events; platform preparation/link/create reservation/reconciliation/rotation/suspension; guarded settings and platform UI; mock Chatwoot admin transport.
All module flags default off. No contact/lead pages, webhook message processing, customer conversion, model replies, SSO, Meta onboarding, notifications or scheduler activation.

## Exact runtime inventory

New files:
- src/features/chat/actions.ts
- src/features/chat/commands.ts
- src/features/chat/connection.ts
- src/features/chat/knowledge-pack.ts
- src/features/chat/module.ts
- src/features/chat/permissions.ts
- src/features/chat/platform-commands.ts
- src/features/chat/queries.ts
- src/features/chat/schemas.ts
- src/features/chat/secrets.ts
- src/components/chat/knowledge-editor.tsx
- src/components/chat/platform-panel.tsx
- src/components/chat/setup-form.tsx
- src/components/chat/setup-panel.tsx
- src/integrations/chatwoot/admin-client.ts
- src/types/chat.ts
- src/app/(tenant)/settings/chat/page.tsx
- src/app/(super-admin)/super-admin/chat-workspaces/page.tsx

Existing runtime/tooling files changed additively:
- .env.example — private keyring and default-off/dry flags.
- package.json — test:chat.
- eslint.config.mjs — generated Chat preview output excluded, matching Shopify preview convention.
- src/types/database.ts — Chat table/function type composition alongside released Shopify types.
- src/lib/permissions/roles.ts — Chat permission type only; legacy arrays/default routes unchanged and fail closed for new names.
- src/app/(tenant)/settings/page.tsx — owner/module-gated setup entry.
- src/app/(super-admin)/layout.tsx — global-flag-gated workspaces entry.
- scripts/test-role-route-policy.mjs — Chat guard integration assertions.

Tests/preview:
- scripts/test-chat-{admin-client,boundaries,database,knowledge,permissions,secrets}.mjs
- scripts/chat-db-harness/{database,server-adapter}.mjs and README.md
- scripts/chat-preview/app/{layout,page}.tsx and app/sizes/page.tsx
- scripts/chat-preview/{next.config,postcss.config}.mjs, tailwind.config.ts, tsconfig.json, .gitignore and README.md

Documentation: project_summary.md (same living file, appended history), docs_chat/{02_Architecture_and_Data_Model,06_Decision_Log,CH1_IMPLEMENTATION_PLAN,CHECKLIST,CH1_QA}.md.

## Migrations and database evidence

Added:
1. supabase/migrations/20261021100000_chat_foundation.sql
2. supabase/migrations/20261021101000_chat_foundation_commands.sql

The first creates 12 new tenant-owned tables: tenant_modules, chat_settings, chat_workspaces, chat_brands, chat_brand_locations, chat_knowledge_packs, chat_channels, chat_role_permissions, chat_staff_links, chat_notification_targets, chat_notification_target_brands and chat_summary_runs. Composite tenant foreign keys, explicit ACLs, RLS, uniqueness and immutable publication constraints are installed. The second adds service-role-only audited atomic RPCs. No existing table is altered.

Applied all **73 repository migrations (71 released + 2 new)** to fresh owned disposable PostgreSQL 17 Docker containers, repeatedly including the final run. No shared or production database was used. The existing optional handover dependency shape is explicitly synthetic, matching the inherited harness; this is not handover acceptance.
Docker 29.7.2 worked; the earlier Linux-engine failure is superseded.
Independent sessions tested concurrent revision allocation, competing publications and identical command retries. An injected audit failure proved transaction rollback of both mutation and receipt.
Browser database roles were denied by ACL; a temporary transaction grant separately proved default-deny RLS. Service direct writes were rejected. Tenant B cannot reference A's branch/brand/staff/target rows, mutate A's records, or load A's knowledge through the production read adapter.
Acceptance fixture includes one brand mapped to **two existing synthetic branches**, a published pack and a mapped channel. Browser/Clerk end-to-end acceptance remains separate.

## Automated gates

Final logs: ../outputs/chat-ch1/final-20261021/ (ignored local evidence).

| Command | Final result |
|---|---|
| npm run typecheck | PASS |
| npm run lint | PASS, no errors/warnings |
| npm run build | PASS, 51/51 generation steps |
| npm run test:roles | PASS: legacy role-route suite + Chat guarded integration group |
| npm run test:v2 | PASS: 4 existing suites |
| npm run test:chat | PASS: 27/27, 0 skipped |
| npm run test:shopify-oauth | PASS: 29 backend + 1 rendered UI |
| npm run test:shopify-unified-foundation | PASS: 50/50 |

Chat breakdown: 4 knowledge, 2 crypto, 2 permission, 1 input-boundary, 4 mock HTTP connector, 14 real PostgreSQL/database-server-path tests.
Production server modules run against actual PostgreSQL through an injected PostgREST transport and synthetic authorized context. This proves command/read behavior and SQL contracts; it does **not** prove Clerk cookies, live Supabase PostgREST, Next server-action transport or hosted authorization.

## Browser QA

Browser: Codex in-app Chromium browser, local 127.0.0.1:4121 synthetic preview.
No root .env, Clerk, Supabase or live Chatwoot runtime imports in the preview. Real production components receive explicit mocked actions; there is no production auth bypass.

Observed:
- Failed brand save showed an error and preserved inputs; success cleared the create form only after confirmation.
- Invalid JSON showed an error and preserved editor text.
- Selected saved JSON loaded; draft save remained distinct from explicit publication.
- A simulated response lost after commit retained the same form key: retry recovered the receipt with exactly two displayed versions, not a third.
- Two branch mappings displayed; explicit publication showed Version 1 published.
- Mock inbox sync and mapping displayed the saved channel in draft mode.
- Manager/viewer/finance could not render setup; owner could. These are preview policy tests, not authenticated role sessions.
- Switching A to B cleared the previous tenant's inbox/editor UI and showed B's empty setup.
- Platform prepare displayed synthetic one-time URLs; Hide setup URLs removed them.
- Phone iframe 375×812 and laptop iframe 1280×900 rendered without horizontal overflow. With browser scrollbar gutters, measured html clientWidth/scrollWidth were 339/339 and 1243/1243. These are CSS frame tests, not physical-device QA.

Screenshot: [responsive setup](../outputs/chat-ch1/final-20261021/setup-responsive.png).
The owner has not performed CHECKLIST Part C CH-1.

## Review fixes and limits

Fixed before final gates:
- Fresh request keys on every submit; now unchanged failed requests retain keys.
- Draft-only validation prevented publication retry; now authorized receipts are recovered first.
- Random generated IDs/hashes/ciphertext broke platform replay; stable logical request hashes and token fingerprints recover the original result. Replayed preparation/rotation never returns a newly generated, invalid URL.
- Tenant-wide pack limit and 10-item UI list hid history; now metadata pages per brand, always includes the published revision and fetches selected JSON through tenant/owner checks.
- Access audits lacked before/after facts; now safe role/permission changes are recorded atomically.
- Preview generated bundles were linted; their generated output is narrowly excluded.
- Earlier SQL alias collision and connector header mismatch were corrected and tested.

Parallel standards/spec review and focused re-review completed under the review skill. No remaining actionable finding or demonstrated P0/P1 defect was reported. Final tracked diff and new SQL/source inventory reviewed. This is not phase closure.

## Pinned connector contract sources

Read-only source review, Chatwoot v4.18.0:
- [Routes](https://github.com/chatwoot/chatwoot/blob/v4.18.0/config/routes.rb): account show, inbox and platform endpoints.
- [Account controller](https://github.com/chatwoot/chatwoot/blob/v4.18.0/app/controllers/api/v1/accounts_controller.rb): account membership/authorization before reads.
- [Platform account controller](https://github.com/chatwoot/chatwoot/blob/v4.18.0/app/controllers/platform/api/v1/accounts_controller.rb): custom_attributes accepted on create.
- [Platform account JSON](https://github.com/chatwoot/chatwoot/blob/v4.18.0/app/views/platform/api/v1/models/_account.json.jbuilder): reconciliation marker returned.
- [Token helper](https://github.com/chatwoot/chatwoot/blob/v4.18.0/app/controllers/concerns/access_token_auth_helper.rb): token header lookup.

HTTP mock tests cover response projection (discard provider credentials), identity mismatch, malformed/duplicate inboxes, failure/timeout and no implicit retries. No production or hosted Chatwoot compatibility claim.

## Remaining closure work

1. Establish an explicitly approved **isolated authenticated environment** with test identities and test tenants. The database/API environment and real Clerk Development login are now tested locally; see [authenticated QA](CH1_AUTHENTICATED_QA.md). Independent owner-b/platform denial and owner visual acceptance remain pending. See [local setup instructions](CH1_LOCAL_QA.md). Do not point these new migrations at shared production merely to obtain QA evidence.
2. Run [CHECKLIST Part C CH-1](CHECKLIST.md#c-build-with-codex-phase-by-phase): workspace, one brand/two branches, publication and channels; prove tenant B cannot access A using real authenticated requests.
3. Agent-run local Boutique **Tier A BA-001 through BA-014** now passes; see the authenticated evidence. Owner acceptance remains required. Original requirement: run Boutique **Tier A BA-001 through BA-014** from [phase gate policy](../docs_v2/10_Phase_Gate_QA_and_Commit_Policy.md#tier-a---full-critical-regression). This is required because permissions/types/navigation changed. Existing automated platform/Shopify tests are useful regression evidence but do not replace Tier A.
4. Record owner acceptance and complete final closure review; only then use existing D025 local commit authority. Do not start CH-2 before closure.

Domain/DNS, infrastructure, real credentials, Meta and n8n remain before-live dependencies. Shopify hosted OAuth approval/renewal, broader onboarding and deferred n8n work remain a separate task; imported data is not messaging consent.
No shared migration, public push/merge/deployment, live message, paid purchase/model call or n8n activation. External model/API spend: **USD 0**.
