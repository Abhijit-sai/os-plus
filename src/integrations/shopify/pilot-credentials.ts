import "server-only";
import { z } from "zod";
import { assertShopifyHydrationContext, type ShopifyHydrationContext } from "./hydration-contract.ts";
import { canonicalShopDomain } from "./config.ts";
import { createShopifyTokenProvider } from "./client-credentials.ts";
import { ShopifyIntegrationError } from "./errors.ts";

// Same-organization pilot only, NOT generic tenant OAuth. Every other store or
// tenant fails before token acquisition. DB context is supplied by worker-context.
export function createShopifyPilotCredentialReader(transport:typeof fetch=fetch,now=Date.now) {
  const tokens=createShopifyTokenProvider(transport,now);
  return async (context:ShopifyHydrationContext,signal:AbortSignal,env:NodeJS.ProcessEnv=process.env) => {
    assertShopifyHydrationContext(context,env);
    if(signal.aborted || env.SHOPIFY_PILOT_CREDENTIALS_ENABLED!=="true" ||
      context.tenantId!==env.SHOPIFY_CONNECTION_TEST_TENANT_ID || context.appRef!==env.SHOPIFY_CLIENT_ID ||
      context.shopDomain!==canonicalShopDomain(env.SHOPIFY_SHOP_DOMAIN??""))
      throw new ShopifyIntegrationError("ACCESS_DENIED");
    const clientId=z.string().regex(/^[A-Za-z0-9_-]{1,256}$/).safeParse(env.SHOPIFY_CLIENT_ID);
    const secret=z.string().min(1).max(4096).regex(/^[^\s\x00-\x1f\x7f]+$/).safeParse(env.SHOPIFY_CLIENT_SECRET);
    if(!clientId.success || !secret.success) throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
    const config={tenantId:context.tenantId,shopDomain:context.shopDomain,clientId:clientId.data,clientSecret:secret.data};
    let rejectAbort:(reason:ShopifyIntegrationError)=>void=()=>{};
    const aborted=new Promise<never>((_,reject)=>{rejectAbort=reject;});
    const onAbort=()=>rejectAbort(new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE"));
    signal.addEventListener("abort",onAbort,{once:true});
    try {
      const lease=await Promise.race([tokens.getTokenLease(config),aborted]);
      if(signal.aborted || Date.parse(lease.expiresAt)<=now()+45000) throw new ShopifyIntegrationError("AUTHENTICATION_REQUIRED");
      return {tenantId:context.tenantId,connectionId:context.connectionId,shopGid:context.shopGid,appRef:context.appRef,
        environment:context.environment,connectionRevision:context.revision,expiresAt:lease.expiresAt,accessToken:lease.accessToken};
    } catch(error) {
      if(error instanceof ShopifyIntegrationError && error.code==="AUTHENTICATION_REQUIRED") tokens.invalidate();
      if(error instanceof ShopifyIntegrationError) throw error;
      throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
    } finally {signal.removeEventListener("abort",onAbort);}
  };
}
