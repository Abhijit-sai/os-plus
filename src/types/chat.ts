import type { Json } from "./database.ts";
type Owned = {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};
type Table<Row> = { Row: Row; Insert: never; Update: never; Relationships: [] };
export type ChatWorkspace = Owned & {
  chatwoot_base_url: string;
  chatwoot_account_id: number | null;
  workspace_key: string;
  webhook_secret_hash: string;
  api_token_enc: string | null;
  bot_token_enc: string | null;
  agent_bot_id: number | null;
  status: "pending" | "active" | "suspended";
  provisioning_key: string;
  provisioning_attempted_at: string | null;
  last_event_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
};
export type ChatBrand = Owned & {
  name: string;
  slug: string;
  persona_name: string;
  languages: string[];
  reply_style_json: Json;
  review_url: string | null;
  website_url: string | null;
  is_active: boolean;
  deleted_at: string | null;
};
export type ChatPack = Owned & {
  brand_id: string;
  version: number;
  status: "draft" | "published" | "archived";
  pack_json: Json;
  published_at: string | null;
  published_by: string | null;
};
export type ChatChannel = Owned & {
  workspace_id: string;
  brand_id: string;
  default_location_id: string | null;
  chatwoot_inbox_id: number;
  kind: "whatsapp" | "instagram" | "facebook" | "website";
  name: string;
  agent_mode: "off" | "draft" | "auto";
  can_book: boolean;
  can_share_statement: boolean;
  whatsapp_number_e164: string | null;
  is_active: boolean;
};
export type ChatContact = Owned & {
  display_name: string | null;
  prefs_json: Json;
  notes: string | null;
  customer_id: string | null;
  merged_into: string | null;
  first_seen_at: string;
  last_seen_at: string;
  version: number;
  deleted_at: string | null;
};
export type ChatLead = Owned & {
  ref_code: string;
  brand_id: string;
  location_id: string | null;
  channel_id: string;
  channel_kind: ChatChannel["kind"];
  contact_id: string;
  conversation_id: string;
  customer_id: string | null;
  kind: "sales" | "service" | "spam";
  intent: string | null;
  services: string[];
  area: string | null;
  stage: "new" | "engaged" | "booked" | "in_progress" | "won" | "lost";
  lost_reason: string | null;
  owner_tenant_user_id: string | null;
  owner_source: "auto" | "manual" | null;
  est_value: number | null;
  currency: string;
  gist: string | null;
  handoff: boolean;
  notes: string | null;
  order_id: string | null;
  booking_subject_type: "laundry_pickup_request" | "task" | null;
  booking_subject_id: string | null;
  booking_pickup_id: string | null;
  booking_task_id: string | null;
  first_customer_at: string;
  first_response_at: string | null;
  first_human_response_at: string | null;
  last_customer_at: string;
  last_reply_at: string | null;
  closed_at: string | null;
  version: number;
};
export type ChatTables = {
  chat_contacts: Table<ChatContact>;
  leads: Table<ChatLead>;
  chat_contact_identities: Table<{
    id: string;
    tenant_id: string;
    contact_id: string;
    kind:
      | "phone"
      | "chatwoot_contact"
      | "instagram"
      | "facebook"
      | "web_visitor";
    value: string;
    verified: boolean;
    source: string;
    created_at: string;
  }>;
  lead_events: Table<{
    id: string;
    tenant_id: string;
    lead_id: string;
    at: string;
    kind: string;
    from_value: Json | null;
    to_value: Json | null;
    actor_type: "USER" | "SYSTEM" | "AGENT" | "WEBHOOK";
    actor_id: string | null;
    source: string;
    correlation_id: string;
    meta_json: Json;
  }>;
  chat_identity_conflicts: Table<{
    id: string;
    tenant_id: string;
    contact_id: string;
    candidate_contact_id: string;
    kind: string;
    value: string;
    created_at: string;
  }>;
  chat_contact_merges: Table<{
    id: string;
    tenant_id: string;
    from_contact_id: string;
    to_contact_id: string;
    snapshot_json: Json;
    after_hash: string;
    created_at: string;
    created_by: string;
    split_at: string | null;
    split_by: string | null;
  }>;
  chat_lead_capture_receipts: Table<{
    tenant_id: string;
    message_id: string;
    at: string;
  }>;

  tenant_modules: Table<
    Owned & {
      module_key: "chat_leads";
      is_enabled: boolean;
      enabled_at: string | null;
      enabled_by: string | null;
      config_json: Json;
    }
  >;
  chat_settings: Table<
    Owned & {
      timezone: string;
      summary_local_time: string;
      quiet_minutes: number;
      lost_after_days: number;
      hot_hours: number;
      monthly_budget_usd: number | null;
      budget_action: "draft_only";
      default_currency: string;
    }
  >;
  chat_workspaces: Table<ChatWorkspace>;
  chat_brands: Table<ChatBrand>;
  chat_brand_locations: Table<
    Owned & {
      brand_id: string;
      location_id: string;
      map_url: string | null;
      lat: number | null;
      lng: number | null;
      service_areas: string[];
      service_postal_codes: string[];
      hours_json: Json;
      is_primary: boolean;
      sort_order: number;
    }
  >;
  chat_knowledge_packs: Table<ChatPack>;
  chat_channels: Table<ChatChannel>;
  chat_role_permissions: Table<
    Owned & {
      role: "viewer" | "finance";
      permission: "leads:view" | "leads:pii";
      allowed: boolean;
    }
  >;
  chat_staff_links: Table<
    Owned & { tenant_user_id: string; chatwoot_user_id: number }
  >;
  chat_notification_targets: Table<
    Owned & {
      kind: "telegram";
      label: string;
      telegram_chat_id: string | null;
      events: string[];
      link_code_hash: string | null;
      link_code_expires_at: string | null;
      linked_at: string | null;
      is_active: boolean;
    }
  >;
  chat_notification_target_brands: Table<
    Owned & { target_id: string; brand_id: string }
  >;
  chat_summary_runs: Table<
    Owned & { local_date: string; sent_at: string | null; payload_json: Json }
  >;
};
export type ChatFunctions = {
  chat_lead_command: {
    Args: { p_context: Json; p_action: string; p_input: Json };
    Returns: Json;
  };
  chat_lead_refresh: {
    Args: { p_context: Json; p_input: Json };
    Returns: Json;
  };
  chat_lead_backfill: {
    Args: { p_context: Json; p_after_id?: string | null };
    Returns: Json;
  };
  chat_transport_setup: {
    Args: { p_context: Json; p_action: string; p_input: Json };
    Returns: Json;
  };
  chat_capture: {
    Args: { p_context: Json; p_kind: string; p_input: Json };
    Returns: Json;
  };
  chat_capture_issue: {
    Args: { p_context: Json; p_input: Json };
    Returns: Json;
  };
  chat_configure: {
    Args: { p_context: Json; p_action: string; p_input: Json };
    Returns: Json;
  };
  chat_platform_configure: {
    Args: { p_context: Json; p_action: string; p_input: Json };
    Returns: Json;
  };
};
