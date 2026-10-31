import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {randomUUID,createHash} from "node:crypto";
import {setTimeout as delay} from "node:timers/promises";
import {state as appState,verifyContainer,connect,runtime as appRuntime} from "../chat-local/common.mjs";
import {state,owned,rails,runtime} from "./common.mjs";
import {syntheticVoiceFixture} from "../../src/features/chat/voice/mock-fixtures.ts";
import {syntheticOpusBase64} from "../../src/features/chat/voice/opus-fixture.ts";
if(!process.argv.includes("--run"))throw Error("Explicit --run required for owned local synthetic CH8 QA");
const s=await appState();await verifyContainer(s,"db");await verifyContainer(s,"rest");await owned(await state());
const accounts=JSON.parse(await readFile(path.join(runtime,"accounts.private.json"),"utf8")).accounts;
assert.deepEqual(accounts.map(a=>a.accountId),[901,902]);
// Warm nonexistent credentials only: Next dev compilation otherwise exceeds Chatwoot's five-second callback budget.
for(const kind of ["events","agent"]){const r=await fetch("http://localhost:4131/api/chat/webhooks/chatwoot/"+"0".repeat(32)+"/"+kind+"?token="+"0".repeat(32),{method:"POST",headers:{"Content-Type":"application/json"},body:"{}",redirect:"manual",signal:AbortSignal.timeout(60000)});assert.equal(r.status,404);await r.body?.cancel();}
const ownerFixture=process.argv.includes("--owner-fixture");
const db=await connect(s),report={at:new Date().toISOString(),scope:"owned local only; synthetic tones, not speech",cases:[],liveAi:false,liveTranscription:false,spendUsd:0};
const rpc=async(name,context,input,action)=>(await db.query("select "+name+"($1::jsonb,"+(action===undefined?"$2::jsonb":"$2,$3::jsonb")+") result",action===undefined?[JSON.stringify(context),JSON.stringify(input)]:[JSON.stringify(context),action,JSON.stringify(input)])).rows[0].result;
async function api(a,route,body){
 const response=await fetch("http://127.0.0.1:4141/api/v1/accounts/"+a.accountId+route,{method:body?"POST":"GET",redirect:"error",headers:{"api-access-token":a.token,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error("Owned Chatwoot request unavailable "+response.status);return response.json();
}
try{
 for(const a of accounts){
  const w=(await db.query("select tenant_id from chat_workspaces where chatwoot_account_id=$1 and chatwoot_base_url='https://localhost:4444'",[a.accountId])).rows;
  assert.equal(w.length,1);a.tenantId=w[0].tenant_id;assert.equal(a.tenantId,"81000000-0000-4000-8000-00000000000"+(a.accountId-900));
  const owner=(await db.query("select clerk_user_id from tenant_users where tenant_id=$1 and role='owner_admin' and status='active'",[a.tenantId])).rows[0];assert.ok(owner);
  const context={tenantId:a.tenantId,actor:{type:"USER",id:owner.clerk_user_id},source:"OS_PLUS_UI",correlationId:randomUUID(),idempotencyKey:randomUUID()};
  const initial=await rpc("chat_voice_settings",context,{});
  if(!initial.enabled)await rpc("chat_voice_settings",context,{...initial,enabled:true});
 }
 const cases=[{account:0,kind:"wav",bytes:syntheticVoiceFixture().bytes,text:syntheticVoiceFixture().text},
  {account:1,kind:"ogg",bytes:Buffer.from(syntheticOpusBase64,"base64"),text:syntheticVoiceFixture().text},
  {account:0,kind:"unknown",bytes:Buffer.from(syntheticVoiceFixture().bytes),text:null}];
 cases[2].bytes[100]^=3;
 for(const item of ownerFixture?cases.slice(0,1):cases){
  const a=accounts[item.account],person=(await api(a,"/contacts",{inbox_id:a.inboxId,name:"CH8 synthetic "+item.kind,identifier:"ch8-"+randomUUID()})).payload.contact;
  const source=person.contact_inboxes.find(c=>c.inbox.id===a.inboxId).source_id;
  const conversation=await api(a,"/conversations",{source_id:source,inbox_id:a.inboxId,contact_id:person.id,status:"open"});
  // Real local Rails callbacks deliver actual provider events. No fabricated HTTP capture or external media.
  const output=await rails('Rails.logger.level=Logger::FATAL;require "base64";require "stringio";c=Conversation.find_by!(account_id:'+a.accountId+',display_id:'+conversation.id+');m=c.messages.new(account_id:c.account_id,inbox_id:c.inbox_id,sender:c.contact,message_type: :incoming,content:nil);m.attachments.build(account_id:c.account_id,file_type: :audio,file:{io:StringIO.new(Base64.decode64("'+Buffer.from(item.bytes).toString("base64")+'")),filename:"ch8-'+item.kind+'.'+(item.kind==="ogg"?"ogg":"wav")+'",content_type:"'+(item.kind==="ogg"?"audio/ogg":"audio/wav")+'"});m.save!;puts "CH8_MESSAGE="+m.id.to_s');
  const marker=output.split("\n").find(l=>l.startsWith("CH8_MESSAGE="));assert.ok(marker,"Native message created");const providerMessageId=Number(marker.slice(12));
  let row;
  for(let n=0;n<180;n++){
   row=(await db.query("select m.id,m.content,m.transcript,c.id conversation_id,j.state,j.note_state,j.provider_note_id,t.decision_json,r.status run_status,r.id run_id from chat_messages m join chat_conversations c on c.tenant_id=m.tenant_id and c.id=m.conversation_id left join chat_voice_jobs j on j.tenant_id=m.tenant_id and j.trigger_message_id=m.id left join chat_turns t on t.tenant_id=m.tenant_id and t.trigger_message_id=m.id left join chat_agent_runs r on r.tenant_id=m.tenant_id and r.trigger_message_id=m.id where m.tenant_id=$1 and m.chatwoot_message_id=$2",[a.tenantId,providerMessageId])).rows[0];
   if(item.text?row?.run_status==="delivered":row?.state==="unreadable"&&row?.run_status==="delivered")break;
   await delay(250);
  }
  assert.ok(row,"Native captured");assert.equal(row.content,null);assert.equal(row.run_status,"delivered",JSON.stringify({state:row.state,note:row.note_state,run:row.run_status}));
  const messages=(await api(a,"/conversations/"+conversation.id+"/messages")).payload;
  assert.ok(messages.some(m=>!m.attachments),"Pinned ordinary history omits attachments");
  const transcriptNotes=messages.filter(m=>m.private&&m.content?.startsWith("Automatic voice transcript"));
  const drafts=messages.filter(m=>m.private&&m.content?.startsWith("💬 Suggested reply"));
  const publicReplies=messages.filter(m=>!m.private&&m.message_type===1&&m.sender?.type==="agent_bot");
  if(item.text){assert.equal(row.transcript,item.text);assert.equal(row.note_state,"sent");assert.equal(transcriptNotes.length,1);assert.equal(drafts.length,1);assert.equal(transcriptNotes[0].conversation_id,conversation.id);}
  else {assert.equal(row.transcript,null);assert.equal(row.note_state,"none");assert.equal(transcriptNotes.length,0);assert.equal(drafts.length,1);assert.equal(row.decision_json.reason,"unreadable_voice");
   const tasks=(await db.query("select count(distinct r.id)::int n from chat_task_records r join leads l on l.tenant_id=r.tenant_id and l.id=r.lead_id join chat_task_reasons why on why.tenant_id=r.tenant_id and why.record_id=r.id where r.tenant_id=$1 and l.conversation_id=$2 and why.reason='unreadable'",[a.tenantId,row.conversation_id])).rows[0].n;assert.equal(tasks,1);
  }
  assert.equal(publicReplies.length,0);
  if(ownerFixture){
   assert.equal(messages.filter(m=>m.message_type===2&&/error with the agent bot/i.test(m.content??"")).length,0,"Warmed customer callback must not add bot failure activity");
   const replay=await rails("Rails.logger.level=Logger::FATAL;c=Conversation.find_by!(account_id:"+a.accountId+",display_id:"+conversation.id+");m=c.messages.find("+providerMessageId+");2.times{SafeFetch.fetch(c.inbox.agent_bot.outgoing_url,method: :post,body:m.webhook_data.merge(event:'message_created').to_json,headers:{'Content-Type'=>'application/json'},open_timeout:5,read_timeout:5,validate_content_type:false){|_r|nil}};puts 'CH8_REPLAY_OK'");assert.ok(replay.includes("CH8_REPLAY_OK"));
   const after=(await api(a,"/conversations/"+conversation.id+"/messages")).payload;
   assert.equal(after.filter(m=>m.private&&m.content?.startsWith("Automatic voice transcript")).length,1);
   assert.equal(after.filter(m=>m.private&&m.content?.startsWith("💬 Suggested reply")).length,1);
   report.warmedReplay={accepted:2,duplicateTranscriptNotes:0,duplicateDraftNotes:0,botErrorActivity:0};
  }
  const original=(await db.query("select count(*)::int n from chat_voice_jobs where tenant_id=$1 and trigger_message_id=$2",[a.tenantId,row.id])).rows[0].n;assert.equal(original,1);
  const costs=(await db.query("select count(*)::int n from chat_agent_cost_entries where tenant_id=$1 and run_id=$2",[a.tenantId,row.run_id])).rows[0].n;assert.equal(costs,0);
  const lead=(await db.query("select id from leads where tenant_id=$1 and conversation_id=$2",[a.tenantId,row.conversation_id])).rows[0];
  report.cases.push({kind:item.kind,accountId:a.accountId,conversationId:conversation.id,providerMessageId,leadId:lead.id,transcriptNotes:transcriptNotes.length,privateDrafts:drafts.length,publicBotReplies:publicReplies.length,jobs:original,costEntries:costs,result:"PASS"});
  console.log("PASS owned native "+item.kind+" account "+a.accountId+" conversation "+conversation.id);
  await writeFile(path.join(appRuntime,ownerFixture?"ch8-owner-native-progress.json":"ch8-native-progress.json"),JSON.stringify(report,null,2));
  if(item.kind==="wav"){await writeFile(path.join(appRuntime,"ch8-synthetic-hours.wav"),item.bytes);await writeFile(path.join(appRuntime,"ch8-synthetic-hours.ogg"),Buffer.from(syntheticOpusBase64,"base64"));}
 }
 report.result="PASS";await writeFile(path.join(appRuntime,ownerFixture?"ch8-owner-native-report.json":"ch8-native-report.json"),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await db.end();}
