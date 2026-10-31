# CH8 owned local upgrade — 27 October 2026

Applied only to owned loopback PostgreSQL15437; schema101 →104. No shared/production database, historical replay or external deployment. scripts/chat-local/upgrade-ch8.mjs verifies owned Docker labels, exact baseline checksum, absent CH8 function, and executes only the three allowlisted migrations. Existing Chatwoot worker/REST paused for consistent native backup/rehearsal; resumed in finally.

## Frozen migrations

|Filename|SHA256|
|---|---|
|20261027170000_chat_voice_state.sql|86e688b540e5c4ff40ee027a0cbc8398d805c69ff8c27dca671db5e1a3a31696|
|20261027171000_chat_voice_commands.sql|73fc7b4d4511b02b94ada06fef6918e33ddc0f18c8f415f942a1f34914a54a83|
|20261027172000_chat_voice_context_reads.sql|67a494487ddddea640ce0e13d7a855feae7bbb301d15b474f49e699c1fa92cab|

Baseline checksum:
b73c5bec8fb04c0c9ce3ea1bcd125758b2894c8f6c451023f46ffb06c978b038
Final checksum:
0a48a067b73d1795a11f8a44e0e20accb95b5326f59e36d87c99f14280e0fe66

## Actual native recovery evidence

- before: pg_dump/pg_restore into chat_restore_f806b385d75c, 143 tables, 1777395 bytes. Backup ch8-before-chat_restore_f806b385d75c.dump, SHA256 9bd5d1db8dc4dd78bd1fd82f193e2f807212e7817bb0524e43b40f3c88d85001
- after: pg_dump/pg_restore into chat_restore_3a73d8392f36, 144 tables, 1803788 bytes. Backup ch8-after-chat_restore_3a73d8392f36.dump, SHA256 d1f9b5a94b6bcf074a0663c4495a9da0300d8c1f617ea8bc99f0e67df872797f

Before restored copy rehearsed all three SQL atomically, compared row-count/content hashes for all143 existing public tables (excluding only new chat_settings columns). Retained apply preserved the same143 manifests. After restored copy has144 tables; anonymous/authenticated voice RPC denial and prior table ACLs verified. Report result PASS. No model/customer network call in migration.

Full source report outputs/chat-local/ch8-upgrade-report.json and local-only dumps retained under outputs/chat-local. Dumps contain synthetic local application data and encrypted configuration; do not upload or expose them. Same-cluster restores prove PostgreSQL data/schema/ACL recovery only. No full-host/storage/Redis/Chatwoot/Clerk disaster recovery or production rollback certification. Frozen SQL must not be rewritten; any further SQL correction requires a new timestamped migration and reviewed local upgrade.

Recovery gate passed. Owner accepted local CH8 results2026-10-28 under CHAT-D058; live gates explicitly deferred/release-blocking. No additional SQL applied in closure session. USD0.