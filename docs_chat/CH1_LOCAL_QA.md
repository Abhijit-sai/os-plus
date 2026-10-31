# CH-1 isolated local acceptance environment

Prepared 21 October 2026 in `D:\Develop\os-plus-chat-ch0`, branch `codex/chat-ch1-foundation`. CH-1 remains **QA_BLOCKED** pending authenticated browser QA and owner acceptance. This guide supplements [CH1_QA.md](CH1_QA.md) and [CHECKLIST Part C, CH-1](CHECKLIST.md#c-build-with-codex-phase-by-phase).

## What is running

- Dedicated Docker project `osplus-chat-local-8e8d10a9c1`, persistent volume and bridge network.
- PostgreSQL 17 on **127.0.0.1:15437**, actual PostgREST on **127.0.0.1:15438**, Supabase-compatible database gateway on **127.0.0.1:15439**.
- Pinned, already-installed image IDs in `scripts/chat-local/compose.yaml`; no image downloads or production services.
- 73 actual repository migrations, including both new CH-1 migrations, applied only locally. Optional inherited handover dependency tables use the documented synthetic harness shape.
- Synthetic Local QA A, Local QA B and Local QA Disabled businesses. A/B Chat modules explicitly enabled as fixtures; Disabled has no enabled module. Other environments retain default-off behavior.
- Local QA A has a brand, north/south branches, draft knowledge, a synthetic website channel and Boutique customer/order/workflow fixtures. No real phone, provider token or customer record.
- The actual application launcher is prepared for **http://localhost:4131**. Real Clerk Development login and authenticated local QA completed on 21 October; see [CH1_AUTHENTICATED_QA.md](CH1_AUTHENTICATED_QA.md) for results and the remaining owner/independent-login/visual checks.

Each app launch copies the current source/config/public files into a new ignored snapshot under `outputs/chat-local/app-<timestamp>`; source hashes are recorded in `snapshot-manifest.json`. No source environment files are copied. Only development Clerk keys, generated local database/crypto keys and an allowlisted process environment reach Next. Chat dry run is true; live Chatwoot administration is false. No Shopify/provider credentials are supplied. Source edits need an app restart to refresh the snapshot.

This provides the database REST surface, not a full Supabase deployment: Auth, Storage uploads and Realtime endpoints are not implemented. Clerk remains a real external **development** identity service requiring internet. No DNS/domain setup is needed for localhost. The Docker network is a dedicated bridge, not a network egress firewall; isolation relies on loopback bindings, fresh local credentials, synthetic data and disabled integrations.

## Commands

In PowerShell:

```powershell
Set-Location D:\Develop\os-plus-chat-ch0
npm run chat:local -- up
npm run chat:local -- status
npm run qa:chat-local
npm run chat:local -- app
```

Keep the app terminal open. Stop it with Ctrl+C. To stop the database/API without deleting data:

```powershell
npm run chat:local -- stop
```

Repeated `up` preserves data and does not reseed/reapply migrations. Changed migration hashes cause an explicit refusal, requiring a reviewed local upgrade. The runner verifies resource ownership. Do not run a generic Docker prune or remove the private state/volume to solve a failure.

Private local files are in ignored `outputs/chat-local/`: `private.json`, `compose.env`, `clerk.env`, synthetic dump files and evidence. They must remain private and outside commits. Generated database JWTs have a 30-day lifetime; request a local credential refresh before further QA after expiry. The restore is a database-level drill in this same isolated cluster, not a fresh-host or Clerk/Storage disaster recovery exercise.

## Clerk setup reference — owner-a completed

1. Open the Clerk dashboard for the intended application and select its **Development** instance. If none exists, create a separate development application for this local QA. Do not use or change Production.
2. In that development instance, enable email **verification codes** for signup/signin (rather than email verification links). Use the built-in test mode, normally enabled for Development.
3. Copy its publishable key (`pk_test_...`) and secret key (`sk_test_...`) into **`D:\Develop\os-plus-chat-ch0\outputs\chat-local\clerk.env`**:

   ```dotenv
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   OS_PLUS_SUPER_ADMIN_CLERK_USER_IDS=
   ```

   Replace the examples with real development keys privately. Never paste keys into chat. The launcher rejects production prefixes and unexpected variables. Leave the last line blank until step 5.
4. Run `npm run chat:local -- app`. Open **http://localhost:4131/sign-up** and create `owner-a+clerk_test@example.com`. For the email code use **424242**. If a password or name is required, supply synthetic test details; don't reuse a real password. The app links this verified email to its preseeded local memberships.
5. In Clerk Development → Users, open that new user, copy its `user_...` ID into `OS_PLUS_SUPER_ADMIN_CLERK_USER_IDS` in the same file, then restart the app command. This grants platform administration only in this local app process; it does not grant production access.
6. Sign in at **http://localhost:4131/sign-in**. Select **Local QA A** at `/select-tenant`. Confirm `/settings/chat` and `/super-admin/chat-workspaces` load. Tell Codex **“Development keys are saved and owner-a is signed in”**; do not send the keys. Codex can then continue authenticated QA in the accessible browser.

Create the other test users via signup in the same Development instance as needed. Sign out between roles or use separate browser profiles.

| Email | Local memberships / purpose |
|---|---|
| owner-a+clerk_test@example.com | Owner of A and B; tenant-switch and platform setup |
| owner-b+clerk_test@example.com | Owner of B only; negative isolation checks |
| manager-a+clerk_test@example.com | Manager of A; denied Chat settings, leads permissions checked |
| viewer-a+clerk_test@example.com | Viewer of A; starts denied, configurable leads viewing/PII |
| finance-a+clerk_test@example.com | Finance of A; starts denied Chat access |

Only owner-a belongs in the local superadmin allowlist. For a meaningful negative test, owner-b must remain a tenant owner, not a platform administrator.

Clerk documents that `+clerk_test` addresses use test mode and verification **codes** use 424242 without sending an email. Verification **links** behave differently; use codes. [Official Clerk test identity instructions](https://clerk.com/docs/guides/development/testing/test-emails-and-phones).

## Owner acceptance checklist — accepted 21 October 2026

CHAT-D030 records owner acceptance of C1–C8 and the disclosed local/iframe evidence limits. Independent owner-b isolation/platform denial now passes; current full results are in CH1_AUTHENTICATED_QA.md.

Agent-run setup and all 14 Boutique Tier A paths now pass locally; see [authenticated evidence](CH1_AUTHENTICATED_QA.md). Owner acceptance and independent owner-b/platform-denial checks are complete. Authenticated390px iframe evidence is accepted; no physical-phone claim. Review these with synthetic local data, then report pass/fail and any unexpected behavior. Codex can run browser mechanics, record evidence and help diagnose; the owner must explicitly accept the result.

- [x] **C1 Platform/enablement:** as owner-a, open `/super-admin/chat-workspaces`. Confirm Disabled stays off. Disable/re-enable B with Save module access and confirm entry visibility follows the saved state. A/B must remain separate.
- [x] **C2 Brand/branches:** select A; at `/settings/chat`, create a new acceptance brand with a unique slug and map the existing North and South branches. Existing branches can be inspected at `/settings/locations`.
- [x] **C3 Knowledge:** use `docs_chat/examples/new-business.pack.json` as synthetic input, save a draft, inspect and publish it. Create a second draft; confirm the first stays published until explicitly replaced, and invalid JSON leaves entered text intact. Do not introduce real business facts.
- [x] **C4 Channel/safety:** inspect the seeded website channel, mapped brand/branch and draft mode. Live sync/link/create is intentionally blocked by dry run. Do not insert real Chatwoot credentials or disable that guard. Provider connector behavior has mock HTTP evidence; a real-provider or authenticated channel remapping pass is not claimed.
- [x] **C5 Permissions/isolation:** owner-a switches A/B without seeing A's draft/form data in B. Owner-b cannot select A or access A's records through copied identifiers. Manager/viewer/finance cannot enter owner settings or platform pages. Owner-configurable viewer lead-view and PII grants save independently; CH-1 has no Leads screens yet. Codex should record actual authenticated request denials, not just hidden navigation.
- [x] **C6 Responsive/error behavior:** use laptop and a 390px responsive browser viewport; verify no horizontal overflow, readable validation, preserved input on failure and success only after server confirmation.
- [x] **C7 Boutique regression:** complete BA-001–BA-014 from the existing [Tier A policy](../docs_v2/10_Phase_Gate_QA_and_Commit_Policy.md#tier-a---full-critical-regression), with Codex recording each result. Includes sign-in/selection, customer/measurement/order creation, multiple items, workflow start/complete, public tracking, partial payment, finance/GST, communication dry-run queue and order edit. Use the seeded `QA-SEED-001` order or new synthetic orders. No real messages or payment transactions.
- [x] **C8 Owner sign-off:** explicitly state which C1–C7 checks passed and what failed. Codex records evidence, resolves defects and performs final closure review before using existing local phase-commit authority.

If a required Tier A path needs an unsupported service such as Storage, record it as blocked and prepare that local service; do not use production as a substitute.

## Evidence completed without Clerk

`outputs/chat-local/qa-report.json`: **8 passed groups**, using real HTTP/PostgREST and Supabase SDK with production server permission/query/command modules. Only the Clerk identity context is synthetic; these are not authenticated browser/server-action tests.

- Unknown/forged credentials and anonymous workspace/RPC access denied.
- Safe setup DTOs, cross-tenant knowledge denial, manager settings denial and module-off behavior.
- Concurrent duplicate commands produce one brand and one audit; foreign references/actors fail; failed audit rolls back.
- Knowledge concurrent revisions, publication, unchanged retry recovery and immutable JSON.
- Existing payment integrity, workflow-stage concurrency (12 race pairs), and order-add-items database smokes pass.
- Actual pg_dump/pg_restore: **117 public tables** matched by content hash and count; restored anon access remains denied and service access works. Dump and restore database retained locally.

`outputs/chat-local/lifecycle-report.json`: stop/start preserves row counts; repeated up does not reseed; missing Clerk keys block app launch.

Required gates: typecheck PASS; lint PASS; build PASS (51/51); roles PASS; V2 four suites PASS; Chat **37/37**, none skipped. Prior Shopify OAuth (29 backend + 1 UI) and unified foundation (50) results remain recorded in CH1_QA; not rerun solely for this local tooling addition.

No new schema migrations in this local-environment session. No deployment, enabled production module, external model calls, paid purchase, real message or n8n activation. API/model spend **USD 0**.
