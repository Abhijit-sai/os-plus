// Only owned disposable containers, loopback ports, random in-memory secrets.
// No production env files, DB URLs, mounts, volumes or private source reads.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { cleanupOwned,cleanupSummary } from './cleanup.mjs';

const here=fileURLToPath(new URL('.',import.meta.url)),root=fileURLToPath(new URL('../..',import.meta.url));
const nonce=randomBytes(12).toString('hex'),password=randomBytes(24).toString('hex'),jwt=randomBytes(32).toString('hex');
const marker=`osplus-shopify-disposable:${nonce}`,label='osplus.shopify.disposable';
const names={network:`osplus-shopify-net-${nonce}`,db:`osplus-shopify-db-${nonce}`,api:`osplus-shopify-api-${nonce}`};
// Immutable identifiers of already installed local images. Never pulls latest.
const pgImage='sha256:c7526c0f6c3f30260a563d7bcf8ad778effac59a44f8ffa86678c35418338609';
const apiImage='sha256:bea1c76a856fa39d1e542d25911cf95d02fe2bf971992d033044ff209f1504b8';
const secrets=[password,jwt];
function safe(value){let text=String(value);for(const secret of secrets)text=text.split(secret).join('[REDACTED]');return text;}
function run(binary,args,options={}) {
  return new Promise((resolve,reject)=>{
    const child=spawn(binary,args,{cwd:here,stdio:['ignore','pipe','pipe'],windowsHide:true,...options});
    let out='',err='';const timer=setTimeout(()=>child.kill(),options.timeout??60000);
    child.stdout.on('data',chunk=>{out+=chunk;if(options.stream)process.stdout.write(safe(chunk));});
    child.stderr.on('data',chunk=>{err+=chunk;if(options.stream)process.stderr.write(safe(chunk));});
    child.on('error',error=>{clearTimeout(timer);reject(new Error(safe(error.message)));});
    child.on('close',code=>{clearTimeout(timer);code===0?resolve(out.trim()):reject(new Error(options.stream?`streamed child exited ${code}`:safe(err||out||`child exit ${code}`)));});
  });
}
const docker=(...args)=>run('docker',['--config',root,...args]);
async function connect(database,port){const client=new Client({host:'127.0.0.1',port,user:'postgres',password,database,ssl:false,
  connectionTimeoutMillis:2000,statement_timeout:15000,lock_timeout:3000});await client.connect();return client;}
