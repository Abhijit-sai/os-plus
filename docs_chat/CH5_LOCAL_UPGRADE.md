# CH-5 owned-local preservation upgrade
Status: reviewed plan, 2026-10-22; not yet executed. Existing deployed/shared database is excluded.
Destination: nonce-verified owned PostgreSQL127.0.0.1:15437 and associated REST15438/gateway15439 only.
Baseline:79 exact applied repository migrations/CH4 checksum,128 public tables. Do not replay historical SQL.
Apply exactly four new reviewed files:
-20261022100000_chat_agent_runtime.sql
-20261022101000_chat_agent_commands.sql
-20261022102000_chat_agent_draft_read.sql
-20261022103000_chat_staff_draft_sends.sql
Script scripts/chat-local/upgrade-ch5.mjs --apply-owned-local:
1. Verify baseline source checksum, owned DB/REST/Chatwoot resources and absence of new runtime RPC.
2. Pause owned REST writes and Chatwoot callback worker. Keep existing synthetic records.
3. Native custom-format pg_dump; restore into a new chat_restore_* database; compare every public table count/content hash.
4. Rehearse all four files and83-file schema marker atomically in that restored copy. Literal outer BEGIN;/COMMIT; lines fold into one transaction; PL/pgSQL bodies remain intact. Verify all128 existing tables byte-equivalent.
5. Apply identical SQL+marker transaction only to the owned retained LOCAL database; compare all existing tables.
6. Native post-upgrade dump/restore; compare all132 tables and restored browser ACL denial. No host/Clerk/attachment disaster-recovery claim.
7. Resume REST/worker in finally. Refresh only owned app snapshot with live model/engine/key disabled; test human draft controls and mock preview.
Private backups/manifests/report under outputs/chat-local, never committed or uploaded. These are generated local recovery files, not production downloads. Gate evidence: CH5_QA.md/same living summary.


## Execution complete —2026-10-22
Supersedes original not-yet-executed plan status. All seven preservation/upgrade/restore steps PASS on owned LOCAL only. Exact evidence: CH5_QA.md migration hashes and private outputs/chat-local/ch5-upgrade-report.json. Before1417915bytes/chat_restore_270ea9baa552/128tables,after1488075bytes/chat_restore_a006ce2a4cf9/132tables;128preexisting table hashes preserved,83file marker,restored ACL PASS. App snapshot app-1792654429903 refreshed,live model/global agent off. Applied four files frozen; future corrections require additive migration. No shared/hosted SQL.
