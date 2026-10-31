begin;
-- Existing CH1 tables are Chat-owned. Do not modify platform operational tables.
alter table chat_notification_targets
 add column version integer not null default 1 check(version>0),
 add column recipient_enc text,
 add column recipient_kind text check(recipient_kind in ('private','group','supergroup')),
 add column recipient_hint text check(recipient_hint ~ '^[0-9]{1,4}$'),
 add column confirmed_at timestamptz,
 add column activated_at timestamptz,
 add column link_code_enc text,
 add constraint chat_notification_activation check(not is_active or (recipient_enc is not null and linked_at is not null and confirmed_at is not null and activated_at is not null)),
 add constraint chat_notification_events check(events <@ array['booking_request','handoff','payment_claim','agent_failure','daily_summary','new_lead']::text[] and array_position(events,null) is null),
 add constraint chat_notification_private_summary check(not ('daily_summary'=any(events)) or recipient_kind='private' or not is_active);
create unique index chat_notification_link_unique on chat_notification_targets(link_code_hash) where link_code_hash is not null;
alter table chat_settings add column notifications_enabled boolean not null default false,
 add column notification_version integer not null default 1 check(notification_version>0);
commit;
