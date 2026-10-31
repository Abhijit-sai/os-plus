# CH7 owned-local upgrade
2026-10-27. Applied only to verified owned PostgreSQL127.0.0.1:15437:96→101 migrations. Five new SQL files are now frozen; subsequent fixes need new timestamps. No shared/production SQL.

Native pre-upgrade dump restored into chat_restore_2e4462fa5574 (141 public tables,1711609 bytes). Rehearsal and actual upgrade preserved141 existing tables' counts/content hashes, projecting out only explicitly added Chat columns for the before/after comparison. Post-upgrade dump restored into chat_restore_49bc8e3ec916 (143 tables,1771624 bytes). Each native restore compared complete current rows, including new fields. Restricted browser ACL checks passed. No customer/order/task table DDL or existing operational-data rewrite.

Command: node --experimental-strip-types --conditions=react-server scripts/chat-local/upgrade-ch7.mjs --apply-owned-local
Evidence: outputs/chat-local/ch7-upgrade-report.json; private dumps retained there. Same-cluster database recovery only; no host/Clerk/object-storage/Chatwoot attachment DR claim. No historical migrations reapplied.

|Migration|SHA256|
|---|---|
|20261027120000_chat_notification_state.sql|bbd71c5946f431d4c14500340d373b2757566ea481e8700bd908d72b045c5a5e|
|20261027121000_chat_notification_commands.sql|893f6ed4d87d15e90b9d1a6ec2ccee42bb91569f20167f22ae9a544c0983d88b|
|20261027122000_chat_notification_summary.sql|5352de4c702970c683bb56069f81f4c131481866df6939bfd5f00df1dbb53108|
|20261027123000_chat_notification_dispatch.sql|40a58be80507ec561fc0830a2f33ab240194d2c920f22a9d1b45245ab9831cd5|
|20261027124000_chat_platform_alert_attempts.sql|d312c60fb76731afd14018b8f4fad31e94ee1464b97963abff974fe5302db95d|

Recovery: diagnose with separately named owned-local restore copies. Do not reset, downgrade or replace retained data. No public release or enablement implied.
