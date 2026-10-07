export type ShopifyErrorCode =
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
