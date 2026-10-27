import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {randomUUID,createHash} from "node:crypto";
import {setTimeout as delay} from "node:timers/promises";
import {state as appState,verifyContainer,connect,runtime as appRuntime} from "../chat-local/common.mjs";
import {state,owned,rails,runtime} from "./common.mjs";
if(!process.argv.includes("--run"))throw new Error("Explicit --run required for owned local synthetic CH7 QA.");
const s=await appState();await verifyContainer(s,"db");await verifyContainer(s,"rest");await owned(await state());
const a=JSON.parse(await readFile(path.join(runtime,"accounts.private.json"),"utf8")).accounts[0];
assert.equal(a.accountId,901);assert.equal(a.inboxId,901);
const db=await connect(s);
const api=async(route,body)=>{
 const response=await fetch("http://127.0.0.1:4141/api/v1/accounts/"+a.accountId+route,{method:"POST",redirect:"error",headers:{"api-access-token":a.token,"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error("Owned provider request failed: "+response.status);
 return response.json();
};
try{
 const workspaces=(await db.query("select tenant_id from chat_workspaces where chatwoot_account_id=901 and chatwoot_base_url='https://localhost:4444'")).rows;
 assert.equal(workspaces.length,1);a.tenantId=workspaces[0].tenant_id;assert.equal(a.tenantId,"81000000-0000-4000-8000-000000000001");
 const target=(await db.query("select id,is_active from chat_notification_targets where tenant_id=$1 and label='CH7 local owner'",[a.tenantId])).rows[0];assert.equal(target?.is_active,true);
 const settings=(await db.query("select notifications_enabled from chat_settings where tenant_id=$1",[a.tenantId])).rows[0];assert.equal(settings.notifications_enabled,true);
 const person=(await api("/contacts",{inbox_id:a.inboxId,name:"CH7 synthetic enquiry",identifier:"ch7-"+randomUUID()})).payload.contact;
 const source=person.contact_inboxes.find(c=>c.inbox.id===a.inboxId).source_id;
 const conversation=await api("/conversations",{source_id:source,inbox_id:a.inboxId,contact_id:person.id,status:"open"});
 const output=await rails("Rails.logger.level=Logger::FATAL;c=Conversation.find_by!(account_id:901,display_id:"+conversation.id+");m=c.messages.create!(account_id:c.account_id,inbox_id:c.inbox_id,sender:c.contact,message_type: :incoming,content:\"CH7 synthetic opening-hours enquiry\");puts 'CH7_MESSAGE='+m.id.to_s");
 const messageId=Number(output.split("\n").find(v=>v.startsWith("CH7_MESSAGE=")).slice(12));assert.ok(Number.isSafeInteger(messageId));
 let row;
 for(let n=0;n<160;n++){
  row=(await db.query("select o.id,o.state,o.provider_message_id,o.lead_id from chat_notification_outbox o join leads l on l.tenant_id=o.tenant_id and l.id=o.lead_id join chat_conversations c on c.tenant_id=l.tenant_id and c.id=l.conversation_id where o.tenant_id=$1 and o.target_id=$2 and o.kind='new_lead' and c.chatwoot_conversation_id=$3",[a.tenantId,target.id,conversation.id])).rows[0];
  if(row?.state==="sent")break;await delay(250);
 }
 assert.equal(row?.state,"sent");
 const count=(await db.query("select count(*)::int n from chat_notification_outbox where tenant_id=$1 and target_id=$2 and kind='new_lead' and lead_id=$3",[a.tenantId,target.id,row.lead_id])).rows[0].n;assert.equal(count,1);
 const logs=(await readFile(path.join(appRuntime,"telegram-mock-receipts.jsonl"),"utf8")).trim().split("\n").map(v=>JSON.parse(v));
 assert.ok(logs.some(v=>v.messageId===Number(row.provider_message_id)&&v.chatHash===createHash("sha256").update("12345671").digest("hex")));
 const report={at:new Date().toISOString(),nativeConversation:conversation.id,leadId:row.lead_id,outboxId:row.id,providerMessageId:Number(row.provider_message_id),nativeCaptureToMockAlert:"PASS",uniqueLogicalAlert:count,realTelegramCalls:0,modelSpendUsd:0};
 await writeFile(path.join(appRuntime,"ch7-native-report.json"),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await db.end();}
