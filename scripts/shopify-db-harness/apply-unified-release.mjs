// One concrete owner-approved deployment, not a general SQL executor.
// No source Shopify, production-tenant DML, policy activation or raw secret output.
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {Client} from 'pg';
import {validateInput,identifier} from './private-backup-contract.mjs';
import {catalogueSql} from './schema-catalogue.mjs';
const tenant='7be40f50-94a0-46c5-af57-7eea5e36ea8a',connection='1f5b0ada-2a00-437a-8db4-998cbec972fe';
const backupRun='bc0ced99e3c54e03aac4edff648b5343';
const report={kind:'osplus-private-backup-report-v1',status:'failed',step:'input',migrationsApplied:[],productionTenantWrites:false,importsActivated:false};
const catalogue=catalogueSql.replace('md5(definition) AS hash',"md5(replace(definition,chr(13)||chr(10),chr(10))) AS hash");
const key=o=>`${o.kind}:${o.name}`;
let db,paused=false,original,pausedRevision;
const auditActor='deployment:owner-approved-unified-release';
async function transaction(work){await db.query('begin read write');try{await db.query("set local lock_timeout='1500ms';set local statement_timeout='30s'");const r=await work();await db.query('commit');return r;}catch(e){await db.query('rollback').catch(()=>{});throw e;}}
async function audit(action,before,after){await db.query(`insert into public.shopify_application_audit(tenant_id,connection_id,actor_id,request_key,action,intent_digest,detail,result)
  values($1,$2,$3,$4,$5,'approved-seven-file-release-v1',$6::jsonb,$7::jsonb)`,[tenant,connection,auditActor,randomUUID(),action,
  JSON.stringify({execution:'owner-authorized-database-maintenance',businessWrites:false,before}),JSON.stringify(after)]);}
