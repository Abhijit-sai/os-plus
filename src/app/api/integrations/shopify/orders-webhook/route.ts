import { after } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createShopifyApplicationIngress } from "@/integrations/shopify/application-ingress";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(request:Request){
  try{return await createShopifyApplicationIngress(createSupabaseServiceRoleClient(),{schedule:after}).orders(request);}
  catch{return Response.json({error:"CONFIGURATION_INVALID"},{status:503,headers:{"Cache-Control":"private, no-store"}});}
}
