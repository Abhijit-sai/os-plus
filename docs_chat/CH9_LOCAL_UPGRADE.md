# CH-9 owned local upgrade — 28 October 2026

Applied ONLY to the owned loopback PostgreSQL on port15437. No shared/production database or historical migration was applied. Source evidence: outputs/chat-local/ch9-upgrade-report.json; command scripts/chat-local/upgrade-ch9.mjs --apply-owned-local. Default is plan-only.

| Migration | Purpose | Frozen SHA256 |
|---|---|---|
|20261028100000_chat_website_phone_claims.sql|Tenant-owned immutable unverified website phone claims; composite tenant FKs, RLS/ACL, atomic capture and audit.|0eecb31d0baae81f06f237883c192c260c542735cf93edc031e386de8c9a5d56|
|20261028101000_chat_website_claim_reads.sql|PII-controlled contact detail projection through current conversation ownership after explicit merge/split.|d5d27a8466c0129c0592dc663592a76aa40f0bc3a2ceca8f423189ef5ac2ad0d|

Schema104→106. Baseline checksum0a48a067b73d1795a11f8a44e0e20accb95b5326f59e36d87c99f14280e0fe66; final07503c9aad77be63be5ffa6dcd4d1b1180a90a45bf40249d1960f64ad79b9124. Both SQL files now frozen; future fixes require new timestamped SQL.

## Actual recovery evidence

| Stage | Restored database | Tables | Dump bytes | Dump SHA256 |
|---|---|---|---|---|
|Before|chat_restore_4f6ec9a53b2d|144|1828516|03a7b082de84030facd0e1351e3b6ff5b00e701dacd091442a04a592e9bd383a|
|After|chat_restore_b817882bcfb0|145|1838596|1fb4c00cb4af8a6aed0b8359084f73e31cfcfaf42c60ff3d62d2086dda97ffa3|

Native pg_dump/pg_restore completed before and after; exact SQL rehearsal against restored before database passed. All144 original table row manifests preserved. Restored anonymous/authenticated table/function access denied as intended. Only owned REST/Sidekiq stopped/resumed, in finally cleanup; no other worktree/infrastructure changed.

Claims table adds no backfill and never occupies a verified phone identity key. Existing wrapper functions remain private/service-only; no grants to browser roles. This is same-cluster database recovery evidence, not host loss, object-storage, Clerk, Chatwoot storage or complete disaster recovery certification. For recovery, preserve dumps and restore into a separately owned database after stopping writers; do not drop claims or reverse function wrappers against a live/shared system without a reviewed plan. No production rollback/deployment is authorized here.
