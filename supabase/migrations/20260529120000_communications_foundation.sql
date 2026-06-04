create table if not exists public.communication_channel_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel text not null,
  provider text,
  mode text not null default 'disabled',
  is_enabled boolean not null default false,
  sender_name text,
  sender_address text,
  reply_to text,
  provider_config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint communication_channel_settings_channel_check check (channel in ('whatsapp', 'email')),
  constraint communication_channel_settings_mode_check check (mode in ('disabled', 'sandbox', 'live')),
  constraint communication_channel_settings_sender_address_required check (
    mode <> 'live' or length(btrim(coalesce(sender_address, ''))) > 0
  )
);

create table if not exists public.communication_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel text not null,
  purpose text not null,
  name text not null,
  subject text,
  body_text text not null,
  body_html text,
  provider_template_name text,
  safe_variables jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint communication_templates_channel_check check (channel in ('whatsapp', 'email')),
  constraint communication_templates_purpose_check check (
    purpose in (
      'order_update',
      'tracking_link',
      'payment_received',
      'payment_reminder',
      'pickup_ready',
      'dispatch_ready',
      'delivery_update',
      'custom_safe_note'
    )
  ),
  constraint communication_templates_name_not_blank check (length(btrim(name)) > 0),
  constraint communication_templates_body_not_blank check (length(btrim(body_text)) > 0)
);

create table if not exists public.communication_trigger_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  trigger_type text not null,
  channel text not null,
  template_id uuid not null references public.communication_templates(id) on delete restrict,
  delay_minutes integer not null default 0,
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint communication_trigger_rules_trigger_type_check check (
    trigger_type in (
      'order_confirmed',
      'customer_status_changed',
      'pickup_ready',
      'dispatch_ready',
      'order_partially_delivered',
      'order_delivered',
      'payment_received',
      'balance_pending',
      'payment_reminder_before_delivery',
      'payment_overdue',
      'manual_tracking_link',
      'manual_payment_reminder'
    )
  ),
  constraint communication_trigger_rules_channel_check check (channel in ('whatsapp', 'email')),
  constraint communication_trigger_rules_delay_non_negative check (delay_minutes >= 0)
);

create table if not exists public.communication_message_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel text not null,
  customer_id uuid references public.customers(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  order_item_id uuid references public.order_items(id) on delete set null,
  receivable_payable_id uuid references public.receivables_payables(id) on delete set null,
  template_id uuid references public.communication_templates(id) on delete set null,
  trigger_rule_id uuid references public.communication_trigger_rules(id) on delete set null,
  trigger_type text,
  trigger_event_key text,
  recipient_name text,
  recipient_phone text,
  recipient_email text,
  subject text,
  body_text text not null,
  body_html text,
  status text not null default 'queued',
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  attempt_count integer not null default 0,
  provider_message_id text,
  provider_response_json jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  constraint communication_message_queue_channel_check check (channel in ('whatsapp', 'email')),
  constraint communication_message_queue_status_check check (
    status in ('queued', 'sending', 'sent', 'failed', 'skipped', 'cancelled')
  ),
  constraint communication_message_queue_attempt_count_non_negative check (attempt_count >= 0),
  constraint communication_message_queue_body_not_blank check (length(btrim(body_text)) > 0),
  constraint communication_message_queue_recipient_present check (
    (channel = 'whatsapp' and length(btrim(coalesce(recipient_phone, ''))) > 0)
    or (channel = 'email' and length(btrim(coalesce(recipient_email, ''))) > 0)
  )
);

create table if not exists public.communication_message_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  message_queue_id uuid references public.communication_message_queue(id) on delete set null,
  event_type text not null,
  old_status text,
  new_status text,
  notes text,
  provider_response_json jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  constraint communication_message_logs_event_type_check check (
    event_type in ('queued', 'previewed', 'sent', 'failed', 'retried', 'skipped', 'cancelled', 'provider_update')
  )
);

create unique index if not exists idx_communication_channel_settings_active_channel
  on public.communication_channel_settings(tenant_id, channel)
  where deleted_at is null;

create index if not exists idx_communication_templates_tenant_channel
  on public.communication_templates(tenant_id, channel, purpose)
  where deleted_at is null;

create index if not exists idx_communication_trigger_rules_tenant_trigger
  on public.communication_trigger_rules(tenant_id, trigger_type, channel)
  where deleted_at is null;

create unique index if not exists idx_communication_queue_event_key
  on public.communication_message_queue(tenant_id, channel, trigger_event_key)
  where deleted_at is null and trigger_event_key is not null;

create index if not exists idx_communication_queue_ready
  on public.communication_message_queue(tenant_id, status, scheduled_for)
  where deleted_at is null;

create index if not exists idx_communication_queue_customer
  on public.communication_message_queue(tenant_id, customer_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_communication_queue_order
  on public.communication_message_queue(tenant_id, order_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_communication_message_logs_message
  on public.communication_message_logs(tenant_id, message_queue_id, created_at desc);

alter table public.communication_channel_settings enable row level security;
alter table public.communication_templates enable row level security;
alter table public.communication_trigger_rules enable row level security;
alter table public.communication_message_queue enable row level security;
alter table public.communication_message_logs enable row level security;

drop trigger if exists communication_channel_settings_set_updated_at on public.communication_channel_settings;
create trigger communication_channel_settings_set_updated_at
before update on public.communication_channel_settings
for each row
execute function set_updated_at();

drop trigger if exists communication_templates_set_updated_at on public.communication_templates;
create trigger communication_templates_set_updated_at
before update on public.communication_templates
for each row
execute function set_updated_at();

drop trigger if exists communication_trigger_rules_set_updated_at on public.communication_trigger_rules;
create trigger communication_trigger_rules_set_updated_at
before update on public.communication_trigger_rules
for each row
execute function set_updated_at();

drop trigger if exists communication_message_queue_set_updated_at on public.communication_message_queue;
create trigger communication_message_queue_set_updated_at
before update on public.communication_message_queue
for each row
execute function set_updated_at();

comment on table public.communication_channel_settings is 'Tenant-owned WhatsApp/email channel configuration. Provider credentials must remain server-side.';
comment on table public.communication_templates is 'Tenant-owned transactional message templates with safe variable rendering only.';
comment on table public.communication_trigger_rules is 'Tenant-owned opt-in trigger rules for order, status, payment, and reminder messages.';
comment on table public.communication_message_queue is 'Tenant-owned rendered transactional messages awaiting dry-run, sandbox, or live sending.';
comment on table public.communication_message_logs is 'Tenant-owned audit trail for communication queue status changes and provider responses.';
