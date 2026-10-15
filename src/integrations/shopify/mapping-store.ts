import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.ts";
import { ShopifyIntegrationError } from "./errors.ts";
import { shopifyMappingBindingSchema, shopifyMappingCommandSchema, type ShopifyMappingBinding, type ShopifyMappingCommand } from "./mapping.ts";

// Caller must construct actor identity from authenticated server context.
// No public route or tenant-supplied authority in this dormant adapter.
export function createShopifyMappingStore(db: Pick<SupabaseClient<Database>, "rpc">) {
  return {
    async save(binding: ShopifyMappingBinding, actorId: string, requestKey: string, command: ShopifyMappingCommand, signal: AbortSignal) {
      const scope = shopifyMappingBindingSchema.parse(binding);
      z.string().min(1).max(256).parse(actorId); z.string().uuid().parse(requestKey);
      const input = shopifyMappingCommandSchema.parse(command);
      const {data,error} = await db.rpc("save_shopify_mapping", {
        p_tenant_id: scope.tenantId, p_connection_id: scope.connectionId, p_actor_id: actorId,
        p_request_key: requestKey, p_input: input,
      }).abortSignal(signal);
      if (error) throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
      const result = z.object({mappingId:z.string().uuid(),revision:z.number().int().positive().safe()}).strict().safeParse(data);
      if (!result.success || (input.mappingId !== null && result.data.mappingId !== input.mappingId) || result.data.revision !== input.expectedRevision+1)
        throw new ShopifyIntegrationError("RESPONSE_INVALID");
      return result.data;
    },
  };
}
