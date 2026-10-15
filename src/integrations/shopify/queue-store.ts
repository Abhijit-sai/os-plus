import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.ts";
import { ShopifyIntegrationError } from "./errors.ts";

const generation = z.number().int().positive().safe();
const bindingSchema = z.object({
  tenantId: z.string().uuid(), connectionId: z.string().uuid(),
  environment: z.enum(["production", "development"]), appRef: z.string().regex(/^[A-Za-z0-9_-]{1,256}$/),
}).strict();
export const shopifyJobLeaseSchema = z.object({
  jobId: z.string().uuid(), tenantId: z.string().uuid(), connectionId: z.string().uuid(),
  orderGid: z.string().regex(/^gid:\/\/shopify\/Order\/[1-9][0-9]{0,31}$/),
  generation, connectionRevision: generation, leaseToken: z.string().uuid(), leaseExpiresAt: z.string().datetime({ offset: true }),
}).strict();
const errorCodeSchema = z.enum(["TRANSIENT", "THROTTLED", "AUTH_REQUIRED", "SCOPE_REQUIRED", "VALIDATION_REQUIRED"]);
export type ShopifyQueueBinding = z.infer<typeof bindingSchema>;
export type ShopifyJobLease = z.infer<typeof shopifyJobLeaseSchema>;
export type ShopifyJobFailureCode = z.infer<typeof errorCodeSchema>;

// Trusted service client + server-resolved binding only. No route/scheduler in
// this slice. A future executor must enforce deployment/secrets/privacy gates.
export function createShopifyQueueStore(db: Pick<SupabaseClient<Database>, "rpc">) {
  return {
    async claim(binding: ShopifyQueueBinding, limit: number, signal: AbortSignal): Promise<ShopifyJobLease[]> {
      const input = bindingSchema.parse(binding);
      z.number().int().min(1).max(10).parse(limit);
      const { data, error } = await db.rpc("claim_shopify_jobs", {
        p_tenant_id: input.tenantId, p_connection_id: input.connectionId,
        p_environment: input.environment, p_app_ref: input.appRef, p_limit: limit,
      }).abortSignal(signal);
      if (error) throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
      const parsed = z.array(shopifyJobLeaseSchema).max(limit).safeParse(data);
      if (!parsed.success || parsed.data.some(job => job.tenantId !== input.tenantId || job.connectionId !== input.connectionId) ||
        new Set(parsed.data.map(job => job.jobId)).size !== parsed.data.length ||
        new Set(parsed.data.map(job => job.leaseToken)).size !== parsed.data.length) {
        throw new ShopifyIntegrationError("RESPONSE_INVALID");
      }
      return parsed.data;
    },
    async update(binding: ShopifyQueueBinding, lease: ShopifyJobLease, action: "renew" | "fail",
      code: ShopifyJobFailureCode | null, retryAfterSeconds: number | null, signal: AbortSignal): Promise<boolean> {
      const input = bindingSchema.parse(binding); const job = shopifyJobLeaseSchema.parse(lease);
      z.enum(["renew", "fail"]).parse(action);
      if (job.tenantId !== input.tenantId || job.connectionId !== input.connectionId ||
        (action === "renew" && (code !== null || retryAfterSeconds !== null)) ||
        (action === "fail" && !errorCodeSchema.safeParse(code).success) ||
        (retryAfterSeconds !== null && (code !== "THROTTLED" || !z.number().int().min(1).max(86400).safeParse(retryAfterSeconds).success))) {
        throw new ShopifyIntegrationError("ACCESS_DENIED");
      }
      const { data, error } = await db.rpc("update_shopify_job_lease", {
        p_tenant_id: input.tenantId, p_connection_id: input.connectionId, p_environment: input.environment, p_app_ref: input.appRef,
        p_job_id: job.jobId, p_lease_token: job.leaseToken, p_generation: job.generation, p_connection_revision: job.connectionRevision,
        p_action: action, p_error_code: code, p_retry_after_seconds: retryAfterSeconds,
      }).abortSignal(signal);
      if (error) throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
      if (typeof data !== "boolean") throw new ShopifyIntegrationError("RESPONSE_INVALID");
      return data;
    },
  };
}
