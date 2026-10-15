import "server-only";
import { z } from "zod";
import { canonicalShopDomain,SHOPIFY_API_VERSION } from "./config.ts";
import { assertShopifyProbeActor,type ShopifyProbeActor } from "./probe-config.ts";
import { ShopifyIntegrationError } from "./errors.ts";

export function isShopifyApplicationVisible(tenantId:string,env:NodeJS.ProcessEnv=process.env){
  return env.SHOPIFY_CONNECTION_SCREEN_ENABLED==="true" && z.string().uuid().safeParse(tenantId).success
    &&tenantId===env.SHOPIFY_CONNECTION_TEST_TENANT_ID;
}
// Private server configuration. Never serialize this object to a client or log.
// Same-organization pilot, not a global store binding for arbitrary tenants.
export function getShopifyApplicationConfig(actor:ShopifyProbeActor,env:NodeJS.ProcessEnv=process.env,mode:"read"|"operate"="operate"){
  assertShopifyProbeActor(actor);
  if(!isShopifyApplicationVisible(actor.tenantId,env))throw new ShopifyIntegrationError("ACCESS_DENIED");
  if(mode==="operate"&&env.SHOPIFY_PILOT_OPERATIONS_ENABLED!=="true")throw new ShopifyIntegrationError("ACCESS_DENIED");
  if(env.VERCEL_ENV!=="production"||env.SHOPIFY_DEPLOYMENT_ENV!=="production"||env.SHOPIFY_API_VERSION!==SHOPIFY_API_VERSION)
    throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
  let origin:URL;
  try{
    origin=new URL(env.SHOPIFY_APPLICATION_ORIGIN??"");
    if(origin.protocol!=="https:"||origin.username||origin.password||origin.port||origin.pathname!=="/"||origin.search||origin.hash)throw new Error();
  }catch{throw new ShopifyIntegrationError("CONFIGURATION_INVALID");}
  const clientId=env.SHOPIFY_CLIENT_ID??"",clientSecret=env.SHOPIFY_CLIENT_SECRET??"";
  if(!/^[A-Za-z0-9_-]{1,256}$/.test(clientId)||!clientSecret||clientSecret.length>4096||/[\s\x00-\x1f\x7f]/.test(clientSecret))
    throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
  return {tenantId:actor.tenantId,shopDomain:canonicalShopDomain(env.SHOPIFY_SHOP_DOMAIN??""),clientId,clientSecret,
    origin:origin.origin,apiVersion:SHOPIFY_API_VERSION,environment:"production" as const,
    operationsEnabled:env.SHOPIFY_PILOT_OPERATIONS_ENABLED==="true",messagingEnabled:false as const,sourceWritesEnabled:false as const};
}
export type ShopifyApplicationConfig=ReturnType<typeof getShopifyApplicationConfig>;
export function assertShopifyApplicationStage(stage:"copy"|"worker"|"release",env:NodeJS.ProcessEnv=process.env){
  const flags=stage==="release"?["SHOPIFY_RELEASE_ENABLED","SHOPIFY_SYNC_ENABLED","SHOPIFY_HYDRATION_ENABLED","SHOPIFY_PILOT_CREDENTIALS_ENABLED"]:
    stage==="worker"?["SHOPIFY_TEST_COPY_ENABLED","SHOPIFY_SYNC_ENABLED","SHOPIFY_HYDRATION_ENABLED","SHOPIFY_DRAFT_IMPORT_ENABLED","SHOPIFY_EXECUTOR_ENABLED","SHOPIFY_PILOT_CREDENTIALS_ENABLED"]:
      ["SHOPIFY_TEST_COPY_ENABLED"];
  if(flags.some(flag=>env[flag]!=="true"))throw new ShopifyIntegrationError(stage==="release"?"RELEASE_DISABLED":"ACCESS_DENIED");
}
