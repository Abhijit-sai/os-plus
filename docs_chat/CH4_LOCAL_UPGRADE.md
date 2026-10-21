# CH-4 local read migration preservation plan
Status: EXECUTED LOCAL / PASS,2026-10-22; original preservation plan retained below. Only owned loopback PostgreSQL15437, never shared Supabase.
Exact migration:20261021140000_chat_crm_reads.sql (indexes, service-only role/tenant-checked read RPC, internal reporting-hours helper). No customer/order/table data writes; no old78 migration replay.
1. Verify Docker nonce ownership, current78-file checksum and all previously applied source bytes.
2. Pause only owned Chatwoot worker and REST writes; private native dump, restore to fresh chat_restore_* copy and compare every public table count/hash.
3. Apply new SQL and79-file marker atomically in restored copy; assert all128 existing public tables unchanged.
4. Apply exact same bytes +marker atomically only to owned persistent LOCAL DB, assert preservation.
5. Dump/restore post-upgrade copy, all public counts/content hashes equal; anon/authenticated read-RPC execution denied and leads direct access denied.
6. Restart REST/worker in finally; refresh isolated app snapshot and provider/browser/Boutique/panel375px+desktop QA.
Script scripts/chat-local/upgrade-ch4.mjs. Refuses missing/altered baseline or existing read RPC, retains private reports/backups. All synthetic fixtures retained. Same-cluster DB recovery only, no Clerk/attachments/host recovery claim.
Execute after local disposable tests/final review/gates pass. No real channels/messages/public exposure/paid models/n8n activation.

## Executed — 2026-10-22
PASS: only20261021140000_chat_crm_reads.sql applied to owned isolated PostgreSQL15437. Prior78 files not replayed. All128 public tables' exact counts/content hashes unchanged before/after new read RPC/indexes. Pre-upgrade native dump1388707bytes restored to chat_restore_37be4fac6897; post-upgrade1408646bytes restored to chat_restore_d757e3abf1eb. Both manifests equal; anon direct leads and anon/authenticated read-RPC execution denied. Restored ACL PASS. Private outputs/chat-local/ch4-upgrade-report.json and dumps retained. Same-cluster database recovery only. REST/worker resumed.
New isolated app snapshot app-1792608784756, both loopback listeners4131, actual retained Clerk owner-a opens Leads. Fresh tab13 recovered browser requests left stale during restart; initial compile/navigation delay is not an application defect.
Actual local Chatwoot provider10/10 PASS on new runtime; accounts901/902 conversations10/5. No real external messages/shared SQL/production changes.