async function restore(){
  await transaction(async()=>{
    const now=(await db.query('select revision,status,intake_enabled,processing_enabled,draft_import_enabled from public.shopify_connections where tenant_id=$1 and id=$2 for update',[tenant,connection])).rows[0];
    if(now?.revision!==pausedRevision||now.status!=='paused'||now.intake_enabled||now.processing_enabled)throw new Error('MAINTENANCE_STATE_CHANGED');
    const restored=(await db.query(`update public.shopify_connections set status=$3,intake_enabled=$4,processing_enabled=$5,draft_import_enabled=$6
      where tenant_id=$1 and id=$2 returning revision,status,intake_enabled,processing_enabled,draft_import_enabled`,[tenant,connection,original.status,original.intake_enabled,original.processing_enabled,original.draft_import_enabled])).rows[0];
    await audit('unified_deployment_resume',now,restored);report.connectionRestored=true;
  });paused=false;
}
try{
  if(process.argv.length!==3||process.argv[2]!=='--owner-approved-seven-migrations')throw new Error('APPROVAL_REQUIRED');
  let size=0,parts=[];for await(const c of process.stdin){size+=c.length;if(size>65536)throw new Error('INPUT_LIMIT');parts.push(c);}
  const access=validateInput(JSON.parse(Buffer.concat(parts).toString('utf8')));parts=[];
  if(access.mode!=='Inspect')throw new Error('INPUT_MODE_INVALID');
  report.step='verified_backup';
  const archive=path.join(access.privateRoot,'backup-'+backupRun);
  const candidates=(await readdir(archive)).filter(n=>/^verification-[a-f0-9]{32}\.json$/.test(n));
  const recoveries=await Promise.all(candidates.map(async n=>JSON.parse(await readFile(path.join(archive,n),'utf8'))));
  const recovery=recoveries.find(r=>r.status==='verified'&&r.restoreVerified&&r.savedRecoverySetVerified&&r.disposableCleanupComplete);
  if(!recovery||Date.now()-Date.parse(recovery.snapshotTime)>3600000)throw new Error('FRESH_RECOVERY_REQUIRED');
  report.backup={run:backupRun,snapshotTime:recovery.snapshotTime,archiveSha256:recovery.archiveSha256,verifiedTables:recovery.verifiedTables};
  const evidence=JSON.parse(await readFile(new URL('../../outputs/shopify-unified/deployment-reference.json',import.meta.url),'utf8'));
  const gate=JSON.parse(await readFile(new URL('../../outputs/shopify-unified/hosted-preflight.json',import.meta.url),'utf8'));
  if(gate.affectedObjectDrift.missing.length||gate.affectedObjectDrift.changed.length||gate.productionWrites!==false||evidence.manifest.length!==7)throw new Error('PREFLIGHT_INVALID');
  const contents=[];for(const m of evidence.manifest){
    if(!/^20261019\d{6}_shopify_[a-z_]+\.sql$/.test(m.file))throw new Error('MANIFEST_INVALID');
    const bytes=await readFile(new URL('../../supabase/migrations/'+m.file,import.meta.url));
    if(createHash('sha256').update(bytes).digest('hex')!==m.sha256)throw new Error('MANIFEST_CHANGED');
    contents.push({file:m.file,sha256:m.sha256,sql:bytes.toString('utf8')});
  }
  report.step='fresh_readonly_gate';
  db=new Client({host:access.host,port:access.port,user:access.user,password:access.password,database:access.database,
    ssl:{ca:access.ca,rejectUnauthorized:true,minVersion:'TLSv1.2'},application_name:'osplus_owner_approved_unified_migrations',
    connectionTimeoutMillis:10000,query_timeout:40000,options:'-c default_transaction_read_only=on -c idle_in_transaction_session_timeout=60000'});
  db.on('error',()=>{});await db.connect();access.password=null;
  await db.query(await readFile(new URL('../../docs/sql/20261019_unified_orders_preflight.readonly.sql',import.meta.url),'utf8'));
  await db.query('begin read only;set local search_path=pg_catalog');
  const identity=(await db.query("select current_database() as db,current_user as actor,current_setting('transaction_read_only') as ro")).rows[0];
  if(identity.db!=='postgres'||identity.actor!=='postgres'||identity.ro!=='on')throw new Error('IDENTITY_INVALID');
  const before=(await db.query(catalogue)).rows;
  if(JSON.stringify(before)!==JSON.stringify(evidence.live))throw new Error('LIVE_SCHEMA_CHANGED');
  const bindings=(await db.query(`select c.id,c.tenant_id,c.canonical_domain,c.environment,c.status,c.revision,c.intake_enabled,c.processing_enabled,c.draft_import_enabled,t.name,t.status as tenant_status
    from public.shopify_connections c join public.tenants t on t.id=c.tenant_id`)).rows;
  original=bindings[0];if(bindings.length!==1||original.id!==connection||original.tenant_id!==tenant||original.canonical_domain!=='n1djr1-99.myshopify.com'||original.name!=='Phantom Threads Test'||original.tenant_status!=='active'||original.status!=='verified')throw new Error('TEST_BINDING_INVALID');
  const tables=(await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'
    and exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='tenant_id' and not a.attisdropped) order by c.relname`)).rows;
  const digestQuery=tables.map(t=>`select '${t.relname}' as name,count(*)::text as rows,md5(coalesce(string_agg(h,' ' order by h),'')) as hash from
    (select md5(row_to_json(r)::text) as h from public.${identifier(t.relname)} r where tenant_id<>'${tenant}') q`).join(' union all ')+' order by name';
  const productionBefore=(await db.query(digestQuery)).rows;
  await db.query('commit');
  report.step='pause_test_only';
  await transaction(async()=>{
    const current=(await db.query('select revision from public.shopify_connections where tenant_id=$1 and id=$2 for update',[tenant,connection])).rows[0];
    if(current?.revision!==original.revision)throw new Error('TEST_STATE_CHANGED');
    const jobs=(await db.query('select count(*)::int as busy from public.shopify_sync_jobs where tenant_id=$1 and connection_id=$2 and (requested_generation>completed_generation or lease_token is not null)',[tenant,connection])).rows[0];
    if(jobs.busy!==0)throw new Error('TEST_JOBS_BUSY');
    const result=(await db.query("update public.shopify_connections set status='paused',processing_enabled=false,intake_enabled=false where tenant_id=$1 and id=$2 returning revision,status,intake_enabled,processing_enabled,draft_import_enabled",[tenant,connection])).rows[0];
    pausedRevision=result.revision;await audit('unified_deployment_pause',{revision:original.revision,status:original.status,intake_enabled:original.intake_enabled,processing_enabled:original.processing_enabled},result);
  });paused=true;
  for(const m of contents){report.step=m.file;await transaction(()=>db.query(m.sql));report.migrationsApplied.push({file:m.file,sha256:m.sha256});}
  report.step='post_migration_readonly';
  await db.query('begin read only;set local search_path=pg_catalog');
  const after=(await db.query(catalogue)).rows;
  const expectedKeys=new Set([...evidence.impact.changed,...evidence.impact.extra].map(key));
  const required=evidence.proposed.filter(o=>expectedKeys.has(key(o)));
  const actualMap=new Map(after.map(o=>[key(o),o.hash]));
  const mismatches=required.filter(o=>actualMap.get(key(o))!==o.hash);
  const unchanged=before.filter(o=>!expectedKeys.has(key(o)));
  const unexpectedChanges=unchanged.filter(o=>actualMap.get(key(o))!==o.hash);
  report.schemaChecks={requiredObjects:required.length,mismatches:mismatches.map(key),unexpectedChanges:unexpectedChanges.map(key)};
  if(mismatches.length||unexpectedChanges.length)throw new Error('POST_SCHEMA_MISMATCH');
  const newTables=evidence.impact.extra.filter(o=>o.kind==='relation'&&o.name.startsWith('shopify_')).map(o=>o.name);
  const counts=(await db.query(newTables.map(n=>`select '${n}' as name,count(*)::int as rows from public.${identifier(n)}`).join(' union all '))).rows;
  if(counts.some(r=>r.rows!==0))throw new Error('UNEXPECTED_ACTIVATION');report.newTablesEmpty=counts.length;
  const productionAfter=(await db.query(digestQuery)).rows;
  report.productionTenantDataUnchanged=JSON.stringify(productionBefore)===JSON.stringify(productionAfter);
  if(!report.productionTenantDataUnchanged)throw new Error('NON_TEST_DATA_CHANGED_DURING_WINDOW');
  await db.query('commit');
  await restore();
  await transaction(()=>db.query("notify pgrst, 'reload schema'"));
  report.status='migrations_verified';report.step='complete';
}catch(error){await db?.query('rollback').catch(()=>{});report.code=/^[A-Z_]+$/.test(error.message??'')?error.message:'DEPLOYMENT_STEP_FAILED';if(/^[A-Z0-9]{5}$/.test(error.code??''))report.sqlState=error.code;process.exitCode=1;}
finally{
  report.testConnectionPaused=paused;
  // On a partial migration/verification failure leave Test paused for inspection.
  await db?.end().catch(()=>{});
  try{await writeFile(new URL('../../outputs/shopify-unified/migration-result.json',import.meta.url),JSON.stringify(report,null,2));}catch{report.reportSaved=false;}
  process.stdout.write(JSON.stringify(report));
}
