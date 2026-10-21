import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {state as appState,connect} from "../chat-local/common.mjs";
import {runtime,state,owned,rails} from "./common.mjs";
import {ChatwootAdminClient} from "../../src/integrations/chatwoot/admin-client.ts";
const s=await state();await owned(s);const a=JSON.parse(await readFile(path.join(runtime,"accounts.private.json"),"utf8"));
const db=await connect(await appState()),report={at:new Date().toISOString(),scope:"Real isolated Chatwoot4.18 CE and actual OS PLUS Next/PostgreSQL",checks:[],conversations:[]};
const api=async(account,route,body)=>{
 const response=await fetch("https://localhost:4444/api/v1/accounts/"+account.accountId+route,{method:body===undefined?"GET":"POST",headers:{"api-access-token":account.token,"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body),redirect:"error",signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error("Local Chatwoot API status "+response.status+" at "+route.split("?")[0]);
 return response.json();
};
async function waitMessage(tenant,id){
 for(let n=0;n<60;n++){
  const rows=(await db.query("select * from chat_messages where tenant_id=$1 and chatwoot_message_id=$2",[tenant,id])).rows;
  if(rows.length)return rows[0];
  await new Promise(r=>setTimeout(r,500));
 }throw new Error("Real Chatwoot callback did not capture message");
}
const pass=name=>{report.checks.push(name);console.log("PASS "+name);};
try{
 for(const [i,account] of a.accounts.entries()){
  const tenant="81000000-0000-4000-8000-"+String(i+1).padStart(12,"0");
  const contact=await api(account,"/contacts",{inbox_id:account.inboxId,name:"Local QA visitor "+(i+1),identifier:"local-"+randomUUID()});
  const c=contact.payload.contact,source=c.contact_inboxes.find(x=>x.inbox.id===account.inboxId).source_id;
  const conv=await api(account,"/conversations",{source_id:source,inbox_id:account.inboxId,contact_id:c.id,status:"open"});
  report.conversations.push({accountId:account.accountId,conversationId:conv.id});
  const seeded=await rails(`c=Conversation.find_by!(account_id:${account.accountId},display_id:${conv.id});m=c.messages.create!(account_id:c.account_id,inbox_id:c.inbox_id,sender:c.contact,message_type: :incoming,content:"Synthetic local inquiry ${i+1}");puts "MESSAGE_ID="+m.id.to_s`);
  const msg={id:Number(seeded.split("\n").find(x=>x.startsWith("MESSAGE_ID=")).slice(11))};
  const stored=await waitMessage(tenant,msg.id);assert.equal(stored.content,"Synthetic local inquiry "+(i+1));
  pass("Account "+(i+1)+" real website incoming captured under its OS PLUS tenant");
  let turns=0;for(let n=0;n<60;n++){turns=(await db.query("select count(*)::int n from chat_turns where tenant_id=$1 and trigger_message_id=$2",[tenant,stored.id])).rows[0].n;if(turns===1)break;await new Promise(r=>setTimeout(r,250));}assert.equal(turns,1);
  pass("Account "+(i+1)+" independent event and agent callbacks deduplicate to one silent turn");
  const staff=await api(account,"/conversations/"+conv.id+"/messages",{content:"Local staff reply only",message_type:"outgoing",private:false});
  const st=await waitMessage(tenant,staff.id);assert.equal(st.author,"staff");
  const before=(await db.query("select quiet_until from chat_conversations where tenant_id=$1 and id=$2",[tenant,stored.conversation_id])).rows[0].quiet_until;
  assert.ok(before,"Public staff event must set the quiet deadline");
  const minutes=(await db.query("select quiet_minutes from chat_settings where tenant_id=$1",[tenant])).rows[0].quiet_minutes;
  assert.equal(new Date(before).getTime(),new Date(st.created_at).getTime()+minutes*60000);
  const note=await api(account,"/conversations/"+conv.id+"/messages",{content:"Private local note",message_type:"outgoing",private:true});
  const nt=await waitMessage(tenant,note.id);assert.equal(nt.private,true);
  const after=(await db.query("select quiet_until from chat_conversations where tenant_id=$1 and id=$2",[tenant,stored.conversation_id])).rows[0].quiet_until;
  assert.equal(String(after),String(before));pass("Account "+(i+1)+" public staff reply quiet clock preserved across private note");
  const client=new ChatwootAdminClient({origin:"https://localhost:4444",token:account.token});
  await client.addLabels(account.accountId,conv.id,["local-qa"]);const labels=await client.addLabels(account.accountId,conv.id,["osplus-captured"]);
  assert.ok(labels.includes("local-qa")&&labels.includes("osplus-captured"));pass("Account "+(i+1)+" real label merge preserves existing labels");
 }
 for(const [i,account] of a.accounts.entries()){
  const other=a.accounts[1-i];
  const response=await fetch("https://localhost:4444/api/v1/accounts/"+other.accountId+"/inboxes",{headers:{"api-access-token":account.token}});
  assert.ok([401,403,404].includes(response.status));pass("Account "+(i+1)+" cannot read other account inboxes");
 }
 report.result="PASS";
}finally{await db.end();await writeFile(path.join(runtime,"qa-report.json"),JSON.stringify(report,null,2));}
