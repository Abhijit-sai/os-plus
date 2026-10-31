import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {randomBytes,randomUUID,createHash} from "node:crypto";
import {state as appState,connect as dbConnect} from "../chat-local/common.mjs";
import {state,owned,runtime,rails} from "./common.mjs";
import {ChatwootAdminClient} from "../../src/integrations/chatwoot/admin-client.ts";
import {provisionChatwootTransport} from "../../src/integrations/chatwoot/onboarding.ts";
import {encryptChatSecret} from "../../src/features/chat/secrets.ts";
const s=await state();await owned(s);const app=await appState(),db=await dbConnect(app);
process.env.CHAT_SECRETS_KEYS=JSON.stringify({v1:app.chatKey});process.env.CHAT_SECRETS_ACTIVE_VERSION="v1";
const accounts=JSON.parse(await readFile(path.join(runtime,"accounts.private.json"),"utf8"));
const recordFile=path.join(runtime,"connections.private.json");let records;
try{records=JSON.parse(await readFile(recordFile,"utf8"));}catch(e){if(e.code!=="ENOENT")throw e;records={};}
const platform=new ChatwootAdminClient({origin:"https://localhost:4444",token:accounts.platformToken});
try{
 for(const [index,a] of accounts.accounts.entries()){
  const tenant="81000000-0000-4000-8000-"+String(index+1).padStart(12,"0"),actor="local-api-owner-"+(index===0?"a":"b");
  const context=()=>({tenantId:tenant,actor:{type:"USER",id:actor},source:"OS_PLUS_UI",correlationId:randomUUID(),idempotencyKey:randomUUID()});
  const rpc=async(fn,action,input)=>(await db.query("select "+fn+"($1,$2,$3) result",[context(),action,input])).rows[0].result;
  const w=(await db.query("select * from chat_workspaces where tenant_id=$1",[tenant])).rows[0];
  if(!w||![null,String(a.accountId)].includes(w.chatwoot_account_id))throw new Error("Unexpected local workspace fixture");
  records[tenant]??={secret:randomBytes(32).toString("base64url"),workspaceId:w.id,accountId:a.accountId,inboxId:a.inboxId,key:w.workspace_key};
  await writeFile(recordFile,JSON.stringify(records,null,2));
  const r=records[tenant],secretHash=createHash("sha256").update(r.secret).digest("hex");
  // Fixture-only endpoint rebinding: preserve the old value and audit it, never act on another tenant/origin.
  if(w.chatwoot_base_url!=="https://localhost:4444"){
   if(w.chatwoot_base_url!=="https://chatwoot.example.invalid")throw new Error("Unexpected fixture origin");
   r.previousOrigin=w.chatwoot_base_url;await writeFile(recordFile,JSON.stringify(records,null,2));
   await db.query("begin");
   await db.query("select pg_advisory_xact_lock(hashtextextended('chat-config:'||$1,0))",[tenant]);
   await db.query("update chat_workspaces set chatwoot_base_url='https://localhost:4444' where id=$1 and tenant_id=$2",[w.id,tenant]);
   await db.query("insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json) values($1,'chat.local_fixture_rebind','chat_workspace',$2,'USER',$3,'OS_PLUS_UI',$4,'{}')",[tenant,w.id,actor,randomUUID()]);
   await db.query("commit");
  }
  await rpc("chat_platform_configure","workspace.rotate",{id:w.id,secretHash});
  await rpc("chat_platform_configure","workspace.link",{id:w.id,accountId:a.accountId,apiTokenEnc:encryptChatSecret(a.token,{tenantId:tenant,workspaceId:w.id,purpose:"account_token"})});
  await rpc("chat_platform_configure","module.set",{enabled:true});
  let brand=(await db.query("select id from chat_brands where tenant_id=$1 and is_active and deleted_at is null order by created_at limit 1",[tenant])).rows[0]?.id;
  if(!brand){const result=await rpc("chat_configure","brand.save",{name:"Chat Local "+(index+1),slug:"chat-local-"+(index+1),personaName:"Local assistant"});brand=result.id;}
  if(!brand)throw new Error("Missing local brand");
  await rpc("chat_configure","channel.map",{workspaceId:w.id,brandId:brand,locationId:null,inboxId:a.inboxId,kind:"website",name:"Chat Local "+(index+1)+" Website"});
  const prefix="https://osplus-bridge/api/chat/webhooks/chatwoot/"+w.workspace_key,eventsUrl=prefix+"/events?token="+r.secret,agentUrl=prefix+"/agent?token="+r.secret;
  const requestHash=createHash("sha256").update(JSON.stringify({accountId:a.accountId,eventsUrl,agentUrl})).digest("hex");
  const call=async(action,stage,extra={})=>rpc("chat_transport_setup",action,{workspaceId:w.id,secretHash,requestHash,stage,...extra});
  const account=new ChatwootAdminClient({origin:"https://localhost:4444",token:a.token});
  const setup=await provisionChatwootTransport({accountId:a.accountId,existingBotId:w.agent_bot_id===null?null:Number(w.agent_bot_id),name:"OS PLUS Local Assistant",eventsUrl,agentUrl,inboxes:[{id:a.inboxId,mode:"draft"}]},platform,account,{
   assertWrite:async(stage)=>{await call("check",stage);},
   begin:async(stage)=>call("begin",stage),
   complete:async(stage,id,botToken)=>{const extra={remoteId:id};if(botToken)extra.botTokenEnc=encryptChatSecret(botToken,{tenantId:tenant,workspaceId:w.id,purpose:"bot_token"});await call("complete",stage,extra);}
  });
  console.log("Connected Chat Local "+(index+1)+": account "+a.accountId+", inbox "+a.inboxId+", bot "+setup.botId);
 }
 await rails('::Redis::Alfred.delete(::Redis::Alfred::CHATWOOT_INSTALLATION_ONBOARDING);puts "Local fixture installation ready"');
}finally{await db.end();}
