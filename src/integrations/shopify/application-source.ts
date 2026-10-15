import "server-only";
import { z } from "zod";
import { createShopifyTokenProvider } from "./client-credentials.ts";
import { readShopifyApplicationGraphQL } from "./client.ts";
import { getShopifyApplicationConfig } from "./application-config.ts";
import type { ShopifyProbeActor } from "./probe-config.ts";
import { ShopifyIntegrationError } from "./errors.ts";

const gid=(kind:string)=>z.string().regex(new RegExp(`^gid://shopify/${kind}/[1-9][0-9]{0,31}$`));
const metadataSchema=z.object({shop:z.object({id:gid("Shop"),myshopifyDomain:z.string()}),
  currentAppInstallation:z.object({accessScopes:z.array(z.object({handle:z.string()})).max(512)})});
const text=z.string().max(2048).nullable();
const address=z.object({firstName:text,lastName:text,phone:text,address1:text,address2:text,city:text,province:text,countryCodeV2:text,zip:text}).nullable();
const orderSchema=z.object({id:gid("Order"),createdAt:z.string().datetime({offset:true}),updatedAt:z.string().datetime({offset:true}),
  email:text,phone:text,customer:z.object({id:gid("Customer"),firstName:text,lastName:text,email:text,phone:text}).nullable(),
  shippingAddress:address,billingAddress:address}).nullable();

// Fixed queries only. Protected fields are deliberately queried to prove actual
// access, but the response is discarded: a scope name alone is not attestation.
export function createShopifyApplicationSource(transport:typeof fetch=fetch,now=Date.now){
  const tokens=createShopifyTokenProvider(transport,now);
  return async(actor:ShopifyProbeActor,orderGid:string|null,signal:AbortSignal,env:NodeJS.ProcessEnv=process.env)=>{
    const config=getShopifyApplicationConfig(actor,env);
    const token=await tokens.getToken(config);
    const metadata=await readShopifyApplicationGraphQL({shopDomain:config.shopDomain,connectionEnvironment:"production",accessToken:token,
      query:`query OSPlusPilotSetup { shop { id myshopifyDomain } currentAppInstallation { accessScopes { handle } } }`,
      schema:metadataSchema,signal},actor,transport,env);
    if(metadata.data.shop.myshopifyDomain!==config.shopDomain)throw new ShopifyIntegrationError("ACCESS_DENIED");
    const scopes=new Set(metadata.data.currentAppInstallation.accessScopes.map(s=>s.handle));
    if(["orders","customers","products"].some(s=>!scopes.has(`read_${s}`)&&!scopes.has(`write_${s}`)))throw new ShopifyIntegrationError("ACCESS_DENIED");
    if(orderGid===null)return {shopGid:metadata.data.shop.id,domain:config.shopDomain,verifiedAt:new Date(now()).toISOString()};
    gid("Order").parse(orderGid);
    const fields="{ firstName lastName phone address1 address2 city province countryCodeV2 zip }";
    const response=await readShopifyApplicationGraphQL({shopDomain:config.shopDomain,connectionEnvironment:"production",accessToken:token,
      query:`query OSPlusPilotProtectedAccess($id: ID!) { shop { id myshopifyDomain } order(id: $id) { id createdAt updatedAt email phone customer { id firstName lastName email phone } shippingAddress ${fields} billingAddress ${fields} } }`,
      variables:{id:orderGid},schema:z.object({shop:metadataSchema.shape.shop,order:orderSchema}),signal},actor,transport,env);
    if(response.data.shop.id!==metadata.data.shop.id||response.data.shop.myshopifyDomain!==config.shopDomain||!response.data.order||response.data.order.id!==orderGid)
      throw new ShopifyIntegrationError("SOURCE_UNAVAILABLE");
    return {shopGid:metadata.data.shop.id,domain:config.shopDomain,verifiedAt:new Date(now()).toISOString(),sourceCreatedAt:response.data.order.createdAt};
  };
}
