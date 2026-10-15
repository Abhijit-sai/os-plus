import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.ts";
import { ShopifyIntegrationError } from "./errors.ts";
import { shopifyMappingBindingSchema, type ShopifyMappingBinding } from "./mapping.ts";
import { shopifyReviewDecisionSchema, type ShopifyReviewDecision, type ShopifyPreparedRelease } from "./release-preparation.ts";

const releasedSchema = z.object({ status: z.literal("released"), orderId: z.string().uuid(),
  sourceRevisionId: z.string().uuid(), itemCount: z.number().int().min(1).max(500) }).strict();
// SQL error text is never surfaced. Only explicitly recognized command codes
// become recoverable UI codes; details/parameters/source PII stay server-only.
function safeCommandFailure(message: string | undefined): never {
  const codes = { SHOPIFY_STALE_REVISION: "STALE_REVISION", SHOPIFY_IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
    SHOPIFY_RELEASE_DISABLED: "RELEASE_DISABLED", SHOPIFY_ACCESS_DENIED: "ACCESS_DENIED",
    SHOPIFY_CONFIGURATION_BUSY: "CONFIGURATION_BUSY" } as const;
  for (const [sql, code] of Object.entries(codes)) if (message === sql) throw new ShopifyIntegrationError(code);
  if (message && /^SHOPIFY_(SOURCE_REVIEW|CUSTOMER_INVALID|MAPPING_INVALID|CONFIGURATION_INVALID|DRAFT_LOCKED|PRIVACY_REVIEW)$/.test(message))
    throw new ShopifyIntegrationError("REVIEW_REQUIRED");
  throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
}
const actor = (value: string) => z.string().min(1).max(256).parse(value);
const id = (value: string) => z.string().uuid().parse(value);
// Dormant server adapter. Resolve actor/tenant from authenticated server context;
// input must be produced by prepareShopifyRelease, never a browser request body.
export function createShopifyReleaseStore(db: Pick<SupabaseClient<Database>, "rpc">) {
  async function send(scope: ShopifyMappingBinding, actorId: string, key: string, sourceOrderId: string, reviewId: string,
    input: ShopifyPreparedRelease, signal: AbortSignal, recoveryOnly: boolean) {
    const binding = shopifyMappingBindingSchema.parse(scope);
    if (signal.aborted) throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
    const { data, error } = await db.rpc("release_shopify_order", { p_tenant_id: binding.tenantId,
      p_connection_id: binding.connectionId, p_actor_id: actor(actorId), p_request_key: id(key), p_source_order_id: id(sourceOrderId),
      p_review_id: id(reviewId), p_input: input, p_recovery_only: recoveryOnly }).abortSignal(signal);
    if (error) safeCommandFailure(error.message);
    if (recoveryOnly && data === null) return null;
    const result = releasedSchema.safeParse(data);
    if (!result.success) throw new ShopifyIntegrationError("RESPONSE_INVALID");
    return result.data;
  }
  return {
    async saveReview(scope: ShopifyMappingBinding, actorId: string, key: string, sourceOrderId: string, sourceRevisionId: string,
      expectedVersion: number, decision: ShopifyReviewDecision, signal: AbortSignal) {
      const binding = shopifyMappingBindingSchema.parse(scope), choices = shopifyReviewDecisionSchema.parse(decision);
      z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1).parse(expectedVersion);
      if (signal.aborted) throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
      const { data, error } = await db.rpc("save_shopify_draft_review", { p_tenant_id: binding.tenantId, p_connection_id: binding.connectionId,
        p_actor_id: actor(actorId), p_request_key: id(key), p_source_order_id: id(sourceOrderId), p_source_revision_id: id(sourceRevisionId),
        p_expected_version: expectedVersion, p_decision: choices }).abortSignal(signal);
      if (error) safeCommandFailure(error.message);
      const result = z.object({ reviewId: z.string().uuid(), version: z.number().int().positive().safe() }).strict().safeParse(data);
      if (!result.success || result.data.version !== expectedVersion + 1) throw new ShopifyIntegrationError("RESPONSE_INVALID");
      return result.data;
    },
    async release(...args: Parameters<typeof send> extends [...infer Args, boolean] ? Args : never) {
      const result = await send(...args, false);
      if (!result) throw new ShopifyIntegrationError("RESPONSE_INVALID");
      return result;
    },
    // Uses original prepared intent and key, before remote revalidation. Null
    // means no committed receipt, not permission to fabricate a fresh source.
    recoverCommittedRelease(...args: Parameters<typeof send> extends [...infer Args, boolean] ? Args : never) {
      return send(...args, true);
    },
  };
}
