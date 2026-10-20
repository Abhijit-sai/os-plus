import { z } from "zod";

export type ShopifyAccessCheck={kind:"success";verifiedAt:string}|{kind:"error";message:string};
const successSchema=z.object({status:z.literal("verified"),tenantId:z.string().uuid(),shopDomain:z.string(),
  apiVersion:z.literal("2026-10"),verifiedAt:z.string().datetime({offset:true}),requiredScopesVerified:z.literal(true),
  importsEnabled:z.literal(false),messagingEnabled:z.literal(false),protectedCustomerFieldsVerified:z.literal(false)});
const fallback="Store access could not be checked. Try again; no orders were imported.";
const messages:Record<string,string>={
  AUTHENTICATION_REQUIRED:"Sign in again, then retry the store access check.",
  ACCESS_DENIED:"Use an active owner/admin account in the configured Test tenant. Store access may also need review.",
  CONFIGURATION_INVALID:"Shopify configuration is not ready. Ask the administrator to check the private environment settings.",
  CONNECTION_TEST_DISABLED:"Store access checks are not enabled for this deployment yet.",
  THROTTLED:"Shopify is busy. Wait a little before retrying; no orders were imported.",
};

async function readSmallJson(response:Response,signal:AbortSignal){
  const reader=response.body?.getReader();if(!reader)throw Error("missing response");
  const chunks:Uint8Array[]=[];let length=0;
  const cancel=()=>{void reader.cancel().catch(()=>undefined);};
  signal.addEventListener("abort",cancel,{once:true});
  try{
    while(true){
      if(signal.aborted)throw Error("cancelled");
      const next=await reader.read();if(next.done)break;
      length+=next.value.byteLength;if(length>8192){cancel();throw Error("oversized response");}
      chunks.push(next.value);
    }
    const bytes=new Uint8Array(length);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)) as unknown;
  }finally{signal.removeEventListener("abort",cancel);reader.releaseLock();}
}

// Same-origin read-only diagnostic only. Browser never sends a tenant, store,
// token, app secret, GraphQL query or DB mutation. Unknown response fields drop.
export async function checkShopifyAccess(tenantId:string,shopDomain:string,signal:AbortSignal,
  transport:typeof fetch=fetch):Promise<ShopifyAccessCheck>{
  if(signal.aborted)return {kind:"error",message:fallback};
  let rejectAbort:()=>void=()=>{};
  const cancelled=new Promise<never>((_,reject)=>{rejectAbort=()=>reject(Error("cancelled"));});
  signal.addEventListener("abort",rejectAbort,{once:true});
  try{
    const response=await Promise.race([transport("/api/integrations/shopify/test-connection",{
      method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",signal,
      headers:{"Content-Type":"application/json"},body:"{}"}),cancelled]);
    const body=await Promise.race([readSmallJson(response,signal),cancelled]);
    if(signal.aborted)return {kind:"error",message:fallback};
    if(!response.ok){
      const error=z.object({error:z.string().max(64)}).safeParse(body);
      return {kind:"error",message:error.success && Object.hasOwn(messages,error.data.error)?messages[error.data.error]:fallback};
    }
    const parsed=successSchema.safeParse(body);
    if(!parsed.success || parsed.data.tenantId!==tenantId || parsed.data.shopDomain!==shopDomain)
      return {kind:"error",message:fallback};
    return {kind:"success",verifiedAt:parsed.data.verifiedAt};
  }catch{return {kind:"error",message:fallback};}
  finally{signal.removeEventListener("abort",rejectAbort);}
}
