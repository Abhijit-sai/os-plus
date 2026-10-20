import "server-only";
import { z } from "zod";
import { createShopifyTokenProvider } from "./client-credentials.ts";
import { readShopifyApplicationGraphQL,createShopifyApplicationWebhook,configureShopifyUnifiedWebhook } from "./client.ts";
import { getShopifyApplicationConfig,assertShopifyApplicationStage } from "./application-config.ts";
import type { ShopifyProbeActor } from "./probe-config.ts";
import { ShopifyIntegrationError } from "./errors.ts";

const topics=["ORDERS_CREATE","ORDERS_UPDATED","ORDERS_CANCELLED"] as const;
const node=z.object({id:z.string().regex(/^gid:\/\/shopify\/WebhookSubscription\/[1-9][0-9]*$/),topic:z.enum(topics),
  uri:z.string(),filter:z.string().nullable(),format:z.string(),includeFields:z.array(z.string()),apiVersion:z.object({handle:z.string()})});
const pageSchema=z.object({shop:z.object({id:z.string(),myshopifyDomain:z.string()}),
  currentAppInstallation:z.object({app:z.object({apiKey:z.string(),webhookApiVersion:z.string()})}),
  webhookSubscriptions:z.object({nodes:z.array(node).max(100),pageInfo:z.object({hasNextPage:z.boolean(),endCursor:z.string().nullable()})})});
const createSchema=z.object({webhookSubscriptionCreate:z.object({webhookSubscription:node.nullable(),userErrors:z.array(z.object({field:z.array(z.string()).nullable(),message:z.string()}))})});
type Binding={connectionId:string;shopGid:string;orderGid:string;expiresAt:string};
type UnifiedBinding={connectionId:string;shopGid:string;revision:number;pilotOrderGid:string|null};

