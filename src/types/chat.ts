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
export type ChatTables = {
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
  chat_configure: {
    Args: { p_context: Json; p_action: string; p_input: Json };
    Returns: Json;
  };
  chat_platform_configure: {
    Args: { p_context: Json; p_action: string; p_input: Json };
    Returns: Json;
  };
};
