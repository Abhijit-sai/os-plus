# CH-3 isolated local upgrade and restore
Status: EXECUTED PASS — 2026-10-21. Exact3 migrations applied only to owned LOCAL15437, with pre/post restore proof (below). Owned local PostgreSQL15437 only, never application .env.local or shared Supabase.

1. Verify Docker endpoint and DB/REST ownership nonce. Verify prior75 SQL checksum; reject an altered baseline or previously applied CH-3.
2. Stop only owned REST writes. Save a private pg_dump, restore to a new chat_restore_* database, and compare every public table count/hash.
3. Apply only20261021123000_chat_contacts_leads.sql,20261021124000_chat_contact_lead_commands.sql and20261021125000_chat_lead_refresh.sql atomically to the restored copy. Compare existing table data, ignoring only the new nullable chat_conversations.contact_id.
4. Apply the same three SQL byte sequences and checksum marker in ONE transaction to the persistent owned LOCAL fixture DB. Never replay old migrations.
5. Backfill only synthetic fixturesA/B via a SYSTEM/AUTOMATION command using retained transport facts and per-message receipts. No invented historical phone/source verification.
6. Dump/restore the upgraded data into a second new local database; compare all public tables and CRM ACL. Keep private backups/reports and restoration copies. Restart REST in finally.
7. Refresh the isolated app snapshot, then provider/browser and Boutique QA. Scheduler/n8n remain disabled. No production release authority.

Script: scripts/chat-local/upgrade-ch3.mjs. It refuses unexpected baseline/checksum and previously applied CH-3. Record actual outcomes in CH3_QA.md and the SAME project_summary.md. Existing owner authorization covers isolated local setup and QA; no external systems are changed.

## Executed result — 2026-10-21
Supersedes PREPARED above: PASS. All seven steps through database recovery completed; application/provider regression now in progress. Before121 tables/1300073 bytes; after128 tables/1383312 bytes. Exact3 migrations applied only owned LOCAL15437 with atomic marker, old75 never replayed. Restores chat_restore_d8f8edc7afcc and chat_restore_d44476af6654 verified count/content equality; anon ACL denied. Report outputs/chat-local/ch3-upgrade-report.json and CH3_QA.md. Original backups retained privately. No shared/hosted migrations or host/Clerk/attachment disaster recovery claim.
