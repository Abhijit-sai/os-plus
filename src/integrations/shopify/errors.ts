export type ShopifyErrorCode =
  | "REFERENCE_MATCH_REQUIRED"
  | "ORDER_HISTORY_SCOPE_REQUIRED"
  | "WEBHOOK_SIGNING_MISMATCH"
  | "WEBHOOK_CONFIGURATION_CONFLICT"
  | "WEBHOOK_SETUP_REQUIRED"
  | "WEBHOOK_SETUP_UNCONFIRMED"
  | "REVIEW_REQUIRED"
  | "STALE_REVISION"
  | "IDEMPOTENCY_CONFLICT"
  | "RELEASE_DISABLED"
  | "CONFIGURATION_BUSY"
  | "SOURCE_CHANGED"
  | "SOURCE_UNAVAILABLE"
  | "INTAKE_DISABLED"
  | "REQUEST_INVALID"
  | "CONNECTION_UNAVAILABLE"
  | "DELIVERY_CONFLICT"
  | "CONNECTION_TEST_DISABLED"
  | "CONFIGURATION_INVALID"
  | "SHOP_DOMAIN_INVALID"
  | "BODY_TOO_LARGE"
  | "AUTHENTICATION_REQUIRED"
  | "ACCESS_DENIED"
  | "SHOP_INACTIVE"
  | "API_VERSION_MISMATCH"
  | "THROTTLED"
  | "UPSTREAM_UNAVAILABLE"
  | "UPSTREAM_REJECTED"
  | "RESPONSE_INVALID"
  | "GRAPHQL_INCOMPLETE";

// Omit upstream messages, bodies, headers and causes: they can contain tokens
// or protected customer information. These codes are safe for diagnostics.
export class ShopifyIntegrationError extends Error {
  readonly code: ShopifyErrorCode;
  readonly retryAfterSeconds: number | null;

  constructor(code: ShopifyErrorCode, retryAfterSeconds: number | null = null) {
    super(code);
    this.name = "ShopifyIntegrationError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
