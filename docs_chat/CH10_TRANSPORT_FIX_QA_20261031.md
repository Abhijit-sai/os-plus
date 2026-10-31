# Hosted transport connection follow-up - 31 October 2026

Status: source fix tested and reviewed; PR preparation under CHAT-D076. Not deployed or enabled. CH10 engineering acceptance D072 is unchanged; full hosted/real-business acceptance remains partial.

## Scope and fixed base

Current main643cf10e7ed7f340f0614b598f23468c12988d6c. SAMEcodex/chat-ch1-foundation at6b13c02 before this fix; source/config/SQL matched main before editing. Existing D075 approval, custody/host incident and QA records preserved. No merge/rebase/switch/stash/reset/newworktree. D076 explicitly permits the small source fix, tests and PR preparation only. The necessary reviewed feature-branch publication checkpoint is preparation under this scope and existing push authority, not full CH10 closure or production release authority.

Existing setupChatwootTransport had no caller. Added transport-actions.ts delegating the current setup code and returning only sanitized status. Existing platform page passes this action into its existing panel. A masked, required secret form appears only for active workspaces whose setup module is enabled, and clears on success. Exact tenant/secret/account/platform checks, current execution flags, encrypted credentials, reservations/reconciliation and inbox modes remain in existing code. No SQL or permission/schema changes. Existing synthetic preview adds an active linked fixture and mock connection success/failure; no live runtime imports.

## Automated evidence

All commands executed against this worktree; logs in ignored outputs/ch10-transport-fix-20261031.

| Command | Actual result |
|---|---|
| npm run typecheck | PASS |
| npm run lint | PASS after correcting one JSX apostrophe copy error |
| npm run build | PASS; repeated after final copy change landed during first build, final build PASS |
| npm run test:roles | PASS role policy, Chat guards and23exact ingress cases |
| npm run test:v2 | PASS all4scripts |
| npm run test:chat | PASS320/320,0fail/skip/cancel/todo in owned native runner |
| focused Shopify import-plan/import-preview/commercial-order/draft-setup/source-payments tests | PASS30/30,0skip; daemon-independent, no Shopify import/provider call |

Five new action regressions are INCLUDED in320: real platform authorization, real call-time flags, real connection/encryption/secret validation and real transport orchestrator, with only external Clerk/DB/HTTP/Next cache boundaries simulated. Normal off-mode connection creates bot/webhook but attaches no inbox; foreign/nonplatform/malformed/wrongsecret submissions fail safely, access revoked during discovery/disabled module prevent writes, lost provider response reconciles one bot and completed setup replays without extra creation. The external DB receipt fixture is not fresh authenticated SQL/RLS or full hosted E2E evidence. Existing native suite exercises actual106migration replay/SQL/isolation in disposable infrastructure only.

TDD: first action test failed ENOENT for missing action, then passed after minimal wrapper; additional guard/reconciliation checks passed through actual existing internals. No unsafe repeat of live failed account action during diagnosis. Test clients enforce example.invalid origins; no production credentials in this fixture.

Fullsuite uses existing scripts/chat-release allowlist and runner, bundle9819ad5822e974eeb0061de94ccd9451e5b3a1d5be7585f216f13439dfcc2e0e,60.4MiB/source+installeddeps only, no.env/private access. Sole authorizedhost2.29.113.198: nonce-owned internal network,512MiBNode/512MiBPostgres, no ports, no pulls/live volumes/env.320/320 in63.0s; min hostavailable1429MiB; all7live service IDs/state/restartcounts unchanged; ownership-verified cleanupPASS. This is test capacity evidence, not production load assurance. Test reports/logs under ignored outputs; no new shared SQL.

## Actual browser interface checks

In-app browser, existing synthetic preview at127.0.0.1:4126, real production components with explicit mock actions. Desktop form visible for linked enabled fixture. Blank submission gives native required-field feedback; actual DOM input type=password/autocomplete=new-password. Successful synthetic submission shows status and empties secret. Simulated failure shows safe error; no provider call. Actual mobile innerWidth390/innerHeight844/clientWidth378/scrollWidth378, no horizontal overflow; requested390 initially yielded312CSSpx due browser zoom, then calibrated override to actual390. Override reset, synthetic tab closed. Screenshots outsideGit in existing visualizationroot: chat-connection-preview-desktop-20261031.png and chat-connection-preview-mobile-20261031.png. No real credential entered or captured.

Owned preview startup initially failed before launch because Get-Command returned multiple Node paths; selecting one executable corrected it. Cleanup safeguard initially stopped on DateTime-string formatting mismatch; nonsecret process inspection proved exact executable/startUTC/command/parent-child chain. Compared UTCDateTime values, then stopped only owned parent46672/child12488; listener4126count0. No unrelated process stopped.

No shared Boutique/tenant/permission/customer/order/finance/query/navigation helper changes, so no new TierA/shared TierB mutation trigger. Role/V2 and30focused Shopify contracts pass; previously executed production Owner/Manager native Boutique acceptance remains dated evidence, not a fresh full rerun. Preview does not prove Clerk, OSPLUS personas, Chatwoot browser login or SSO.

## Fixed-base review

Two independent review agents under the review skill compare current workingtree/newfiles against643cf10 (untracked files explicitly included).

### Standards
0hard violations/0remaining advisories. Preserved platform auth, call-time flags, exactscope, encrypted credentials and audited receipts; no sharedSQL/Boutique changes. One runbook advisory corrected.

### Spec
0remaining findings. One P2 runbook sequence contradiction corrected: after linked account/operator prerequisites, temporarily enable ONLY Test setup through its existing audited command, map agent_mode=off inbox, then connect receipt-backed transport. Provisioning enablement is not completed hosted acceptance. Existing SQL/module guard remains mandatory.

## Live configuration and limits

D075 actual account903 created once through authenticated OSPLUS audited reserve/create/record after owner manually added platformtoken/redeployedmain. Workspacefe129501-a508-44c8-85f3-adb048f9415d belongs solely to Test7be40f50-94a0-46c5-af57-7eea5e36ea8a. READONLY12:03:48.246UTC: pending/account903/attempttrue/no accounttoken/bot, three completed platformreceipts, enabledmodules0/channels0.901/902 separate. No new operator/inbox/message yet. Owner's saved2webhookURLs/privateACL/DPAPI roundtrip verified, no values printed. Current temporary provisioning flags are owner-reported; successful native accountcreation proves the needed path works. No agentVercel UI mutation. Oldassetdeploymentmarker alone is not source/config proof on cache-reused deployments.

No source deployment, new migration, tenant membership change, Test activation, real-business/Shopifycutover/Meta/WhatsApp, AI/STT/Telegram, n8n workflow or purchase.35Chat migrations alreadyinstalled; frozen106 history unchanged. Native operator password handoff, accounttoken link, Test inbox/mapping/receipt-backed webhook setup and visitor->lead->staffreply remain pending. Required actual hosted persona/PII/isolation/SSO/PartD/real-data security gates remain distinct. BackupD069deferred/notPASS. Featureprovider/STT/judgeUSD0; coding-agent billing unmeasured.

Next: publish reviewable feature PR; obtain concrete merge/deploy authority after review. Deploy then-current reviewedmain with every Chatmodule stilldisabled; resume D075 operator/inbox setup and controlled Test setup enablement. Restore dryRun=true/adminLive=false after successful provisioning. FullCH10/real-business closure is not eligible.