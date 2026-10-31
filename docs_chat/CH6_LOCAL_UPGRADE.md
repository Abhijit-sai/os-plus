# CH-6 owned-local migration record
Applied 2026-10-23, only owned isolated LOCAL PostgreSQL127.0.0.1:15437. Source83→96; thirteen new additive migrations, no historical replay/shared/production SQL. Nine new public tables,132 existing tables' counts/content hashes unchanged. Before native pg_dump restored/rehearsed in chat_restore_fac8dd00a78a (132tables,1522291bytes); after native pg_dump restored in chat_restore_af033dad7db4 (141tables,1662148bytes). Browser-denied ACLs and complete manifests PASS.
Command: node --experimental-strip-types --conditions=react-server scripts/chat-local/upgrade-ch6.mjs --apply-owned-local
Evidence: outputs/chat-local/ch6-upgrade-report.json, private native dumps retained under outputs/chat-local. Additional post-native API restore in ch6-local-api-report.json. Recovery scope is a fresh database in the same isolated cluster; no full host/Clerk/object storage/Chatwoot attachment disaster recovery claim.
These applied files are frozen. Subsequent SQL correction must be a new timestamped migration.

|Migration|SHA-256|
|---|---|
|20261022120000_chat_action_state.sql|e9bc65224dc935bb3376c4d56b25d4a0f67d1cbea308d582ca879bb67efc805b|
|20261022121000_chat_action_commands.sql|208286f94c6d98acd835507b608e282b50208834dfeee2b1b76375f52bc9f5d3|
|20261022122000_chat_handoff_tasks.sql|2765b7c821c093bbfae2c5d11df9283d019fdcbfc2e9fc04e0fa03375b4bd1fa|
|20261022123000_chat_capability_publication.sql|dc61f7e6b8b5953c8d0f77c0bf831d5fb3193b02a2fce29592a7d3b19a23faaa|
|20261022124000_chat_action_read.sql|37f7bbdf25254ecd0582b209c6284f8938101a2d33100ac04cb0867a624dc5af|
|20261023090000_chat_request_workflow.sql|1665ca7d8f897620819ab4149c547d1efab3f5fbf4cd80f60ab197685356e318|
|20261023091000_chat_agent_actions.sql|fc44ae0c81ee197ddf3e4f565e4922703c438fcc07e2b143190a14a549c4bc78|
|20261023092000_chat_action_configuration.sql|6cb5a8a6051b39a4e318af0be438b4d13f567734753db9d8454146c6f211ca1d|
|20261023093000_chat_public_outbox.sql|2a898ac65946e83fa106cc88a5a803dca85c8c7042a440a51de7f368570fa22a|
|20261023094000_chat_action_settings_read.sql|093c38f8e5e346a16fb4a49cd63b0e47832d6437f05f0eb891d6a6013d67b96d|
|20261023095000_chat_action_context.sql|e944a446b8871fabe059b099ce3d4565bf06c7b4cd72a5d4b5f4c6680687e200|
|20261023100000_chat_handoff_labels.sql|fc6a8771fb997006b8e68fe8c2eaff745e1699d17106039ef0cb71135816a263|
|20261023101000_chat_supplemental_delivery.sql|0cfdb108c1da777cbb1587deb390f9ca06820182e61aa6cbf1ee43f5002fe4e3|

No existing Boutique/Laundry behavior or existing customer/order table DDL was changed. Native customer/address/pickup/task commands are reused transactionally. Restore retained before/after snapshots into a separately named owned-local database if rollback diagnosis is needed; do not reset or destructively downgrade retained data.