export async function registerShopifyUnifiedWebhooks(actor:ShopifyProbeActor,expected:UnifiedBinding,checkBinding:()=>Promise<UnifiedBinding>,
  signal:AbortSignal,env:NodeJS.ProcessEnv=process.env,transport:typeof fetch=fetch,now=Date.now){
  const config=assertWebhookRuntime(actor,env);
  if(env.SHOPIFY_UNIFIED_ORDERS_ENABLED!=="true")throw new ShopifyIntegrationError("ACCESS_DENIED");
  const check=async()=>{signal.throwIfAborted();if(JSON.stringify(await checkBinding())!==JSON.stringify(expected))throw new ShopifyIntegrationError("STALE_REVISION");};
  await check();
  const token=await createShopifyTokenProvider(transport,now).getToken(config);
  const base={shopDomain:config.shopDomain,connectionEnvironment:"production" as const,accessToken:token,signal,timeoutMs:8000};
  const target=`${config.origin}/api/integrations/shopify/orders-webhook`,fields=["admin_graphql_api_id","id","updated_at"];
  const safe=(row:z.infer<typeof node>)=>row.uri===target&&row.format==="JSON"&&row.apiVersion.handle==="2026-10"&&JSON.stringify([...row.includeFields].sort())===JSON.stringify(fields);
  const ready=(row:z.infer<typeof node>)=>safe(row)&&(row.filter===null||row.filter==="");
  async function list(){
    const rows:z.infer<typeof node>[]=[],seen=new Set<string>(),cursors=new Set<string>();let cursor:string|null=null;
    for(let page=0;page<5;page++){
      await check();
      const response:{data:z.infer<typeof pageSchema>}=await readShopifyApplicationGraphQL({...base,schema:pageSchema,variables:{after:cursor},query:`query OSPlusUnifiedWebhooks($after: String) {
        shop { id myshopifyDomain } currentAppInstallation { app { apiKey webhookApiVersion } }
        webhookSubscriptions(first: 100, after: $after, topics: [ORDERS_CREATE, ORDERS_UPDATED, ORDERS_CANCELLED]) {
          nodes { id topic uri filter format includeFields apiVersion { handle } } pageInfo { hasNextPage endCursor }
        }
      }`},actor,transport,env);
      const data=response.data;
      if(data.shop.id!==expected.shopGid||data.shop.myshopifyDomain!==config.shopDomain||data.currentAppInstallation.app.apiKey!==config.clientId)throw new ShopifyIntegrationError("ACCESS_DENIED");
      if(data.currentAppInstallation.app.webhookApiVersion!=="2026-10")throw new ShopifyIntegrationError("WEBHOOK_CONFIGURATION_CONFLICT");
      for(const row of data.webhookSubscriptions.nodes){if(seen.has(row.id))throw new ShopifyIntegrationError("RESPONSE_INVALID");seen.add(row.id);rows.push(row);}
      const info=data.webhookSubscriptions.pageInfo;if(!info.hasNextPage)return rows;
      if(!info.endCursor||cursors.has(info.endCursor))throw new ShopifyIntegrationError("RESPONSE_INVALID");cursor=info.endCursor;cursors.add(cursor);
    }throw new ShopifyIntegrationError("WEBHOOK_CONFIGURATION_CONFLICT");
  }
  const rows=await list();
  // Validate the complete set before ANY mutation. Never replace an unknown
  // integration, endpoint or filter, and never delete another subscription.
  for(const topic of topics){const selected=rows.filter(row=>row.topic===topic);
    if(selected.length>1||selected.some(row=>!ready(row)&&!(safe(row)&&expected.pilotOrderGid&&row.filter===`id:${expected.pilotOrderGid.split("/").at(-1)}`)))
      throw new ShopifyIntegrationError("WEBHOOK_CONFIGURATION_CONFLICT");}
  const updateSchema=z.object({webhookSubscriptionUpdate:createSchema.shape.webhookSubscriptionCreate});
  for(const topic of topics){
    const existing=rows.find(row=>row.topic===topic);if(existing&&ready(existing))continue;
    await check();
    if(existing){const response=await configureShopifyUnifiedWebhook({...base,topic,subscriptionId:existing.id,schema:updateSchema},actor,transport,env);
      const result=response.data.webhookSubscriptionUpdate;
      if(result.userErrors.length||!result.webhookSubscription||result.webhookSubscription.id!==existing.id||result.webhookSubscription.topic!==topic||!ready(result.webhookSubscription))throw new ShopifyIntegrationError("WEBHOOK_SETUP_UNCONFIRMED");
    }else{const response=await configureShopifyUnifiedWebhook({...base,topic,subscriptionId:null,schema:createSchema},actor,transport,env);
      const result=response.data.webhookSubscriptionCreate;
      if(result.userErrors.length||!result.webhookSubscription||result.webhookSubscription.topic!==topic||!ready(result.webhookSubscription))throw new ShopifyIntegrationError("WEBHOOK_SETUP_UNCONFIRMED");}
  }
  const verified=await list();
  for(const topic of topics){const selected=verified.filter(row=>row.topic===topic);if(selected.length!==1||!ready(selected[0]))throw new ShopifyIntegrationError("WEBHOOK_SETUP_UNCONFIRMED");}
  return {verifiedAt:new Date(now()).toISOString()};
}

export function assertWebhookRuntime(actor:ShopifyProbeActor,env:NodeJS.ProcessEnv){
  const config=getShopifyApplicationConfig(actor,env);
  assertShopifyApplicationStage("worker",env);
  if(env.SHOPIFY_INTAKE_ENABLED!=="true"||env.SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED!=="true")throw new ShopifyIntegrationError("INTAKE_DISABLED");
  if(env.SHOPIFY_WEBHOOK_SIGNING_SECRET!==undefined&&env.SHOPIFY_WEBHOOK_SIGNING_SECRET!==config.clientSecret)
    throw new ShopifyIntegrationError("WEBHOOK_SIGNING_MISMATCH");
  return config;
}

