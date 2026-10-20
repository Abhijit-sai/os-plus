import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.ts";
import type { ShopifyProbeActor } from "./probe-config.ts";
import type { createShopifyImportPreviewReader } from "./import-preview.ts";
import { getShopifyApplicationConfig } from "./application-config.ts";
import { normalizeShopifyReference } from "./import-plan.ts";
import { ShopifyIntegrationError } from "./errors.ts";

const matchSchema = z.object({ orderGid: z.string(),
  status: z.enum(["new", "already_imported", "reference_match", "conflict"]),
  orderIds: z.array(z.string().uuid()),
}).strict();

// This builds an advisory preview only, not an import receipt. The commit path
// must persist/fence the selected source IDs and re-check reference matches in
// its transaction; never accept these returned classifications from a browser.
export function createShopifyImportPreviewService(db: Pick<SupabaseClient<Database>, "rpc">,
  readSource: ReturnType<typeof createShopifyImportPreviewReader>) {
  return async (actor: ShopifyProbeActor, binding: { connectionId: string; shopGid: string }, range: unknown,
    signal: AbortSignal, env: NodeJS.ProcessEnv = process.env) => {
    const config = getShopifyApplicationConfig(actor, env);
    z.string().uuid().parse(binding.connectionId);
    z.string().regex(/^gid:\/\/shopify\/Shop\/[1-9][0-9]{0,31}$/).parse(binding.shopGid);
    const matches = async (orders: Array<{ orderGid: string; reference: string }>) => {
      const { data, error } = await db.rpc("preview_shopify_order_matches", {
        p_tenant_id: actor.tenantId, p_connection_id: binding.connectionId, p_actor_id: actor.userId,
        p_domain: config.shopDomain, p_app_ref: config.clientId, p_shop_gid: binding.shopGid, p_orders: orders,
      }).abortSignal(signal);
      if (error) throw new ShopifyIntegrationError(error.message === "SHOPIFY_ACCESS_DENIED" ? "ACCESS_DENIED" : "UPSTREAM_UNAVAILABLE");
      const rows = z.array(matchSchema).parse(data);
      if (rows.length !== orders.length || rows.some((row, index) => row.orderGid !== orders[index].orderGid))
        throw new ShopifyIntegrationError("RESPONSE_INVALID");
      return rows;
    };
    // Current DB membership/store/privacy are checked before using credentials,
    // not merely the actor object captured when the settings page was rendered.
    await matches([]);
    const preview = await readSource(actor, binding.shopGid, range, signal, env);
    const results: z.infer<typeof matchSchema>[] = [];
    for (let offset = 0; offset < preview.rows.length; offset += 100)
      results.push(...await matches(preview.rows.slice(offset, offset + 100).map(({ orderGid, reference }) => ({ orderGid, reference }))));
    if (!preview.rows.length) await matches([]);
    const references = new Map<string, number>();
    for (const row of preview.rows) {
      const key = normalizeShopifyReference(row.reference);
      if (key) references.set(key, (references.get(key) ?? 0) + 1);
    }
    const rows = preview.rows.map((row, index) => {
      const match = results[index], key = normalizeShopifyReference(row.reference);
      // Two incoming orders can themselves clash even when neither is stored
      // locally yet. Keep both visible; don't choose one by page/arrival order.
      const incomingConflict = key !== null && (references.get(key) ?? 0) > 1 && match.status !== "already_imported";
      return { ...row, status: incomingConflict ? "conflict" as const : match.status,
        orderIds: match.orderIds, incomingReferenceConflict: incomingConflict };
    });
    const counts = { new: 0, already_imported: 0, reference_match: 0, conflict: 0 };
    for (const row of rows) counts[row.status]++;
    return { ...preview, rows, counts };
  };
}
