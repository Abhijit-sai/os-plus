# CH-1 implementation plan — Foundation

Created: 2026-10-07. Updated: 2026-10-21. Status: QA_BLOCKED — foundation implemented and all automated gates pass; owner/authenticated acceptance and Boutique Tier A remain outstanding. P1/P2 and integration are resolved by CHAT-D026/D027/D028. Evidence: [CH1_QA.md](CH1_QA.md).
Branch: codex/chat-ch1-foundation.
Worktree: D:/Develop/os-plus-chat-ch0.
Current integrated base/HEAD: 24a0af7140c51fd061f2f2054c046a325999a298, local merge of released c686337 into the closed CH-0 baseline. Preservation checkpoint: 1619c61. CH-1 implementation remains uncommitted pending closure gates.
Original Shopify and documentation worktrees remain untouched.

## Scope from 05_Phase_Plan_WBS.md

- CH-1.1: additive foundation tables, tenant constraints, RLS and indexes.
- CH-1.2: leads:view, leads:manage, leads:pii, chat_settings:manage; module guard; tenant-owned role configuration and audited owner controls.
- CH-1.3: versioned AES-256-GCM encryption with call-time configuration.
- CH-1.4: platform super-admin workspace enablement; link or provision Chatwoot account; fresh workspace key and webhook secret; privileged one-time webhook setup URLs.
- CH-1.5: tenant Settings → Chat brands, existing-branch mappings, inbox sync and channel mapping; draft by default.
- CH-1.6: strict Zod knowledge-pack schema; JSON editor, draft/version management and explicit publishing.
- Acceptance: test tenant A has a workspace, brand, two existing branches, published pack and mapped channels; tenant B cannot read or mutate them.

CH-1 has no message capture, native inbox, agent/model calls, contact/customer conversion, lead pages, staff SSO handoff, live Meta onboarding, notification delivery or scheduler workflow. Foundation notification/staff tables are created only; their later-phase behavior is not implemented early. The shared chat hostname and /crm/auth routing proof remain later-phase work.

## Proposed files and migrations

Names below are the planned inventory; split small modules/components as implementation requires and record the final list in project_summary.md.

