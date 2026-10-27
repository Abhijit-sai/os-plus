# CH-7 Telegram and daily summary implementation plan
2026-10-27. Base a192a4dca2b87d75b54db1e60d18d98795d45f1a, existing codex/chat-ch1-foundation worktree D:/Develop/os-plus-chat-ch0. CH6 committed CLOSED LOCAL; no branch restart. Scope05CH7.1–7.5 only. Owner D050 authorizes recommended choices/continuation; real Telegram/liveAI/sharedSQL/n8n activation remain unauthorised.

## Verified contracts and differences from proposals
- CH1 already created tenant-owned notification_targets, normalized notification_target_brands and summary_runs; no runtime exists. Reuse these. Brand filters are normalized composite FKs, not the proposed UUIDarray.
- Existing roles are Chat-local fixed permission policies; notification configuration/reporting stays owner_admin, no Boutique/Laundry role changes. Group recipients cannot be proven equivalent to OS PLUS report permissions.
- Existing secrets AAD allows account_token/bot_token only; extend with separate notification recipient/link purposes, preserving existing envelopes. Bot token remains server environment; recipients/link material encrypted and excluded from setup DTOs.
- Existing chat_settings has timezone and21:30 localtime. Notifications disabled by default; settings writes audited. Budget hard ceiling D041 supersedes proposed draft_only behavior.
- CH6 stores provisional requests, actual staff materialization, native tasks/reasons and domain/lead events. A task/new pickup is not a confirmed appointment/payment/delivery. Summary names distinguish these.
- Judge/model execution remains disabled. Report unavailable/unrated instead of inventing an experience score. Synthetic judge data, if tested, explicitly labelled; no paid scoring.
- Cron stage maintenance already has dedicated bearer endpoint; new hourly orchestration uses distinct call-time secret and preserves existing entry. No broad public-route prefix. No new existing customer/order/task table change.
- Telegram has no application idempotency key on sendMessage. A durable unique logical delivery prevents duplicate claims; an unknown POST receipt is held, never automatically resent. Do not promise distributed exactly-once under network ambiguity.
- Existing scope has no domain selected; authenticated code links use configured trusted OS PLUS origin, not guessed host headers. No public token or transcript/phone/notes in Telegram.
- No reference repository consultation needed: new implementation from these requirements; no inherited business workflow/facts.

## Recommended decisions selected under D050 (D053)
Owner-only target/settings/preview controls. New target inactive/noevents.30min single-use high-entropy link code, stored hash plus encrypted retry material, never logged; Telegram secret header verified before bounded parsing. Tenant comes from matched issued code, not update payload. Claim links remain inactive until owner confirms the destination. DM/group linking supported; edited/channel/anonymous/bot/forwarded commands ignored. No unsolicited confirmation sends.
Daily summary is owner DM-only initially. Group alerts minimal: event kind, business/brand label and authenticated lead link, no customer/message/financial data. Owner grants each event/brand explicitly. Revocation/config revision is rechecked before delivery.
Summary window is the interval ending at this tenant's configured local-time cutoff, starting at previous corresponding cutoff for first run, then last recorded end. Latest due slot only, no historical notification backfill. Window is printed; DST/changed schedule tested; a localdate is unique even if settings change. Targets activated after the cutoff wait until next report. Records report per-target confirmed/uncertain/cancelled results; partial delivery never becomes all-sent.
Cron route named hourly; inactive new-platform n8n export polls every5minutes for small schedule lag. No instance/credential assignment/activation. Durable alerts use source identity/target uniqueness and activation fences; no old history imported as fresh.
LiveTelegram flags/defaultdryrun remain off. Production and loopback-mock transport explicit; preview is write-free and never sends. Platform failures route only to platform operator target, contain no tenant/customer transcript. Missing ratings/costs are unavailable, not healthy zeros. Currency totals grouped, never combined across currencies.

## Planned files/migrations
src/features/chat/notifications/{schemas,rules,summary,commands,queries,worker,handlers,server-actions}.ts; src/integrations/telegram/client.ts; owner setup component and settings integration; exact api/chat/webhooks/telegram and cron/hourly routes/proxy/type declarations; read-only summary preview script; inactive deploy/n8n/chat-hourly.json; synthetic unit/actual DB/HTTP/mock transport tests.
New timestamped SQL20261027120000_chat_notification_state.sql,121000_chat_notification_commands.sql,122000_chat_notification_summary.sql,123000_chat_notification_dispatch.sql and124000_chat_platform_alert_attempts.sql (fifth file added after reviewD054; applied files are frozen, subsequent fixes need new timestamps). Only Chat-owned schema changes, composite FKs/RLS/restrictedserviceACL/current actor+tenant authorization/audit/idempotency. No retained/shared migration before explicit owned-local verified upgrade/recovery rehearsal.

## Verified sequence/gates
1 Pure schemas/link parsing/schedule/message/privacy/metric semantics red→green.
2 Actual disposable migrations: tenant/role denial, single-use code races/expiry/replay, recipient encryption, target revocation, source dedupe, summary dates/DST/concurrency/rollback, delivery ambiguity.
3 Server commands/routes and mocked HTTP Telegram; bounded/timeouts/redirect/receipt/current-target fences. Two tenants/different schedules each one confirmed mock summary under replay.
4 Owner setup/preview/status UI with hydration/version safety; authenticated role/tenant/desktop375CSSpx frame QA.
5 Six required gates plus focused BoutiqueTierB (tenant switch, existing order/production/tracking) for exact proxy and adjacent setup changes; escalate toTierA if scope touches shared runtime/types/permissions more broadly.
6 Owned-local upgrade/dump/restore only if needed for authenticated UI; defaultflags off, test fixture opt-in only. QA workbook records actual scope, no inferred14PASS.
7 Two-axis finalreview, summary/checklist/currentphase. CH7 owner/live Telegram delivery and selected judge acceptance remain separate. D050 specifically waived CH6 owner/live closure gate, so do not assume CH7 owner acceptance merely from continuation authority.

Primary API references checked2026-10-27: [Telegram Bot API](https://core.telegram.org/bots/api#setwebhook), [sendMessage](https://core.telegram.org/bots/api#sendmessage), [n8n export/import](https://docs.n8n.io/build/manage-workflows/export-and-import.md). Header secret_token, bounded4096text, numericchatIDs and response receipts follow official API; exports contain no credentials.