// checkBinding re-reads current membership/connection/policy before each request.
// No credentials, raw GraphQL errors, customer payloads or endpoint choices leave server.
export async function registerShopifyPilotWebhooks(actor:ShopifyProbeActor,expected:Binding,checkBinding:()=>Promise<Binding>,
  signal:AbortSignal,env:NodeJS.ProcessEnv=process.env,transport:typeof fetch=fetch,now=Date.now,createMissing=true){
  const config=assertWebhookRuntime(actor,env);
  if(!/^gid:\/\/shopify\/Order\/[1-9][0-9]{0,31}$/.test(expected.orderGid)||!Number.isFinite(Date.parse(expected.expiresAt)))
    throw new ShopifyIntegrationError("REQUEST_INVALID");
  const check=async()=>{
    signal.throwIfAborted();const current=await checkBinding();
    if(JSON.stringify(current)!==JSON.stringify(expected)||Date.parse(current.expiresAt)<=now())throw new ShopifyIntegrationError("REVIEW_REQUIRED");
  };
  await check();
  const token=await createShopifyTokenProvider(transport,now).getToken(config);
  const base={shopDomain:config.shopDomain,connectionEnvironment:"production" as const,accessToken:token,signal,timeoutMs:8000};
  const target=`${config.origin}/api/integrations/shopify/orders-webhook`,filter=`id:${expected.orderGid.split("/").at(-1)}`;
  const fields=["admin_graphql_api_id","id","updated_at"];
  const matches=(n:z.infer<typeof node>)=>n.uri===target&&n.filter===filter&&n.format==="JSON"&&n.apiVersion.handle==="2026-10"&&
    JSON.stringify([...n.includeFields].sort())===JSON.stringify(fields);
  async function list(){
    const found:z.infer<typeof node>[]=[],seen=new Set<string>();let cursor:string|null=null;
    for(let page=0;page<5;page++){
      await check();
      const response:{data:z.infer<typeof pageSchema>}=await readShopifyApplicationGraphQL({...base,schema:pageSchema,variables:{after:cursor},query:`query OSPlusPilotWebhooks($after: String) {
        shop { id myshopifyDomain } currentAppInstallation { app { apiKey webhookApiVersion } }
        webhookSubscriptions(first: 100, after: $after, topics: [ORDERS_CREATE, ORDERS_UPDATED, ORDERS_CANCELLED]) {
          nodes { id topic uri filter format includeFields apiVersion { handle } } pageInfo { hasNextPage endCursor }
        }
      }`},actor,transport,env);
      const data=response.data;
      if(data.shop.id!==expected.shopGid||data.shop.myshopifyDomain!==config.shopDomain||data.currentAppInstallation.app.apiKey!==config.clientId)
        throw new ShopifyIntegrationError("ACCESS_DENIED");
      if(data.currentAppInstallation.app.webhookApiVersion!=="2026-10")throw new ShopifyIntegrationError("WEBHOOK_CONFIGURATION_CONFLICT");
      for(const row of data.webhookSubscriptions.nodes){if(seen.has(row.id))throw new ShopifyIntegrationError("RESPONSE_INVALID");seen.add(row.id);found.push(row);}
      const info=data.webhookSubscriptions.pageInfo;
      if(!info.hasNextPage)return found;
      if(!info.endCursor||info.endCursor===cursor)throw new ShopifyIntegrationError("RESPONSE_INVALID");cursor=info.endCursor;
    }
    throw new ShopifyIntegrationError("WEBHOOK_CONFIGURATION_CONFLICT");
  }
  const inspect=(rows:z.infer<typeof node>[])=>topics.filter(topic=>{
    const selected=rows.filter(n=>n.topic===topic);
    if(selected.length>1||selected.some(n=>!matches(n)))throw new ShopifyIntegrationError("WEBHOOK_CONFIGURATION_CONFLICT");
    return selected.length===0;
  });
  let missing=inspect(await list());
  if(missing.length&&!createMissing)throw new ShopifyIntegrationError("WEBHOOK_SETUP_REQUIRED");
  let created=0;
  for(const topic of missing){
    await check();
    const response=await createShopifyApplicationWebhook({...base,topic,orderGid:expected.orderGid,schema:createSchema},actor,transport,env);
    const result=response.data.webhookSubscriptionCreate;
    // Unknown/partial completion is retryable: next invocation lists again,
    // never blindly replays a mutation or deletes an existing subscription.
    if(result.userErrors.length||!result.webhookSubscription||result.webhookSubscription.topic!==topic||!matches(result.webhookSubscription))
      throw new ShopifyIntegrationError("WEBHOOK_SETUP_UNCONFIRMED");
    created++;
  }
  missing=inspect(await list());if(missing.length)throw new ShopifyIntegrationError("WEBHOOK_SETUP_UNCONFIRMED");
  return {status:"webhooks_ready",created,verified:topics.length};
}
