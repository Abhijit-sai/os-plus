import { notFound } from "next/navigation";
import { ShopifyConnectionPanel } from "@/components/settings/shopify-connection-panel";
import { getShopifyProbeActor } from "@/integrations/shopify/probe-actor";
import { getShopifyConnectionScreen, isShopifyConnectionScreenEnabled } from "@/integrations/shopify/connection-screen";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getShopifyApplicationConfig } from "@/integrations/shopify/application-config";
import { createShopifyApplicationService } from "@/integrations/shopify/application-service";
import { createShopifyApplicationSource } from "@/integrations/shopify/application-source";
import { runShopifyPilotWorker } from "@/integrations/shopify/application-worker";
import { ShopifyWorkspace } from "@/components/settings/shopify-workspace";
import { shopifyApplicationAction } from "./actions";
import type { ShopifyApplicationView } from "@/integrations/shopify/application-view";
import { ShopifySimpleSetup } from "@/components/settings/shopify-simple-setup";
import {shopifyUnifiedAction} from "./unified-actions";
import { createShopifyUnifiedService } from "@/integrations/shopify/unified-service";
import { currentShopifyIndiaDate } from "@/integrations/shopify/import-presentation";
import type { UnifiedWorkspace } from "@/integrations/shopify/unified-contract";
import {readShopifyTenantConnection,resolveShopifyTenantEnvironment} from "@/integrations/shopify/tenant-credentials";
import {getShopifyOAuthConfig} from "@/integrations/shopify/oauth";

import {shopifyTenantLinkingEnabled} from "@/integrations/shopify/tenant-rollout";

export const dynamic="force-dynamic";
export const maxDuration=60;
export default async function ShopifySettingsPage({searchParams}:{searchParams:Promise<{customerSearch?:string;connection?:string}>}){
  if(process.env.SHOPIFY_CONNECTION_SCREEN_ENABLED!=="true")notFound();
  const actor=await getShopifyProbeActor();
  if(!actor || actor.role!=="owner_admin" || !isShopifyConnectionScreenEnabled(actor.tenantId))notFound();
  if(process.env.SHOPIFY_UNIFIED_ORDERS_ENABLED==="true"){
    const params=await searchParams;
    let unified:UnifiedWorkspace|null=null,shopDomain="",retired=false;
    let approval:{hasCredential:boolean;automaticAvailable?:boolean;result?:string}|undefined;
    try{
      const db=createSupabaseServiceRoleClient(),signal=AbortSignal.timeout(6000);
      let needsApproval=false;
      if(process.env.SHOPIFY_OAUTH_ENABLED==="true"){
        getShopifyOAuthConfig(actor,process.env);
        const binding=await readShopifyTenantConnection(db,actor.tenantId,actor.userId,signal);
        approval={hasCredential:binding?.hasCredential??false,automaticAvailable:shopifyTenantLinkingEnabled(process.env)&&!!binding?.hasCredential,result:params.connection==="approved"||params.connection==="failed"?params.connection:undefined};
        retired=binding?.retired??false;
        shopDomain=binding?.shopDomain??"";
        needsApproval=!binding || (!binding.hasCredential && actor.tenantId!==process.env.SHOPIFY_CONNECTION_TEST_TENANT_ID);
      }
      if(retired||needsApproval){
        unified={connection:null,workerConfigured:false};
      }else{
        const env=await resolveShopifyTenantEnvironment(db,actor.tenantId,actor.userId,signal);
        const config=getShopifyApplicationConfig(actor,env);shopDomain=config.shopDomain;
        unified=await createShopifyUnifiedService(db).view(actor,signal,env);
      }
    }catch{ /* Never render raw configuration or SQL errors. */ }
    if(retired)return <div className="rounded-lg border p-5">
      <h1 className="text-xl font-semibold">Shopify connection retired</h1>
      <p>This business retains its imported order history. Open Orders to view it.</p>
    </div>;
    if(!unified)return <div role="alert" className="rounded-lg border p-5"><h1 className="text-xl font-semibold">Shopify setup is unavailable</h1>
      <p>Nothing was imported. The administrator needs to verify the Shopify app configuration and database connection.</p></div>;
    return <ShopifySimpleSetup key={actor.tenantId} initial={unified} shopDomain={shopDomain} today={currentShopifyIndiaDate()} submitAction={shopifyUnifiedAction} approval={approval}/>;
  }
  if(process.env.SHOPIFY_PILOT_OPERATIONS_ENABLED==="true"){
    let view:ShopifyApplicationView|null=null;
    try{
      getShopifyApplicationConfig(actor);
      const db=createSupabaseServiceRoleClient(),params=await searchParams;
      const service=createShopifyApplicationService(db,createShopifyApplicationSource(),(id,signal,env)=>runShopifyPilotWorker(db,id,signal,env));
      view=await service.view(actor,AbortSignal.timeout(6000),process.env,typeof params.customerSearch==="string"?params.customerSearch:"");
    }catch{ /* Safe generic status below. Never serialize SQL or source errors. */ }
    if(!view)return <div role="alert" className="rounded-lg border p-5"><h2 className="text-xl font-semibold">Shopify pilot is not ready</h2>
        <p className="mt-2 text-sm text-muted-foreground">The approved schema or private configuration is missing, or the data could not be verified. No import was started. Ask the administrator to check the readiness report.</p></div>;
    return <ShopifyWorkspace key={actor.tenantId} view={view} action={shopifyApplicationAction}/>;
  }
  const state=await getShopifyConnectionScreen(createSupabaseServiceRoleClient(),actor);
  return <div className="space-y-5"><div><h2 className="text-2xl font-semibold tracking-tight">Shopify connection</h2>
    <p className="text-muted-foreground">Read-only setup checks for this Test tenant. No automatic imports.</p></div>
    <ShopifyConnectionPanel key={actor.tenantId+":"+state.shopDomain} state={state} tenantId={actor.tenantId}/>
  </div>;
}
