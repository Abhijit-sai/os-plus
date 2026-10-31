import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {state as appState,connect,verifyContainer,runtime as appRuntime} from "../chat-local/common.mjs";
import {state,owned,runtime,rails} from "./common.mjs";
import {decryptChatSecret} from "../../src/features/chat/secrets.ts";
import {runStoredMockTurn} from "../../src/features/chat/agent/worker-core.ts";
import {createMockModel} from "../../src/features/chat/agent/mock-model.ts";
import {ChatwootMessageClient} from "../../src/integrations/chatwoot/message-client.ts";
import {validateKnowledgePublication} from "../../src/features/chat/knowledge-pack.ts";
if(!process.argv.includes("--prepare"))throw Error("Use --prepare for owned synthetic local fixtures only.");
const local=await appState();await verifyContainer(local,"db");await owned(await state());
// Next dev compiles each callback route on first use. Warm only nonexistent test credentials
// before native Chatwoot's five-second webhook budget; no tenant payload or secret is used.
for(const kind of ["events","agent"]){
 const r=await fetch("http://localhost:4131/api/chat/webhooks/chatwoot/"+"0".repeat(32)+"/"+kind+"?token="+"0".repeat(32),{method:"POST",headers:{"Content-Type":"application/json"},body:"{}",redirect:"manual",signal:AbortSignal.timeout(60000)});
 assert.equal(r.status,404);await r.body?.cancel();
}
async function prepareFixtures(){
if(process.argv.includes("--warm-only")){console.log("PASS owned local callback routes warmed, invalid credentials denied2/2");return;}
const accountData=JSON.parse(await readFile(path.join(runtime,"accounts.private.json"),"utf8"));
const db=await connect(local),report={at:new Date().toISOString(),scope:"Owned local synthetic Chatwoot and OS PLUS only; live AI disabled",conversations:[],checks:[]};
process.env.CHAT_SECRETS_KEYS=JSON.stringify({v1:local.chatKey});process.env.CHAT_SECRETS_ACTIVE_VERSION="v1";
process.env.CHAT_DRY_RUN="false";process.env.CHAT_DRAFT_DELIVERY_ENABLED="true";process.env.CHAT_MODEL_LIVE_ENABLED="false";process.env.OPENROUTER_API_KEY="";
async function api(account,route,body){
 const result=await fetch("https://localhost:4444"+route,{method:body===undefined?"GET":"POST",redirect:"error",signal:AbortSignal.timeout(15000),headers:{"api-access-token":account.token,"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
 if(!result.ok)throw Error("Local provider request failed: "+result.status);
 return result.json();
}
const configs=[];
try{
 assert.ok((await db.query("select to_regprocedure('public.chat_staff_draft_command(jsonb,text,jsonb)') id")).rows[0].id,"Apply reviewed LOCAL CH5 first");
 for(const [i,account] of accountData.accounts.entries()){
  assert.equal(account.accountId,901+i);
  const tenantId="81000000-0000-4000-8000-"+String(i+1).padStart(12,"0");
  const scope=(await db.query("select w.*,c.id channel_id,c.brand_id from chat_workspaces w join chat_channels c on c.tenant_id=w.tenant_id and c.workspace_id=w.id where w.tenant_id=$1 and w.chatwoot_account_id=$2 and w.status='active' and c.chatwoot_inbox_id=$3 and c.is_active",[tenantId,account.accountId,account.inboxId])).rows[0];
  assert.ok(scope);assert.equal(scope.chatwoot_base_url,"https://localhost:4444");assert.ok(scope.bot_token_enc);
  const native=await api(account,"/api/v1/profile");
  const owner=(await db.query("select id,clerk_user_id from tenant_users where tenant_id=$1 and email=$2 and role='owner_admin' and status='active'",[tenantId,(i?"owner-b":"owner-a")+"+clerk_test@example.com"])).rows[0];
  assert.ok(owner?.clerk_user_id,"Use the existing real Clerk development login");
  const saved=(await db.query("select * from chat_staff_links where tenant_id=$1 and (tenant_user_id=$2 or chatwoot_user_id=$3)",[tenantId,owner.id,native.id])).rows;
  await writeFile(path.join(appRuntime,"ch5-staff-mapping-"+i+".private.json"),JSON.stringify(saved),{flag:"wx",mode:0o600}).catch(error=>{if(error.code!=="EEXIST")throw error;});
  await db.query("begin");
  try{
   await db.query("delete from chat_staff_links where tenant_id=$1 and (tenant_user_id=$2 or chatwoot_user_id=$3)",[tenantId,owner.id,native.id]);
   await db.query("insert into chat_staff_links(tenant_id,tenant_user_id,chatwoot_user_id,created_by,updated_by) values($1,$2,$3,'local-ch5-qa','local-ch5-qa')",[tenantId,owner.id,native.id]);
   await db.query("update tenant_modules set config_json=config_json||'{\"staffDraftSendEnabled\":true}'::jsonb where tenant_id=$1 and module_key='chat_leads'",[tenantId]);
   await db.query("commit");
  }catch(error){await db.query("rollback");throw error;}
  const packFound=(await db.query("select id from chat_knowledge_packs where tenant_id=$1 and brand_id=$2 and status='published'",[tenantId,scope.brand_id])).rows[0];
  if(!packFound){
   const body=JSON.parse(await readFile(new URL("../../docs_chat/examples/new-business.pack.json",import.meta.url),"utf8"));
   body.brand.displayName="Local QA "+(i?"B":"A")+" synthetic";body.brand.personaName="Local assistant";
   body.areas=[];body.hours.default="Synthetic local test hours: Monday to Friday, ten in the morning to six in the evening.";
   const valid=validateKnowledgePublication(body,{locationCodes:[],capabilities:[]});
   const userContext={tenantId,actor:{type:"USER",id:owner.clerk_user_id},source:"OS_PLUS_UI",correlationId:randomUUID(),idempotencyKey:randomUUID()};
   const savedPack=(await db.query("select chat_configure($1::jsonb,'pack.save',$2::jsonb) result",[JSON.stringify(userContext),JSON.stringify({brandId:scope.brand_id,pack:valid})])).rows[0].result;
   userContext.idempotencyKey=randomUUID();
   await db.query("select chat_configure($1::jsonb,'pack.publish',$2::jsonb)",[JSON.stringify(userContext),JSON.stringify({id:savedPack.id})]);
  }
  const existing=(await db.query("select v.chatwoot_conversation_id id,m.chatwoot_message_id message_id from chat_conversations v join chat_messages m on m.tenant_id=v.tenant_id and m.conversation_id=v.id where v.tenant_id=$1 and m.content='CH5 synthetic opening-hours enquiry' order by m.created_at,v.id",[tenantId])).rows;
  for(let sample=0;sample<(i===0?(process.argv.includes("--composer")?6:process.argv.includes("--owner")?4:2):1);sample++){
   if(existing[sample]){configs.push({tenantId,account,workspace:scope,conversationId:Number(existing[sample].id),messageId:Number(existing[sample].message_id),sample});continue;}
   const contact=await api(account,"/api/v1/accounts/"+account.accountId+"/contacts",{inbox_id:account.inboxId,name:"CH5 synthetic "+(i?"B":"A")+" "+(sample+1),identifier:"ch5-"+randomUUID()});
   const c=contact.payload.contact,source=c.contact_inboxes.find(x=>x.inbox.id===account.inboxId).source_id;
   const conv=await api(account,"/api/v1/accounts/"+account.accountId+"/conversations",{source_id:source,inbox_id:account.inboxId,contact_id:c.id,status:"open"});
   configs.push({tenantId,account,workspace:scope,conversationId:conv.id,sample});
  }
 }
 const created=await rails("rows=JSON.parse("+JSON.stringify(JSON.stringify(configs.filter(c=>!c.messageId).map(c=>({accountId:c.account.accountId,conversationId:c.conversationId}))))+"); out=rows.map do |r|; c=Conversation.find_by!(account_id:r['accountId'],display_id:r['conversationId']);m=c.messages.create!(account_id:c.account_id,inbox_id:c.inbox_id,sender:c.contact,message_type: :incoming,content:'CH5 synthetic opening-hours enquiry');{accountId:c.account_id,conversationId:c.display_id,messageId:m.id};end;puts 'CH5_MESSAGES='+out.to_json");
 const messages=JSON.parse(created.split("\n").find(line=>line.startsWith("CH5_MESSAGES=")).slice(13));
 for(const [index,c] of configs.entries()){
  const message=c.messageId?{messageId:c.messageId}:messages.find(m=>m.accountId===c.account.accountId&&m.conversationId===c.conversationId);let captured;
  for(let n=0;n<100;n++){
   captured=(await db.query("select id,conversation_id from chat_messages where tenant_id=$1 and chatwoot_message_id=$2",[c.tenantId,message.messageId])).rows[0];
   if(captured&&(await db.query("select 1 from chat_turns where tenant_id=$1 and trigger_message_id=$2",[c.tenantId,captured.id])).rowCount)break;
   await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.ok(captured,"Actual provider callback must arrive");
  const context={tenantId:c.tenantId,actor:{type:"WEBHOOK",id:"chatwoot"},source:"WEBHOOK",correlationId:randomUUID()};
  const input={workspaceId:c.workspace.id,secretHash:c.workspace.webhook_secret_hash,channelId:c.workspace.channel_id,conversationId:captured.conversation_id,triggerMessageId:captured.id};
  const call=(name,extra={},action)=>db.query("select "+name+"($1::jsonb,"+(action?"$2,":"")+"$"+(action?3:2)+"::jsonb) result",action?[JSON.stringify(context),action,JSON.stringify({...input,...extra})]:[JSON.stringify(context),JSON.stringify({...input,...extra})]).then(r=>r.rows[0].result);
  const prior=(await db.query("select config_json from tenant_modules where tenant_id=$1 and module_key='chat_leads'",[c.tenantId])).rows[0].config_json;
  await db.query("update tenant_modules set config_json=config_json||'{\"agentEnabled\":true}'::jsonb where tenant_id=$1 and module_key='chat_leads'",[c.tenantId]);
  let result;
  try{
   const loaded=await call("chat_agent_load");
   result=await runStoredMockTurn({scope:{tenantId:c.tenantId,workspaceId:c.workspace.id,channelId:c.workspace.channel_id,conversationId:captured.conversation_id,triggerMessageId:captured.id},now:new Date().toISOString(),dryRun:false,deliver:true},{
    load:()=>call("chat_agent_load"),run:(action,extra)=>call("chat_agent_run",extra,action),dryRun:()=>{throw Error("Not sandbox");},
   },createMockModel("information",loaded.pack.body),async draft=>{
    const target=await call("chat_agent_target",{runId:draft.runId,leaseToken:draft.leaseToken});
    assert.equal(target.accountId,c.account.accountId);assert.equal(target.conversationId,c.conversationId);
    const token=decryptChatSecret(c.workspace.bot_token_enc,{tenantId:c.tenantId,workspaceId:c.workspace.id,purpose:"bot_token"});
    return new ChatwootMessageClient({origin:"https://localhost:4444",token}).postPrivateDraft({...target,draftId:draft.draftId,text:draft.text});
   });
  }finally{await db.query("update tenant_modules set config_json=$2::jsonb where tenant_id=$1 and module_key='chat_leads'",[c.tenantId,JSON.stringify(prior)]);}
  assert.equal(result.status,"delivered");
  const r=(await db.query("select id,delivery_note_id from chat_agent_runs where tenant_id=$1 and trigger_message_id=$2",[c.tenantId,captured.id])).rows[0];
  const lead=(await db.query("select id from leads where tenant_id=$1 and conversation_id=$2 order by first_customer_at desc limit 1",[c.tenantId,captured.conversation_id])).rows[0];
  report.conversations.push({accountId:c.account.accountId,conversationId:c.conversationId,tenantId:c.tenantId,leadId:lead.id,draftId:r.id,noteId:Number(r.delivery_note_id),triggerProviderId:message.messageId,staffId:(await api(c.account,"/api/v1/profile")).id});
  report.checks.push("Real local provider incoming/callback/strict context/mock turn/private AgentBot draft "+(index+1));
 }
 report.result="PASS";report.modelSpendUsd="0";console.log(JSON.stringify({result:"PASS",checks:report.checks.length,conversations:report.conversations,liveAI:false}));
}finally{
 await db.end();await writeFile(path.join(appRuntime,"ch5-provider-report.json"),JSON.stringify(report,null,2));
}
}
await prepareFixtures();
