import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.ts";
import { assertShopifyProbeActor, getShopifyProbeConfig, type ShopifyProbeActor } from "./probe-config.ts";
import { ShopifyIntegrationError } from "./errors.ts";

const connectionSchema=z.object({tenant_id:z.string().uuid(),canonical_domain:z.string(),
  status:z.enum(["pending","verified","paused","disconnected"]),revision:z.number().int().positive().safe(),
  intake_enabled:z.boolean(),processing_enabled:z.boolean(),draft_import_enabled:z.boolean(),release_enabled:z.boolean()}).strict();
export type ShopifyConnectionScreen={
  availability:"configuration_pending"|"database_pending"|"not_connected"|"available"|"unavailable";
  shopDomain:string|null;
  canCheckAccess:boolean;
  connection:{status:z.infer<typeof connectionSchema>["status"];revision:number;intakeEnabled:boolean;
    processingEnabled:boolean;draftImportEnabled:boolean;releaseEnabled:boolean}|null;
};

// Server-side pilot gate. Environment values are never browser-selected bindings.
export function isShopifyConnectionScreenEnabled(tenantId:string,env:NodeJS.ProcessEnv=process.env){
  return env.SHOPIFY_CONNECTION_SCREEN_ENABLED==="true" && z.string().uuid().safeParse(tenantId).success &&
    tenantId===env.SHOPIFY_CONNECTION_TEST_TENANT_ID;
}

export async function getShopifyConnectionScreen(db:Pick<SupabaseClient<Database>,"from">,
  actor:ShopifyProbeActor,env:NodeJS.ProcessEnv=process.env):Promise<ShopifyConnectionScreen>{
  assertShopifyProbeActor(actor);
  if(!isShopifyConnectionScreenEnabled(actor.tenantId,env))throw new ShopifyIntegrationError("ACCESS_DENIED");
  const state:ShopifyConnectionScreen={availability:"configuration_pending",shopDomain:null,canCheckAccess:false,connection:null};
  let config;
  try{config=getShopifyProbeConfig(actor,env);}catch(error){
    if(error instanceof ShopifyIntegrationError && error.code==="ACCESS_DENIED")throw error;
    return state;
  }
  state.shopDomain=config.shopDomain;state.canCheckAccess=true;
  try{
    const {data,error}=await db.from("shopify_connections")
      .select("tenant_id,canonical_domain,status,revision,intake_enabled,processing_enabled,draft_import_enabled,release_enabled")
      .eq("tenant_id",actor.tenantId).eq("app_ref",config.clientId).eq("canonical_domain",config.shopDomain)
      .eq("environment","production").limit(2).abortSignal(AbortSignal.timeout(4000));
    if(error){state.availability=["PGRST205","PGRST204","42P01","42703"].includes(error.code)?"database_pending":"unavailable";return state;}
    const rows=z.array(connectionSchema).max(1).safeParse(data);
    if(!rows.success){state.availability="unavailable";return state;}
    if(rows.data.length===0){state.availability="not_connected";return state;}
    const row=rows.data[0];
    if(row.tenant_id!==actor.tenantId || row.canonical_domain!==config.shopDomain){state.availability="unavailable";return state;}
    state.availability="available";
    state.connection={status:row.status,revision:row.revision,intakeEnabled:row.intake_enabled,
      processingEnabled:row.processing_enabled,draftImportEnabled:row.draft_import_enabled,releaseEnabled:row.release_enabled};
    return state;
  }catch{return {...state,availability:"unavailable",connection:null};}
}