| Location | Work |
|---|---|
| supabase/migrations/YYYYMMDDHHMMSS_chat_foundation.sql | New tables, constraints, indexes, updated-at triggers and default-deny browser RLS |
| supabase/migrations/YYYYMMDDHHMMSS_chat_foundation_commands.sql | Atomic audited service-role-only foundation command RPCs; retry-sensitive idempotency |
| src/features/chat/{schemas,knowledge-pack,permissions,module,secrets,dtos}.ts | Boundary validation, pure access/module rules, server-safe DTOs and crypto adapter |
| src/features/chat/{queries,actions,commands}.ts | Verified tenant/super-admin adapters; tenant predicates; Domain Command writes |
| src/integrations/chatwoot/admin-client.ts | Minimum CH-1 account provision/link verification and inbox listing; strict response schemas/timeouts |
| src/app/(super-admin)/super-admin/chat-workspaces/page.tsx | Platform provisioning and workspace controls using existing super-admin guard |
| src/app/(tenant)/settings/chat/page.tsx | Brands, branch/channel mapping, knowledge-pack editor/publishing, role controls |
| src/components/chat/* | Small setup components using existing UI/form feedback conventions, mobile layouts |
| src/app/(tenant)/settings/page.tsx and narrow super-admin navigation entry | Discoverable setup links; no simulated working Chats CTA |
| src/lib/permissions/roles.ts; src/types/database.ts | Add chat permission/type declarations while preserving legacy permissions/routes |
| .env.example | Server-only key versioning, approved platform Chatwoot endpoint/credential configuration |
| package.json; scripts/test-chat*.mjs; scripts/test-role-route-policy.mjs | Introduce test:chat and meaningful phase/legacy-role tests |
| docs_chat/02_Architecture_and_Data_Model.md, 03_Agent_Spec.md, 06_Decision_Log.md, CHECKLIST.md, project_summary.md | Resolve approved policies, document additive schema differences, QA and current status |

Tables: tenant_modules, chat_settings, chat_workspaces, chat_brands, chat_brand_locations, chat_knowledge_packs, chat_channels, chat_role_permissions, chat_staff_links, chat_notification_targets, chat_summary_runs. Add chat_notification_target_brands as a tenant-owned junction: the proposed brand_ids UUID array cannot enforce composite tenant foreign keys. No existing Boutique/Laundry table alteration in CH-1; task CHECK extensions belong to their later phase.

Every new row has tenant ownership; child references use composite tenant foreign keys. A channel's default branch must also belong to its brand mapping. Active pack publishing/version allocation, configuration changes with audit events, and workspace enablement/configuration must be transactional. Published pack revisions remain immutable; publishing explicitly replaces the active published version atomically. No synthetic example is automatically seeded or published.

External Chatwoot provisioning cannot participate in a Postgres transaction. Track pending/active/suspended state and retry identity; test interrupted provisioning and reconciliation before marking success. Never claim Promise.all is atomic or delete an existing remote account as compensation. CH-1 tests use a local mock, not production account creation.

Secrets: bind authenticated encryption to tenant/workspace/purpose, store versioned ciphertext, validate keys at call time, and reject wrong-context/tampered/unknown-version decryptions. Account/bot/platform tokens never reach browser DTOs or logs. The explicitly required webhook setup URLs are displayed only in the privileged one-time setup response; routine reads expose neither token nor recoverable secret.

## Contradictions with current code/doc assumptions

1. roles.ts is static and there is no configurable role settings storage. Add the chat-specific resolver/configuration; existing role permissions and default routes remain intact.
2. Browser Supabase uses anon without Clerk-backed Supabase identity. Use authenticated server adapters and mandatory tenant predicates; RLS default deny is defense in depth, not a fictional browser membership policy.
3. Multiple-tenant selection is already Clerk membership plus a selected-tenant cookie. Same email alone is not authorization; do not replace this context.
4. Actor/source enums are uppercase; actor Clerk identity is distinct from tenant_user UUID. Match the command contracts and validate every referenced membership.
5. Existing RPCs are explicitly service-role-only. New SECURITY DEFINER RPCs require equivalent explicit revoke/grant controls and transactional ownership checks.
6. Actual routes use /super-admin/... and the existing settings layout already requires settings:view. Put owner setup controls within those conventions rather than granting managers general settings access.
7. No chat permission, module schema or knowledge-pack validator currently exists. Configuration must be additive and all existing tenants remain disabled until explicit enablement.
8. Proposed notification brand_ids arrays do not enforce tenant references. Normalize to the new junction table above.
9. Chatwoot Community Edition does not include custom roles/permissions or custom branding in the current official edition comparison. Do not map a read-only viewer to a full agent or treat a toggle as Chatwoot enforcement.
10. No basePath/proxy/auth-origin support exists for the single chat hostname. Do not change the existing app base path in CH-1.
11. Agent spec still contains an obsolete optional payment-screenshot vision/task paragraph despite CHAT-D023. Correct it to the accepted exclusion; no payment workflow is built.
12. Agent/model/business policy values from older prose are not new-business approval. Knowledge-pack validation is implemented now; production model choice, customer wording and booking/financial behavior remain later owner decisions.

The broader CH0_SCHEMA_AUDIT.md also records customer-command, Laundry-task and pickup-slot gaps. They do not justify modifying those live paths in CH-1.

## Access proposals from 7 October — accepted 21 October (CHAT-D026/D027)

P1 — Role defaults: proposed owner/admin full access and settings; manager view/manage leads plus PII; viewer/finance denied initially with owner-configurable lead viewing and separate PII grant. Reports remain owner/admin-only. Viewers remain read-only. Owner accepted the viewer/finance grants on 21 October (CHAT-D026).

P2 — Viewer inbox access: proposed initial configurable read-only Leads in OS PLUS, Chatwoot entry disabled until equivalent read-only controls are verified. Alternatively, require read-only Chatwoot in the first release, which needs a capability/edition and cost decision before promising it.

Reference: https://www.chatwoot.com/pricing/self-hosted-plans (verified 2026-10-07). No paid purchase is authorized by either answer. One-login via the Platform API handoff is a separate requirement from Enterprise SAML.

No domain, real credentials or business facts are required to start offline foundation implementation. Live hostname/Clerk origins, infrastructure, Meta assets, SMTP, branding/edition choice, real knowledge/model approval and service permissions remain before-live dependencies, not assumed answers.

## Verification and closure

Sequence after P1/P2 answers: record IN_PROGRESS; pure schema/access/crypto tests; additive storage and command tests; mock admin connector; setup UI; phase gate review.

Required platform commands: npm run typecheck, npm run lint, npm run build, npm run test:roles, npm run test:v2, npm run test:chat.

Meaningful phase checks:
- Knowledge schema rejects invalid/unknown fields, duplicate keys, bad service/location references and incompatible optional capability configuration.
- Crypto round-trip, random nonce, tamper rejection, tenant/purpose binding, missing/rotated key versions.
- Module disabled, wrong/inactive tenant membership, role and separate PII grant combinations.
- Actual SQL application against a disposable local database; cross-tenant FK/command/read rejection, anon denial, atomic rollback, concurrent pack version publishing and retry-sensitive commands.
- Mock Chatwoot account mismatch, invalid inbox shape, timeout/failure and provisioning retry/reconciliation.
- Safe DTOs, no token leakage; authorized one-time webhook setup response only.
- Browser QA at phone/laptop sizes with owner/manager/viewer and tenant A/B, settings save failure feedback and published-pack visibility.

Shared permissions/types/navigation require Boutique Tier A, BA-001 through BA-014 in docs_v2/10_Phase_Gate_QA_and_Commit_Policy.md. Do not substitute source assertions for browser/database evidence.

Historical environment limitation (resolved 21 October): local Docker Linux engine was unavailable during CH-0. Docker 29.7.2 now runs the actual migration/independent-session suite on disposable PostgreSQL 17. Investigate or use an isolated local Postgres runtime; do not apply to a shared/production Supabase project. If actual migration/tenant isolation or required browser/Boutique QA cannot run, record QA_BLOCKED and stop phase closure.

Owner manual acceptance: CHECKLIST.md Part C → CH-1 (two test tenants, one brand/two branches, publish pack). Deployment/Meta setup is CHECKLIST Part B/A and can be prepared separately; no live action is performed implicitly.

Local commits and continuing after successful gates are already authorized (CHAT-D025). Push/merge/deploy, shared migrations, real messages, paid model runs and n8n activation remain separately authorized actions.

## Historical resumption and baseline integration proposal — 21 October 2026

Superseded by accepted CHAT-D028 and completed commits 1619c61/24a0af7; retained below as the original preservation plan. The current state and evidence are above and in CH1_QA.md.

P1/P2 are now accepted as CHAT-D026/D027. Existing CH-0 HEAD is 4f74bd6; locally recorded released main is c686337c0f059cbe6ae40bbcadc2f6c0da2ffc0a. The branch has one unique Chat commit and is missing 18 later release commits. No merge/rebase has occurred.

### Relevant release changes

- Raw orders permit Shopify drafts with nullable customer/delivery and external financial ownership. Preserve source buyer versus linked customer and actual lifecycle states.
- Customer/order/finance/communication consumers now use protected operational views or authorized retained Shopify reads. Never restore old raw-order reads or create local receipts from source facts.
- Database types now compose ShopifyIntakeTables/Functions and operational views; extend this shape additively.
- Settings contains the owner-only Shopify connection entry, and proxy.ts exempts exact provider/worker-authenticated POST routes. Preserve both.
- Existing tenant/permission/Supabase/core command helpers and root package-lock are unchanged.
- Twenty later Shopify migrations plus separately documented SQL packages exist. Local replay is for disposable databases only; owner-applied historical shared SQL must not be reapplied.
- Read-only integration reference: C:/Users/abhij/OneDrive/Documents/New project 2/os-plus-shopify-auto-release-20261019, local summary and docs/46-49. Saved evidence says c686337 is Ready; no independent deployment query this session.
- OAuth activation/hosted renewal and broader tenant onboarding, n8n/automatic sync, raw-payload cleanup and separate hosted manager acceptance remain Shopify work. They are not added to CH-1 scope.

### Proposed preservation and local integration

1. Copy the existing planning files and this session's documentation updates into a new ignored outputs/chat-ch1/resume-20261021-* snapshot, recording SHA-256 hashes. Do not copy credentials, node_modules or another checkout's working files.
2. With explicit owner approval for this exception, commit only the reviewed Chat planning/decision/summary/checklist documents as a local preservation checkpoint. This is not CH-1 closure. Keep the same branch and worktree.
3. Locally merge exact c686337 into codex/chat-ch1-foundation using no-commit merge review. No branch switch, rebase, stash, reset, force or public release.
4. Resolve project_summary.md by preserving all Chat session history and latest released status, not choosing an entire side. Keep the locally read Shopify post-release updates as an attributed current dependency note. Preserve CH-0 deployment/docs files.
5. Verify the staged runtime tree equals released c686337 before adding Chat runtime code; the expected additional files are Chat-only documents/kit. Review all merge conflicts/diffs, run platform baseline and affected existing Shopify regressions, then make the approved local merge commit if checks pass.
6. If any required check fails, retain the reviewable state and record the blocker; do not silently discard or force through. No shared migration, push/PR merge or deployment follows this local integration.

This checkpoint/merge needs explicit approval because the current worktree is dirty and the owner's resume instruction prohibits silent baseline integration; CHAT-D025 grants phase-closure commits, not an unreviewed mid-phase integration exception.

### Next small implementation slice

After integration, record CH-1 IN_PROGRESS and use test-first synthetic cases for the knowledge-pack boundary and tenant/purpose-bound versioned encryption; introduce test:chat. Then add the approved access resolver. Database/UI work follows with actual isolated SQL and browser evidence.

Docker was rechecked on 21 October: Linux engine pipe unavailable. Ubuntu WSL has no installed psql/postgres on PATH. Resolve an isolated local database runtime before migration/concurrency closure; PGlite alone cannot prove independent-session races.

## Implemented scope and remaining gate

All CH-1 foundation slices in this plan are implemented locally. See CH1_QA.md for the exact file inventory, two migration names, 37 passing Chat tests, API contract sources, browser evidence and limits. Owner acceptance and Boutique BA-001–BA-014 are complete; CH-2 starts after the local foundation commit. No shared database migration, external Chatwoot call, release or module enablement occurred.
