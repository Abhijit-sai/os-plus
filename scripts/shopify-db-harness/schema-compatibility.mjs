// Approved SELECT-only shared check; all migration execution is fictional only.
// No production DDL/DML, rows, plaintext definitions, env/CLI secrets or dumps.
import { spawn } from 'node:child_process';
import { randomBytes,createHash } from 'node:crypto';
import { readFile,readdir,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { validateInput,image } from './private-backup-contract.mjs';
import { catalogueSql,differences,cleanupReference,canonicalRowsQuery } from './schema-catalogue.mjs';
import { parseRows } from './private-backup-rows.mjs';
import { readOnlyPreflight } from './readonly-preflight.mjs';
import { candidateTableNames,compareInstalledCandidates,inspectInstalledState,catalogueLfSql } from './post-migration-checks.mjs';
const root=fileURLToPath(new URL('../..',import.meta.url));
const nonce=randomBytes(16).toString('hex'),name=`osplus-schema-reference-${nonce}`,label='osplus.schema.reference';
const report={kind:'osplus-private-backup-report-v1',check:'schema-compatibility-v1',status:'failed',productionWrites:false,
  mayApply:false,mayDeploy:false,mayActivate:false,step:'input'};
let source,created=false;const children=new Set();
function docker(args,input=''){
  return new Promise((resolve,reject)=>{
    const child=spawn('C:/Program Files/Docker/Docker/resources/bin/docker.exe',['--config',root,...args],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe']});
    children.add(child);let out='',size=0;const timer=setTimeout(()=>child.kill(),30000);
    child.stdout.on('data',c=>{size+=c.length;if(size>2000000)child.kill();else out+=c;});
    child.stderr.resume();child.stdin.on('error',()=>{});child.stdin.end(input);
    child.once('error',()=>reject(new Error('REFERENCE_COMMAND_FAILED')));
    child.once('close',c=>{clearTimeout(timer);children.delete(child);c===0&&size<=2000000?resolve(out.trim()):reject(new Error('REFERENCE_COMMAND_FAILED'));});
  });
}
const sql=text=>docker(['exec','-i',name,'psql','-X','--no-password','--set','ON_ERROR_STOP=1','-At','-U','postgres','-d','postgres'],text);
const rows=async query=>parseRows(await sql(canonicalRowsQuery(query)));
async function reference(postMigration=false){
  report.step='fictional_reference';
  const folder=new URL('../../supabase/migrations/',import.meta.url);
  const files=(await readdir(folder)).filter(f=>/^\d{14}_[a-z0-9_]+\.sql$/.test(f)).sort();
  const manifest=JSON.parse(await readFile(new URL('../../docs/shopify-hosted-test-package.json',import.meta.url),'utf8'));
  if(manifest.mayApply!==false||manifest.mayDeploy!==false||manifest.mayActivate!==false||manifest.applicationArtifact!==null)throw new Error('PACKAGE_GATE_INVALID');
  const candidates=files.filter(f=>f.includes('_shopify_'));
  if(JSON.stringify(candidates)!==JSON.stringify(manifest.migrations.map(m=>m.file)))throw new Error('PACKAGE_LIST_INVALID');
  const content=new Map(),hashes=[];
  for(const file of files){const bytes=await readFile(new URL(file,folder));const hash=createHash('sha256').update(bytes).digest('hex');
    const pinned=manifest.migrations.find(m=>m.file===file);if(pinned&&(pinned.bytes!==bytes.length||pinned.sha256!==hash))throw new Error('PACKAGE_CHECKSUM_INVALID');
    content.set(file,bytes.toString('utf8'));hashes.push({file,sha256:hash});}
  created=true;
  await docker(['run','--rm','--pull','never','-d','--name',name,'--label',`${label}=${nonce}`,'--network','none','--log-driver','none',
    '--memory','768m','--tmpfs','/var/lib/postgresql/data:rw,size=536870912','--security-opt','no-new-privileges',
    '-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','PGDATA=/var/lib/postgresql/data/pgdata',image]);
  const config=JSON.parse(await docker(['inspect',name]))[0];
  if(config.HostConfig.NetworkMode!=='none'||config.HostConfig.LogConfig.Type!=='none'||Object.keys(config.HostConfig.PortBindings??{}).length||config.Mounts.some(m=>m.Type!=='tmpfs'))throw new Error('REFERENCE_ISOLATION_INVALID');
  let ready=false;for(let i=0;i<40;i++){try{await docker(['exec',name,'pg_isready','-U','postgres']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,250));}}
  if(!ready)throw new Error('REFERENCE_NOT_READY');
  await sql(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon,authenticated,service_role;
    GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;`);
  for(const file of files.filter(f=>!candidates.includes(f))){report.referenceFile=file;await sql('BEGIN;\n'+content.get(file)+'\nCOMMIT;');}
  if(postMigration){
    // Fictional minimal relations only, so the conditional Shopify triggers can
    // be compared. This does not read or implement the owning handover module.
    await sql(`CREATE TABLE public.order_handovers(id uuid,tenant_id uuid,order_id uuid);
      CREATE TABLE public.order_handover_items(id uuid,tenant_id uuid,order_id uuid);`);
  }
  const baseline=await rows(catalogueSql);
  const baselineLf=postMigration?await rows(catalogueLfSql):null;
  for(const file of candidates){report.referenceFile=file;await sql('BEGIN;\n'+content.get(file)+'\nCOMMIT;');}
  const proposed=await rows(catalogueSql);
  const proposedLf=postMigration?await rows(catalogueLfSql):null;
  delete report.referenceFile;
  report.reference={historicalFiles:files.length-candidates.length,candidateFiles:candidates.length,
    historicalSetSha256:createHash('sha256').update(JSON.stringify(hashes.filter(h=>!candidates.includes(h.file)))).digest('hex'),
    historicalHashes:hashes.filter(h=>!candidates.includes(h.file)),candidateChecksumsVerified:true,fictionalOnly:true,perFileTransaction:true,
    serverVersion:(await rows("SELECT current_setting('server_version_num') AS version"))[0].version};
  report.proposedImpact=differences(baseline,proposed);
  return {baseline,proposed,baselineLf,proposedLf,tables:candidateTableNames(candidates.map(f=>content.get(f)))};
}
async function input(){let size=0;const parts=[];const timer=setTimeout(()=>process.stdin.destroy(),10000);
  try{for await(const c of process.stdin){size+=c.length;if(size>65536)throw new Error('INPUT_LIMIT');parts.push(c);}}finally{clearTimeout(timer);}
  const access=validateInput(JSON.parse(Buffer.concat(parts).toString('utf8')));if(access.mode!=='Inspect')throw new Error('READ_ONLY_MODE_REQUIRED');return access;}
const deadline=setTimeout(()=>{for(const c of children)c.kill();source?.end().catch(()=>{});},240000);
try{
  if(process.argv.length>3||process.argv.length===3&&!['--reference-only','--post-migration'].includes(process.argv[2]))throw new Error('ARGUMENTS_REJECTED');
  const referenceOnly=process.argv[2]==='--reference-only';
  const postMigration=process.argv[2]==='--post-migration';
  const access=referenceOnly?null:await input();const {baseline,proposed,baselineLf,proposedLf,tables}=await reference(postMigration);
  if(referenceOnly){report.status='fictional_reference_verified';report.productionConnection=false;}
  else{
  report.step='readonly_source';
  source=new Client({host:access.host,port:access.port,user:access.user,database:access.database,password:access.password,
    application_name:'osplus_approved_readonly_schema_check',ssl:{ca:access.ca,rejectUnauthorized:true,minVersion:'TLSv1.2'},
    connectionTimeoutMillis:10000,query_timeout:20000,statement_timeout:15000,lock_timeout:1500,
    options:'-c default_transaction_read_only=on -c idle_in_transaction_session_timeout=60000 -c timezone=UTC'});
  source.on('error',()=>{});await source.connect();access.password=null;
  await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await source.query('SET LOCAL search_path=pg_catalog');
  const identity=(await source.query(`SELECT current_database() AS database,current_user AS username,current_setting('server_version_num') AS version,
    current_setting('transaction_read_only') AS readonly,transaction_timestamp() AS time,to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS history`)).rows[0];
  if(identity.database!=='postgres'||identity.username!=='postgres'||identity.readonly!=='on'||Number(identity.version)<170000||Number(identity.version)>=180000)throw new Error('SOURCE_IDENTITY_INVALID');
  report.snapshotTime=identity.time.toISOString();report.serverVersion=identity.version;report.readOnlyTransactionVerified=true;report.historyPresent=identity.history;
  if(identity.history){report.history=(await source.query('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version')).rows.map(r=>r.version);}
  report.step='catalogue_compare';const live=(await source.query(catalogueSql)).rows;
  if(postMigration){
    report.check='post-migration-readonly-v1';report.productionConnection=true;
    report.projectRef=access.projectRef;report.liveCatalogueObjects=live.length;
    report.candidateComparison=compareInstalledCandidates(baseline,proposed,live);
    report.lineEndingNormalizedComparison=compareInstalledCandidates(baselineLf,proposedLf,(await source.query(catalogueLfSql)).rows);
    report.shopifyPreflight=await readOnlyPreflight(source);
    report.installedState=await inspectInstalledState(source,tables);
    const p=report.shopifyPreflight;
    report.status=report.candidateComparison.passed&&report.installedState.passed&&report.installedState.triggerGrantFindings.length===0&&
      Object.values(p.orderSafety).every(n=>n===0)&&p.pilot.matches===1&&p.pilot.active===true&&
      p.missingPrerequisiteTables.length===0&&p.setUpdatedAtPresent?'post_migration_checks_passed':'post_migration_findings';
  }else{
  report.baselineDifferences=differences(baseline,live);report.liveCatalogueObjects=live.length;
  const newObjects=differences(baseline,proposed).extra;
  const liveKeys=new Set(live.map(o=>`${o.kind}:${o.name}`));
  report.candidateConflicts=newObjects.filter(o=>liveKeys.has(`${o.kind}:${o.name}`));
  report.orderSafety=(await source.query(await readFile(new URL('../shopify-hosted-compatibility-check.sql',import.meta.url),'utf8'))).rows[0].result;
  report.orderSafety.customer_indexes=report.orderSafety.customer_indexes.map(i=>({name:i.name,sha256:createHash('sha256').update(i.definition).digest('hex')}));
  report.pilot=(await source.query(`SELECT count(*)::int AS matches,bool_and(status::text='active') AS active FROM public.tenants WHERE id=$1`,['7be40f50-94a0-46c5-af57-7eea5e36ea8a'])).rows[0];
  report.roles=(await source.query("SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') ORDER BY rolname")).rows;
  // Narrow semantic explanation of UUID-only drift; no default expressions or
  // function bodies leave PostgreSQL. Unknown values remain unresolved.
  report.uuidDefaults=(await source.query(`SELECT c.relname AS table_name,a.attname AS column_name,
    format_type(a.atttypid,a.atttypmod)='uuid' AS uuid_type,a.attnotnull AS not_null,
    pg_get_expr(d.adbin,d.adrelid)='gen_random_uuid()' AS unqualified_builtin,
    pg_get_expr(d.adbin,d.adrelid)='extensions.gen_random_uuid()' AS qualified_extension,
    (SELECT coalesce(jsonb_agg(jsonb_build_object('schema',pn.nspname,'function',p.proname,'extension',e.extname)), '[]'::jsonb)
     FROM pg_depend dep JOIN pg_proc p ON dep.refclassid='pg_proc'::regclass AND dep.refobjid=p.oid JOIN pg_namespace pn ON pn.oid=p.pronamespace
     LEFT JOIN pg_depend member ON member.classid='pg_proc'::regclass AND member.objid=p.oid AND member.deptype='e'
     LEFT JOIN pg_extension e ON e.oid=member.refobjid
     WHERE dep.classid='pg_attrdef'::regclass AND dep.objid=d.oid) AS function_dependencies
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname='public' AND c.relkind='r' AND a.attname='id' AND a.atttypid='uuid'::regtype ORDER BY c.relname`)).rows;
  report.itemStatusLabels=(await source.query(`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='item_status' ORDER BY e.enumsortorder`)).rows.map(r=>r.enumlabel);
  report.status='checked_not_approved';
  }
  await source.query('ROLLBACK');
  report.step='complete';
  }
}catch(error){report.code=/^[A-Z0-9_]{1,64}$/.test(error.message??'')?error.message:'SCHEMA_CHECK_FAILED';
  if(/^[A-Z0-9]{5}$/.test(error.code??''))report.sqlState=error.code;process.exitCode=1;}
finally{
  await source?.end().catch(()=>{});clearTimeout(deadline);
  const clean=!created||await cleanupReference({docker,name,label,nonce});if(!clean)process.exitCode=1;
  report.disposableCleanupComplete=clean;
  if(report.status!=='failed'&&clean){
    const reportFile=new URL(`../../docs/shopify-schema-check-${nonce}.json`,import.meta.url);
    report.evidenceFile=fileURLToPath(reportFile);
    await writeFile(reportFile,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  }
  // Names/hash differences only; never emit credentials or source definitions.
  const display={...report};
  if(display.reference){display.reference={...display.reference};delete display.reference.historicalHashes;}
  for(const field of ['proposedImpact','baselineDifferences'])if(display[field])display[field]=Object.fromEntries(
    Object.entries(display[field]).map(([key,value])=>[key,{count:value.length,objects:value.slice(0,12).map(o=>`${o.kind}:${o.name}`)}]));
  if(display.candidateConflicts)display.candidateConflicts=display.candidateConflicts.map(o=>`${o.kind}:${o.name}`);
  if(display.uuidDefaults)display.uuidDefaults={count:display.uuidDefaults.length,
    qualifiedPgcrypto:display.uuidDefaults.filter(c=>c.qualified_extension&&c.function_dependencies.some(d=>d.extension==='pgcrypto'&&d.schema==='extensions'&&d.function==='gen_random_uuid')).length};
  process.stdout.write(JSON.stringify(display));
}
