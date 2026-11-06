import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import {z} from 'zod';
import * as notificationSchemas from '../src/features/chat/notifications/schemas.ts';
import {PGlite} from './shopify-db-harness/node_modules/@electric-sql/pglite/dist/index.js';
import {pgcrypto} from './shopify-db-harness/node_modules/@electric-sql/pglite/dist/contrib/pgcrypto.js';
import {encryptChatSecret} from '../src/features/chat/secrets.ts';
import {runNotificationBatch} from '../src/features/chat/notifications/worker.ts';

let db,fixture;
const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
const context=(tenant,role='owner',key=randomUUID())=>({tenantId:tenant,actor:{type:'USER',id:'setup-'+role},source:'OS_PLUS_UI',correlationId:randomUUID(),idempotencyKey:key});
const queue=(f,ctx=context(f.tenant),input={id:f.target,version:1})=>q('select chat_notification_queue_test($1::jsonb,$2::jsonb) result',[JSON.stringify(ctx),JSON.stringify(input)]).then(rows=>rows[0].result);
async function makeFixture(){
 const tenant=randomUUID(),target=randomUUID();
 await q(`insert into tenants(id,name,slug,store_name) values($1,'Fictional notification test',$2,'Fictional notification test')`,[tenant,'notify-'+tenant]);
 await q(`insert into tenant_modules(tenant_id,is_enabled) values($1,true)`,[tenant]);
 await q(`insert into chat_settings(tenant_id,notifications_enabled) values($1,true)`,[tenant]);
 for(const [role,value]of [['owner','owner_admin'],['manager','manager'],['viewer','viewer'],['finance','finance']])await q(`insert into tenant_users(tenant_id,clerk_user_id,email,display_name,role,status) values($1,$2,$3,$4,$5,'active')`,[tenant,'setup-'+role,role+'@example.invalid',role,value]);
 const recipient=encryptChatSecret(JSON.stringify({chatId:'123456789',senderId:'123456789'}),{tenantId:tenant,workspaceId:target,purpose:'notification_recipient'});
 await q(`insert into chat_notification_targets(id,tenant_id,label,is_active,events,recipient_enc,recipient_kind,recipient_hint,linked_at,confirmed_at,activated_at) values($1,$2,'Fictional owner',true,array['new_lead'],$3,'private','6789',now(),now(),now())`,[target,tenant,recipient]);return {tenant,target};
}
before(async()=>{
 process.env.CHAT_FOUNDATION_ENABLED='true';process.env.CHAT_NOTIFICATIONS_ENABLED='true';process.env.CHAT_DRY_RUN='false';process.env.CHAT_SECRETS_ACTIVE_VERSION='v1';process.env.CHAT_SECRETS_KEYS=JSON.stringify({v1:randomBytes(32).toString('base64')});
 db=new PGlite({extensions:{pgcrypto}});
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;`);
 for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
 fixture=await makeFixture();
});
after(async()=>{await db?.close();});
test('Owner queues a clearly labelled test without creating a customer, conversation or lead',async()=>{
 const f=fixture;const before=await q(`select (select count(*) from customers) customers,(select count(*) from chat_conversations) conversations,(select count(*) from leads) leads`);
 const receipt=await queue(f);assert.ok(receipt.id);assert.equal(receipt.version,1);
 const rows=await q('select kind,source_key,payload_json,lead_id,brand_id,state from chat_notification_outbox where tenant_id=$1',[f.tenant]);assert.equal(rows.length,1);assert.equal(rows[0].state,'queued');assert.equal(rows[0].kind,'new_lead');assert.match(rows[0].source_key,/^setup-test:/);assert.match(rows[0].payload_json.brand,/Telegram setup test/);assert.equal(rows[0].lead_id,null);assert.equal(rows[0].brand_id,null);assert.deepEqual(await q(`select (select count(*) from customers) customers,(select count(*) from chat_conversations) conversations,(select count(*) from leads) leads`),before);
});

test('Owner test action uses the audited queue command and schedules delivery without browser secrets',async()=>{
 const calls=[],scheduled=[];const receipt={id:randomUUID(),version:1};
 const loaded={exports:{}};const code=ts.transpileModule(readFileSync('src/features/chat/notifications/commands.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{module:loaded,exports:loaded.exports,require(name){
  if(name==='server-only')return {};if(name==='node:crypto')return {randomBytes,createHash:()=>{throw Error('Unexpected secret hashing');}};if(name==='zod')return {z};
  if(name==='@/core/command-context/server')return {createUserCommandContext:(_context,extra)=>({tenantId:fixture.tenant,...extra})};
  if(name==='../module')return {requireChatPermission:async()=>({context:{tenant:{id:fixture.tenant}},db:{rpc:async(name,args)=>{calls.push({name,args});return {data:receipt,error:null};}}})};
  if(name==='../schemas')return {commandKeySchema:z.string().min(1).max(160)};
  if(name==='../secrets')return {encryptChatSecret(){throw Error('Unexpected encryption');},decryptChatSecret(){throw Error('Unexpected decryption');}};
  if(name==='./schemas')return notificationSchemas;
  if(name==='./summary')return {summarySchema:z.unknown(),formatDailySummary(){}};
  if(name==='./flags')return {notificationsEnabled:()=>true};
  if(name==='./trigger')return {scheduleNotificationCheck:async tenant=>scheduled.push(tenant)};
  throw Error('Unexpected import '+name);
 }});
 await loaded.exports.configureNotification({action:'test',input:{id:fixture.target,version:1}},randomUUID(),fixture.tenant);
 assert.equal(calls.length,1);assert.equal(calls[0].name,'chat_notification_queue_test');assert.equal(Object.hasOwn(calls[0].args,'p_action'),false);assert.deepEqual(scheduled,[fixture.tenant]);
 const count=calls.length;await assert.rejects(()=>loaded.exports.configureNotification({action:'test',input:{id:fixture.target,version:1}},randomUUID(),randomUUID()),/selected business/);assert.equal(calls.length,count);
});

test('setup test retry reuses one queue receipt and a changed request conflicts',async()=>{
 const f=await makeFixture(),key=randomUUID(),ctx=context(f.tenant,'owner',key);
 const [a,b]=await Promise.all([queue(f,ctx),queue(f,ctx)]);assert.equal(a.id,b.id);
 assert.equal((await q('select count(*)::int n from chat_notification_outbox where tenant_id=$1',[f.tenant]))[0].n,1);
 await assert.rejects(()=>queue(f,ctx,{id:f.target,version:2}),/conflict/);
 await assert.rejects(()=>queue(f),/unresolved/);
});
test('setup test denies nonowners and another tenant destination without queue writes',async()=>{
 const f=await makeFixture(),other=await makeFixture();
 for(const role of ['manager','viewer','finance'])await assert.rejects(()=>queue(f,context(f.tenant,role)),/access/i);
 await assert.rejects(()=>queue(other,context(other.tenant),{id:f.target,version:1}),/Destination changed/);
 assert.equal((await q('select count(*)::int n from chat_notification_outbox where tenant_id=any($1::uuid[])',[[f.tenant,other.tenant]]))[0].n,0);
});
test('setup test requires enabled business, matching version and an active confirmed private destination',async()=>{
 for(const change of ["update chat_settings set notifications_enabled=false where tenant_id=$1","update chat_notification_targets set is_active=false where tenant_id=$1","update chat_notification_targets set is_active=false,confirmed_at=null where tenant_id=$1","update chat_notification_targets set recipient_kind='group' where tenant_id=$1","update chat_notification_targets set events=array['handoff'] where tenant_id=$1"]){
  const f=await makeFixture();await q(change,[f.tenant]);await assert.rejects(()=>queue(f));assert.equal((await q('select count(*)::int n from chat_notification_outbox where tenant_id=$1',[f.tenant]))[0].n,0);
 }
 const f=await makeFixture();await assert.rejects(()=>queue(f,context(f.tenant),{id:f.target,version:99}),/Destination changed/);
});
function workerDependencies(sent,fail=false){return {
 run:async(ctx,action,input)=>(await q('select chat_notification_dispatch($1::jsonb,$2,$3::jsonb) result',[JSON.stringify(ctx),action,JSON.stringify(input)]))[0].result,
 send:async input=>{sent.push(input);if(fail)throw Error('Synthetic lost transport receipt');return {messageId:432};}
};}
test('actual delivery worker sends the queued labelled setup test once and records its receipt',async()=>{
 const sent=[];const first=await runNotificationBatch(fixture.tenant,workerDependencies(sent),'https://os-plus.vercel.app');assert.equal(first.sent,1);assert.equal(sent.length,1);assert.match(sent[0].text,/Telegram setup test - no customer action required/);assert.equal(sent[0].chatId,'123456789');assert.ok(sent[0].text.endsWith('https://os-plus.vercel.app/leads'));
 const replay=await runNotificationBatch(fixture.tenant,workerDependencies(sent),'https://os-plus.vercel.app');assert.equal(replay.sent,0);assert.equal(sent.length,1);
 const row=(await q('select state,provider_message_id from chat_notification_outbox where tenant_id=$1',[fixture.tenant]))[0];assert.equal(row.state,'sent');assert.equal(Number(row.provider_message_id),432);
});
test('unknown setup-test delivery is held and never sent again',async()=>{
 const f=await makeFixture();await queue(f);const sent=[];const first=await runNotificationBatch(f.tenant,workerDependencies(sent,true),'https://os-plus.vercel.app');assert.equal(first.held,1);assert.equal(sent.length,1);
 const replay=await runNotificationBatch(f.tenant,workerDependencies(sent),'https://os-plus.vercel.app');assert.equal(replay.sent,0);assert.equal(sent.length,1);assert.equal((await q('select state from chat_notification_outbox where tenant_id=$1',[f.tenant]))[0].state,'uncertain');
});
test('only service-role application access can call the setup queue function',async()=>{
 const rows=await q("select has_function_privilege('anon','chat_notification_queue_test(jsonb,jsonb)','execute') anon,has_function_privilege('authenticated','chat_notification_queue_test(jsonb,jsonb)','execute') authenticated,has_function_privilege('service_role','chat_notification_queue_test(jsonb,jsonb)','execute') service");assert.deepEqual(rows,[{anon:false,authenticated:false,service:true}]);
});

test('an aged unresolved setup test blocks a new command key until reconciliation',async()=>{
 for(const state of ['queued','sending','uncertain']){
  const f=await makeFixture();await queue(f);await q("update chat_notification_outbox set state=$1,created_at=now()-interval '1 hour',attempted_at=now()-interval '1 hour' where tenant_id=$2",[state,f.tenant]);
  await assert.rejects(()=>queue(f),/unresolved/);assert.equal((await q('select count(*)::int n from chat_notification_outbox where tenant_id=$1',[f.tenant]))[0].n,1);
 }
});

test('owner delivery receipts identify setup tests without returning raw source keys or payloads',async()=>{
 const result=(await q('select chat_notification_read($1::jsonb) result',[JSON.stringify(context(fixture.tenant))]))[0].result;
 assert.ok(result.deliveries.length>0);assert.equal(result.deliveries[0].isSetupTest,true);assert.equal(Object.hasOwn(result.deliveries[0],'source_key'),false);assert.equal(Object.hasOwn(result.deliveries[0],'payload_json'),false);
});
