import type { Json, Order } from "./database.ts";

export type ShopifyConnectionRecord = {
  id: string; tenant_id: string; shop_gid: string; canonical_domain: string; app_ref: string;
  environment: "production" | "development"; api_version: "2026-10";
  status: "pending" | "verified" | "paused" | "disconnected";
  verified_at: string | null; intake_enabled: boolean; processing_enabled: boolean; import_created_at_cutoff: string;
  draft_import_enabled: boolean; scopes_verified_at: string | null;
  protected_customer_fields_verified_at: string | null; source_copy_authorized_at: string | null; release_enabled: boolean;
  revision: number; created_at: string; updated_at: string;
};
type ReceiptRecord = {
  id: string; tenant_id: string; connection_id: string; delivery_id: string; event_id: string | null;
  topic: "orders/create" | "orders/updated" | "orders/cancelled"; api_version: "2026-10";
  order_gid: string; body_sha256: string; triggered_at: string | null; received_at: string;
};
type JobRecord = {
  id: string; tenant_id: string; connection_id: string; order_gid: string;
  requested_generation: number; requested_at: string; created_at: string;
  completed_generation: number; claimed_generation: number | null; claimed_connection_revision: number | null;
  lease_token: string | null; lease_expires_at: string | null; attempts: number; first_attempt_at: string | null;
  next_attempt_at: string; last_error_code: string | null; dead_lettered_at: string | null; updated_at: string;
};
type ConflictRecord = {
  id: string; tenant_id: string; receipt_id: string; incoming_body_sha256: string;
  incoming_topic: ReceiptRecord["topic"]; incoming_order_gid: string;
  incoming_api_version: "2026-10"; created_at: string;
};
type ConnectionRelationship<Name extends string> = {
  foreignKeyName: Name; columns: ["tenant_id", "connection_id"]; isOneToOne: false;
  referencedRelation: "shopify_connections"; referencedColumns: ["tenant_id", "id"];
};
export type ShopifyIntakeTables = {
  shopify_commercial_details: {
    Row: {tenant_id:string;source_order_id:string;revision_id:string;schema_version:number;details:Json;raw_expires_at:string;created_at:string};
    Insert:never;Update:never;Relationships:[];
  };
  shopify_source_revisions: {
    Row: {id:string;tenant_id:string;source_order_id:string;job_id:string;generation:number;source_updated_at:string;observed_at:string;
      source_digest:string;sealed_source:Json;review_reasons:Json;completeness:"partial"|"complete";source_customer_gid:string|null;created_at:string};
    Insert:never;Update:never;Relationships:[];
  };
  shopify_connections: {
    Row: ShopifyConnectionRecord;
    Insert: never;
    Update: never;
    Relationships: [{ foreignKeyName: "shopify_connections_tenant_id_fkey"; columns: ["tenant_id"];
      isOneToOne: false; referencedRelation: "tenants"; referencedColumns: ["id"] }];
  };
  shopify_webhook_receipts: {
    Row: ReceiptRecord; Insert: never; Update: never;
    Relationships: [ConnectionRelationship<"shopify_receipts_connection_fk">];
  };
  shopify_sync_jobs: {
    Row: JobRecord; Insert: never; Update: never;
    Relationships: [ConnectionRelationship<"shopify_jobs_connection_fk">];
  };
  shopify_webhook_conflicts: {
    Row: ConflictRecord; Insert: never; Update: never;
    Relationships: [{ foreignKeyName: "shopify_conflicts_receipt_fk"; columns: ["tenant_id", "receipt_id"];
      isOneToOne: false; referencedRelation: "shopify_webhook_receipts"; referencedColumns: ["tenant_id", "id"] }];
  };
  shopify_connection_audit: {
    Row: {
      id: string; tenant_id: string; connection_id: string; actor_kind: "USER" | "SYSTEM"; actor_id: string | null;
      action: "register" | "pause" | "resume" | "disconnect" | "auth_pause"; reason_code: string;
      request_key: string | null; request_fingerprint: Json | null; before_revision: number | null;
      after_revision: number; before_state: Json | null; after_state: Json; result: Json; created_at: string;
    };
    Insert: never; Update: never;
    Relationships: [ConnectionRelationship<"shopify_connection_audit_tenant_id_connection_id_fkey">];
  };
};
export type ShopifyIntakeFunctions = {
  read_shopify_privacy_review: {Args:{p_tenant_id:string;p_connection_id:string;p_actor_id:string;p_request_id:string};Returns:Json};
  purge_expired_shopify_pilot: {Args:{p_tenant_id:string;p_connection_id:string;p_actor_id?:string|null;p_limit?:number};Returns:Json};
  receive_shopify_pilot_event: {Args:{p_tenant_id:string;p_connection_id:string;p_envelope:Json};Returns:Json};
  observe_shopify_pilot: {Args:{p_tenant_id:string;p_connection_id:string;p_updated_at:string|null};Returns:Json};
  uninstall_shopify_pilot: {Args:{p_tenant_id:string;p_connection_id:string;p_shop_gid:string;p_delivery_id:string;p_body_sha256:string};Returns:Json};
  read_shopify_application: {Args:{p_tenant_id:string;p_actor_id:string;p_domain:string;p_app_ref:string;p_customer_search?:string};Returns:Json};
  command_shopify_application: {Args:{p_tenant_id:string;p_connection_id:string;p_actor_id:string;p_request_key:string;p_action:string;p_input:Json};Returns:Json};
  shopify_pilot_policy: {Args:{p_tenant_id:string;p_connection_id:string};Returns:Json};
  recover_shopify_application_release: {Args:{p_tenant_id:string;p_connection_id:string;p_actor_id:string;p_request_key:string;p_source_order_id:string;p_review_id:string};Returns:Json};
  read_shopify_payment_source: { Args: {p_tenant_id:string;p_actor_id:string;p_order_id:string}; Returns:Json };
  list_operational_orders: { Args: {p_tenant_id:string;p_search?:string|null;p_source?:string|null;
    p_status?:string|null;p_payment?:string|null;p_view?:string;p_limit?:number}; Returns:Order[] };
  review_shopify_change: { Args: {p_tenant_id:string;p_connection_id:string;p_actor_id:string;p_request_key:string;
    p_source_order_id:string;p_case_id:string;p_observed_revision_id:string;p_accepted_revision_id:string;p_action:string;p_reason:string}; Returns:Json };
  save_shopify_draft_review: { Args: {p_tenant_id:string;p_connection_id:string;p_actor_id:string;p_request_key:string;
    p_source_order_id:string;p_source_revision_id:string;p_expected_version:number;p_decision:Json}; Returns:Json };
  release_shopify_order: { Args: {p_tenant_id:string;p_connection_id:string;p_actor_id:string;p_request_key:string;
    p_source_order_id:string;p_review_id:string;p_input:Json;p_recovery_only?:boolean}; Returns:Json };
  save_shopify_mapping: { Args: {p_tenant_id:string;p_connection_id:string;p_actor_id:string;p_request_key:string;p_input:Json}; Returns:Json };
  receive_shopify_privacy: { Args: { p_input: Json }; Returns: Json };
  redact_shopify_source: { Args: { p_tenant_id: string; p_connection_id: string; p_actor_id: string;
    p_request_id: string; p_request_key: string; p_limit?: number }; Returns: Json };
  purge_shopify_privacy_contacts: { Args: { p_tenant_id: string; p_connection_id: string; p_limit?: number }; Returns: number };
  import_shopify_draft: {
    Args: { p_input: Json; p_recovery_only?: boolean };
    Returns: Json;
  };
  recover_shopify_draft: {
    Args: { p_input: Json };
    Returns: Json;
  };
  register_shopify_connection: {
    Args: { p_tenant_id: string; p_actor_id: string; p_request_key: string; p_shop_gid: string;
      p_domain: string; p_app_ref: string; p_environment: string; p_cutoff: string };
    Returns: Json;
  };
  set_shopify_connection_state: {
    Args: { p_tenant_id: string; p_connection_id: string; p_actor_id: string; p_request_key: string;
      p_expected_revision: number; p_action: string };
    Returns: Json;
  };
  claim_shopify_jobs: {
    Args: { p_tenant_id: string; p_connection_id: string; p_environment: string; p_app_ref: string; p_limit: number };
    Returns: Json;
  };
  update_shopify_job_lease: {
    Args: { p_tenant_id: string; p_connection_id: string; p_environment: string; p_app_ref: string;
      p_job_id: string; p_lease_token: string; p_generation: number; p_connection_revision: number;
      p_action: string; p_error_code: string | null; p_retry_after_seconds?: number | null };
    Returns: boolean;
  };
  receive_shopify_event: {
    Args: {
      p_tenant_id: string; p_connection_id: string; p_shop_domain: string; p_app_ref: string;
      p_environment: string; p_expected_revision: number; p_topic: string; p_delivery_id: string;
      p_event_id: string | null; p_api_version: string; p_order_gid: string;
      p_body_sha256: string; p_triggered_at: string | null;
    };
    Returns: Json;
  };
};
