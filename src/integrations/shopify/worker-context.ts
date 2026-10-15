import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.ts";
import { hydrationContextSchema, type ShopifyHydrationContext } from "./hydration-contract.ts";
import { canonicalShopDomain } from "./config.ts";
import { ShopifyIntegrationError } from "./errors.ts";

const bindingSchema=z.object({tenantId:z.string().uuid(),connectionId:z.string().uuid(),
  appRef:z.string().regex(/^[A-Za-z0-9_-]{1,256}$/),environment:z.literal("production")}).strict();
const timestamp=z.string().datetime({offset:true});
const rowSchema=z.object({id:z.string().uuid(),tenant_id:z.string().uuid(),shop_gid:z.string(),canonical_domain:z.string(),
  app_ref:z.string(),environment:z.literal("production"),api_version:z.literal("2026-10"),status:z.literal("verified"),
  revision:z.number().int().positive().safe(),intake_enabled:z.literal(true),processing_enabled:z.literal(true),
  draft_import_enabled:z.literal(true),verified_at:timestamp,scopes_verified_at:timestamp,
  protected_customer_fields_verified_at:timestamp,source_copy_authorized_at:timestamp,import_created_at_cutoff:timestamp,
  tenants:z.object({id:z.string().uuid(),status:z.literal("active")}).strict()}).strict();

// Trusted service adapter only. Actor authorization belongs to the authenticated
// command initiating work; background work additionally rechecks the installation.
// Do not construct a hydration context from a request body or cached env tenant.
export async function readShopifyWorkerContext(db:Pick<SupabaseClient<Database>,"from">,
  binding:z.infer<typeof bindingSchema>,signal:AbortSignal):Promise<ShopifyHydrationContext> {
  const input=bindingSchema.safeParse(binding);
  if(!input.success || signal.aborted) throw new ShopifyIntegrationError("ACCESS_DENIED");
  const scope=input.data;
  let raw:unknown;
  try {
    const {data,error}=await db.from("shopify_connections")
      .select("id,tenant_id,shop_gid,canonical_domain,app_ref,environment,api_version,status,revision,intake_enabled,processing_enabled,draft_import_enabled,verified_at,scopes_verified_at,protected_customer_fields_verified_at,source_copy_authorized_at,import_created_at_cutoff,tenants!shopify_connections_tenant_id_fkey!inner(id,status)")
      .eq("tenant_id",scope.tenantId).eq("id",scope.connectionId).eq("app_ref",scope.appRef)
      .eq("environment",scope.environment).limit(2).abortSignal(signal);
    if(error) throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
    const rows=z.array(rowSchema).length(1).safeParse(data);
    if(!rows.success) throw new ShopifyIntegrationError("ACCESS_DENIED");
    raw=rows.data[0];
  } catch(error) {
    if(error instanceof ShopifyIntegrationError) throw error;
    throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
  }
  const row=rowSchema.parse(raw);
  if(signal.aborted || row.tenant_id!==scope.tenantId || row.tenants.id!==scope.tenantId ||
    row.id!==scope.connectionId || row.app_ref!==scope.appRef || canonicalShopDomain(row.canonical_domain)!==row.canonical_domain)
    throw new ShopifyIntegrationError("ACCESS_DENIED");
  const parsed=hydrationContextSchema.safeParse({tenantId:row.tenant_id,connectionId:row.id,shopGid:row.shop_gid,
    shopDomain:row.canonical_domain,appRef:row.app_ref,environment:row.environment,apiVersion:row.api_version,
    revision:row.revision,status:row.status,tenantStatus:row.tenants.status,intakeEnabled:row.intake_enabled,
    processingEnabled:row.processing_enabled,requiredScopesVerified:true,protectedCustomerFieldsVerified:true,
    importCreatedAtCutoff:row.import_created_at_cutoff});
  if(!parsed.success) throw new ShopifyIntegrationError("ACCESS_DENIED");
  return parsed.data;
}
