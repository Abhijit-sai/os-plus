// Live access is READ ONLY. Candidate SQL executes only in an isolated fictional
// Docker reference. Credentials arrive over the protected wrapper's stdin pipe.
import {spawn} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Client} from 'pg';
import {validateInput,image} from './private-backup-contract.mjs';
import {catalogueSql,differences,canonicalRowsQuery,cleanupReference} from './schema-catalogue.mjs';
import {parseRows} from './private-backup-rows.mjs';
const root=fileURLToPath(new URL('../..',import.meta.url));
const nonce=randomBytes(12).toString('hex'),name=`osplus-unified-preflight-${nonce}`,label='osplus.unified.preflight';
const report={kind:'osplus-private-backup-report-v1',check:'unified-readonly-preflight',status:'failed',productionWrites:false,step:'input'};
const catalogue=catalogueSql.replace('md5(definition) AS hash',"md5(replace(definition,chr(13)||chr(10),chr(10))) AS hash");
const children=new Set();let source,created=false;
function docker(args,input=''){
  return new Promise((resolve,reject)=>{
    const c=spawn('C:/Program Files/Docker/Docker/resources/bin/docker.exe',['--config',root,...args],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe']});
    children.add(c);let out='',size=0;const timer=setTimeout(()=>c.kill(),30000);
    c.stdout.on('data',v=>{size+=v.length;if(size>4000000)c.kill();else out+=v;});c.stderr.resume();c.stdin.on('error',()=>{});c.stdin.end(input);
    c.once('error',()=>reject(new Error('LOCAL_REFERENCE_FAILED')));
    c.once('close',code=>{clearTimeout(timer);children.delete(c);code===0&&size<=4000000?resolve(out.trim()):reject(new Error('LOCAL_REFERENCE_FAILED'));});
  });
}
const localSql=q=>docker(['exec','-i',name,'psql','-X','--no-password','--set','ON_ERROR_STOP=1','-At','-U','postgres','-d','postgres'],q);
const localRows=async q=>parseRows(await localSql(canonicalRowsQuery(q)));
const key=o=>`${o.kind}:${o.name}`;
try{
  let size=0,parts=[];for await(const c of process.stdin){size+=c.length;if(size>65536)throw new Error('INPUT_LIMIT');parts.push(c);}
  const access=validateInput(JSON.parse(Buffer.concat(parts).toString('utf8')));parts=[];
  if(access.mode!=='Inspect')throw new Error('READ_ONLY_REQUIRED');
  report.step='manifest';
  const folder=new URL('../../supabase/migrations/',import.meta.url);
  const files=(await readdir(folder)).filter(n=>/^\d{14}_[a-z0-9_]+\.sql$/.test(n)).sort();
  const manifest=await readFile(new URL('../../docs/43_Shopify_Unified_Migration_Manifest.md',import.meta.url),'utf8');
  const approved=[...manifest.matchAll(/`(20261019\d{6}_[a-z0-9_]+\.sql)` \| `([A-F0-9]{64})`/g)].map(m=>({file:m[1],sha256:m[2].toLowerCase()}));
  if(approved.length!==7)throw new Error('MANIFEST_INVALID');
  const candidates=files.filter(n=>n>=approved[0].file);
  if(JSON.stringify(candidates)!==JSON.stringify(approved.map(m=>m.file)))throw new Error('MANIFEST_INVALID');
  const content=new Map();for(const f of files){const b=await readFile(new URL(f,folder));content.set(f,b.toString('utf8'));
    const pin=approved.find(x=>x.file===f);if(pin&&createHash('sha256').update(b).digest('hex')!==pin.sha256)throw new Error('MANIFEST_INVALID');}
  report.manifest=approved;
  report.step='fictional_reference';created=true;
  await docker(['run','--rm','--pull','never','-d','--name',name,'--label',`${label}=${nonce}`,'--network','none','--log-driver','none','--memory','768m',
    '--tmpfs','/var/lib/postgresql/data:rw,size=536870912','--security-opt','no-new-privileges','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','PGDATA=/var/lib/postgresql/data/pgdata',image]);
  const config=JSON.parse(await docker(['inspect',name]))[0];
  if(config.HostConfig.NetworkMode!=='none'||config.HostConfig.LogConfig.Type!=='none'||config.Mounts.some(m=>m.Type!=='tmpfs'))throw new Error('ISOLATION_INVALID');
  let ready=false;for(let i=0;i<40;i++){try{await docker(['exec',name,'pg_isready','-U','postgres']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,250));}}
  if(!ready)throw new Error('LOCAL_REFERENCE_FAILED');
  await localSql(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema storage;create table storage.buckets(id text primary key,name text not null,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
    grant usage on schema public to anon,authenticated,service_role;`);
  for(const f of files.filter(n=>!candidates.includes(n))){
    if(f==='20261014131000_shopify_handover_guards.sql')await localSql('create table public.order_handovers(id uuid,tenant_id uuid,order_id uuid);create table public.order_handover_items(id uuid,tenant_id uuid,order_id uuid);');
    report.referenceFile=f;await localSql('begin;\n'+content.get(f)+'\ncommit;');
  }
  const baseline=await localRows(catalogue);
  for(const f of candidates){report.referenceFile=f;await localSql('begin;\n'+content.get(f)+'\ncommit;');}
  const proposed=await localRows(catalogue);delete report.referenceFile;
  const impact=differences(baseline,proposed);report.impact={extra:impact.extra.map(key),changed:impact.changed.map(key),removed:impact.missing.map(key)};
  report.step='live_readonly';
  source=new Client({host:access.host,port:access.port,user:access.user,password:access.password,database:access.database,
    ssl:{ca:access.ca,rejectUnauthorized:true,minVersion:'TLSv1.2'},application_name:'osplus_unified_readonly_preflight',
    connectionTimeoutMillis:10000,statement_timeout:15000,lock_timeout:1500,query_timeout:20000,
    options:'-c default_transaction_read_only=on -c idle_in_transaction_session_timeout=60000'});
  source.on('error',()=>{});await source.connect();access.password=null;
  await source.query(await readFile(new URL('../../docs/sql/20261019_unified_orders_preflight.readonly.sql',import.meta.url),'utf8'));
  await source.query('begin isolation level repeatable read read only;set local search_path=pg_catalog');
  report.identity=(await source.query("select current_database() as database,current_user as actor,current_setting('transaction_read_only') as readonly,transaction_timestamp() as time")).rows[0];
  if(report.identity.database!=='postgres'||report.identity.actor!=='postgres'||report.identity.readonly!=='on')throw new Error('IDENTITY_INVALID');
  const live=(await source.query(catalogue)).rows;
  report.sourceConstraintDiagnostics=(await source.query("SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname IN ('shopify_connections_app_ref_check','shopify_variant_mappings_sku_check') ORDER BY conname")).rows;
  report.sourceAclDiagnostics=(await source.query("SELECT relname,relacl::text,relrowsecurity,relforcerowsecurity,pg_get_userbyid(relowner) AS owner FROM pg_class WHERE oid='public.shopify_release_capabilities'::regclass")).rows;
  const drift=differences(baseline,live),changedKeys=new Set([...impact.changed,...impact.missing].map(key));
  report.fullDrift=drift;
  report.affectedObjectDrift={missing:drift.missing.filter(o=>changedKeys.has(key(o))),changed:drift.changed.filter(o=>changedKeys.has(key(o)))};
  report.connections=(await source.query(`select c.tenant_id,c.id,c.canonical_domain,c.environment,c.status,c.revision,c.intake_enabled,c.processing_enabled,c.draft_import_enabled,
    t.name as tenant_name,t.status as tenant_status from public.shopify_connections c join public.tenants t on t.id=c.tenant_id order by c.id`)).rows;
  report.jobs=(await source.query("select count(*)::int as total,count(*) filter(where requested_generation>completed_generation)::int as pending,count(*) filter(where lease_token is not null)::int as leased from public.shopify_sync_jobs where tenant_id='7be40f50-94a0-46c5-af57-7eea5e36ea8a'")).rows[0];
  await source.query('rollback');
  report.status='review_required';report.step='complete';
  const output=new URL('../../outputs/shopify-unified/',import.meta.url);await mkdir(output,{recursive:true});
  await writeFile(new URL('deployment-reference.json',output),JSON.stringify({baseline,proposed,impact,live,manifest:approved},null,2));
  await writeFile(new URL('hosted-preflight.json',output),JSON.stringify(report,null,2));
  report.evidence='outputs/shopify-unified/hosted-preflight.json';
  report.fullDrift={missing:drift.missing.map(key),changed:drift.changed.map(key),extraCount:drift.extra.length};
  report.impact={extraCount:impact.extra.length,changed:impact.changed.map(key),removed:impact.missing.map(key)};
}catch(error){report.code=/^[A-Z_]+$/.test(error.message??'')?error.message:'PREFLIGHT_FAILED';if(/^[A-Z0-9]{5}$/.test(error.code??''))report.sqlState=error.code;process.exitCode=1;}
finally{for(const c of children)c.kill();await source?.end().catch(()=>{});report.cleanupComplete=!created||await cleanupReference({docker,name,label,nonce});if(!report.cleanupComplete){report.status='failed';process.exitCode=1;}process.stdout.write(JSON.stringify(report));}