async function bootstrap(client){
  // Bucket metadata compatibility bootstrap only; not a Storage API fixture.
  await client.query(`create schema storage;create table storage.buckets(id text primary key,name text not null,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
    grant usage on schema public to anon,authenticated,service_role;`);
}
async function migrations(client,populated=false){
  const folder=new URL('../../supabase/migrations/',import.meta.url),files=readdirSync(folder).filter(name=>name.endsWith('.sql')).sort();
  let seeded=false;
  for(const name of files){
    if(name==='20261019190000_shopify_import_preview.sql'){
      await client.query(readFileSync(new URL('../../docs/sql/20261019_unified_orders_preflight.readonly.sql',import.meta.url),'utf8'));
      console.log('PASS read-only unified migration catalogue preflight on fictional baseline');
    }
    if(populated&&!seeded&&name.startsWith('20261008')){
      await client.query("insert into tenants(id,name,slug,store_name) values('10000000-0000-4000-8000-000000000001','Fictional upgrade shop','fictional-upgrade','Fictional');insert into customers(tenant_id,name,normalized_phone_e164) values('10000000-0000-4000-8000-000000000001','Fictional legacy customer','+919000000001');insert into orders(tenant_id,order_number,customer_id,tracking_token,total_amount) select tenant_id,'',id,'fictional-upgrade-token',100 from customers;");
      seeded=true;
    }
    // Every real file, unchanged and committed independently (enum boundaries).
    if(name==='20261014131000_shopify_handover_guards.sql'){
      // Fictional shape of the independently installed optional handover module.
      // Do not copy its implementation or claim its RPC/UI acceptance here.
      await client.query(`create table order_handovers(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references tenants(id),order_id uuid not null references orders(id),
        handover_number text not null,handover_type delivery_type not null,handed_over_at timestamptz not null,balance_acknowledged boolean not null,recipient_name text,status text not null default 'active',internal_notes text,deleted_at timestamptz);
        create table order_handover_items(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,order_id uuid not null,handover_id uuid not null references order_handovers(id),
          order_item_id uuid not null references order_items(id),quantity numeric not null default 1,pre_handover_item_status item_status,deleted_at timestamptz);
        alter table order_handovers enable row level security;alter table order_handover_items enable row level security;
        grant all on order_handovers,order_handover_items to service_role;`);
    }
    try{await client.query(readFileSync(new URL(name,folder),'utf8'));}
    catch(error){throw new Error(`Migration ${name}: ${error.code} ${error.message}`);}
  }
  if(populated){
    const old=await client.query("select source,financial_management,total_amount from orders where tracking_token='fictional-upgrade-token'");
    assert.equal(old.rows.length,1);assert.equal(old.rows[0].financial_management,'local');assert.equal(Number(old.rows[0].total_amount),100);
    const flags=await client.query("select column_default from information_schema.columns where table_name='shopify_connections' and column_name in ('intake_enabled','processing_enabled','draft_import_enabled','release_enabled')");
    assert.equal(flags.rows.length,4);assert.ok(flags.rows.every(row=>row.column_default==='false'));
  }
  console.log(`PASS ${populated?'populated upgrade':'empty reset'}: ${files.length} unchanged migrations`);
}
let admin;
try{
  // Dedicated bridge, explicitly loopback-published ports. Docker Desktop's
  // internal-only bridge suppressed publication in the first local run.
  // This is data/environment isolation, not a claimed outbound air gap.
  await docker('network','create','--label',`${label}=${nonce}`,names.network);
  await docker('run','--rm','-d','--name',names.db,'--label',`${label}=${nonce}`,'--network',names.network,'--network-alias','db',
    '--memory','1g','--cpus','2','--tmpfs','/var/lib/postgresql/data:rw,size=536870912','-p','127.0.0.1::5432',
    '-e',`POSTGRES_PASSWORD=${password}`,'-e','PGDATA=/var/lib/postgresql/data/pgdata',pgImage);
  const published=await docker('port',names.db,'5432/tcp');assert.match(published,/^127\.0\.0\.1:\d+$/);const port=Number(published.split(':')[1]);
  for(let attempt=0;attempt<40;attempt++){try{admin=await connect('postgres',port);break;}catch{await new Promise(resolve=>setTimeout(resolve,250));}}
  assert.ok(admin,'local disposable database did not become ready');
  const version=await admin.query('show server_version');console.log(`Local PostgreSQL ${version.rows[0].server_version}`);
  await admin.query(`create role anon;create role authenticated;create role service_role bypassrls;create role authenticator login noinherit password '${password}';grant anon,authenticated,service_role to authenticator;`);
  const databases={};
  for(const suffix of ['intake','worker','draft','reset','upgrade']){
    const name=`shopify_${suffix}_${nonce}`;databases[suffix]=name;await admin.query(`create database "${name}"`);
    await admin.query(`comment on database "${name}" is '${marker}'`);
  }
  for(const suffix of ['reset','upgrade']){const client=await connect(databases[suffix],port);try{await bootstrap(client);await migrations(client,suffix==='upgrade');}finally{await client.end();}}
  const env={...process.env,OSPLUS_SHOPIFY_DISPOSABLE_NONCE:nonce,OSPLUS_SHOPIFY_DISPOSABLE_PORT:String(port),OSPLUS_SHOPIFY_DISPOSABLE_PASSWORD:password};
  await run(process.execPath,['--experimental-strip-types','--conditions=react-server','--test','intake-db.test.mjs','worker-db.test.mjs','draft-import-db.test.mjs'],{env,stream:true,timeout:60000});
  await docker('run','--rm','-d','--name',names.api,'--label',`${label}=${nonce}`,'--network',names.network,'--memory','256m','-p','127.0.0.1::3000',
    '-e',`PGRST_DB_URI=postgres://authenticator:${password}@db:5432/${databases.upgrade}`,'-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e',`PGRST_JWT_SECRET=${jwt}`,apiImage);
  const apiPublished=await docker('port',names.api,'3000/tcp');assert.match(apiPublished,/^127\.0\.0\.1:\d+$/);
  await run(process.execPath,['--experimental-strip-types','--conditions=react-server','--test','docker-cases.test.mjs'],{
    env:{...env,OSPLUS_SHOPIFY_DISPOSABLE_API_PORT:apiPublished.split(':')[1],OSPLUS_SHOPIFY_DISPOSABLE_JWT:jwt},stream:true,timeout:60000});
  console.log('PASS disposable PostgreSQL/PostgREST verification; no shared environment used');
}catch(error){console.error(safe(error.message));process.exitCode=1;}
finally{
  await admin?.end().catch(()=>{});
  const failures=await cleanupOwned({docker,names,label,nonce});
  for(const failure of failures)console.error(`Cleanup ${failure.name}: ${safe(failure.message)}`);
  if(failures.length)process.exitCode=1;
  console.log(cleanupSummary(failures));
}
