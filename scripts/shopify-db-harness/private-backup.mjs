import { spawn } from 'node:child_process';
import { createHash,randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { writeFile,mkdir,stat } from 'node:fs/promises';
import path from 'node:path';
import { Transform,Readable,Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { validateInput,pgpass,identifier,compatibleServer,archiveHeader,image,label,assertCoverage } from './private-backup-contract.mjs';
import { encryptStream,decryptStream,authenticateArchive } from './private-backup-crypto.mjs';
import { rolesSql,membershipSql,defaultsSql,schemaAclSql,roleFlags,membershipCommands,globalDefaultCommands,schemaAclCommands } from './private-backup-permissions.mjs';
import { rowsQuery,parseRows } from './private-backup-rows.mjs';
import { rehearseShopify,alignVerifiedCloneOwner } from './private-rehearsal.mjs';
import { readOnlyPreflight } from './readonly-preflight.mjs';
import { canonicalBackupCatalogue } from './backup-catalogue-equivalence.mjs';

// No CLI/environment secret input, business rows or raw child/database errors.
const root=fileURLToPath(new URL('../..',import.meta.url));
const dockerPath='C:/Program Files/Docker/Docker/resources/bin/docker.exe';
const report={kind:'osplus-private-backup-report-v1',status:'failed',step:'input',productionWrites:false};
let access,source,folder,nonce,lastChildDiagnostics,localAdmin='postgres';
const resourceNonce=randomBytes(16).toString('hex');
const children=new Set(),containers=[];
const abort=new AbortController();
let deadline=setTimeout(()=>abort.abort(),240000);
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>abort.abort());

async function input(){
  let size=0;const parts=[];
  const timer=setTimeout(()=>process.stdin.destroy(),10000);
  try{for await(const chunk of process.stdin){size+=chunk.length;if(size>65536)throw new Error('INPUT_LIMIT');parts.push(chunk);}}
  finally{clearTimeout(timer);}
  return validateInput(JSON.parse(Buffer.concat(parts).toString('utf8')));
}

function command(args,{bytes,stream=false,timeout=30000}={}){
  const child=spawn(dockerPath,['--config',root,...args],{cwd:root,stdio:['pipe','pipe','pipe'],windowsHide:true});
  children.add(child);
  let out=[],err=[],size=0,stderrBytes=0;
  const timer=setTimeout(()=>child.kill(),timeout);
  const cancel=()=>child.kill();abort.signal.addEventListener('abort',cancel,{once:true});
  // Drain/discard stderr: pg_restore/SQL diagnostics may contain private values.
  child.stderr.on('data',chunk=>{stderrBytes+=chunk.length;if(stderrBytes>262144)child.kill();else err.push(chunk);});
  if(!stream)child.stdout.on('data',chunk=>{size+=chunk.length;if(size>524288)child.kill();else out.push(chunk);});
  child.stdin.on('error',()=>{});
  const done=new Promise((resolve,reject)=>{
    child.once('error',()=>reject(new Error('DOCKER_COMMAND_FAILED')));
    child.once('close',code=>{
      clearTimeout(timer);children.delete(child);abort.signal.removeEventListener('abort',cancel);
      if(code!==0||size>524288||stderrBytes>262144){lastChildDiagnostics=Buffer.concat(err);reject(new Error('DOCKER_COMMAND_FAILED'));}
      else resolve(Buffer.concat(out).toString('utf8').trim());
    });
  });
  // Observe rejection immediately, including while stdout is being pipelined.
  done.catch(()=>{});
  if(bytes!==undefined)child.stdin.end(bytes);
  else if(!stream)child.stdin.end();
  return {child,done};
}
async function docker(args,bytes){return command(args,{bytes}).done;}

const tablesSql=`SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' AND NOT EXISTS
 (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e') ORDER BY c.relname`;
// Stable names/definitions, not OIDs or business values. Hashes stay encrypted.
const catalogueSql=`WITH definitions AS (
 SELECT 'constraint' AS kind,c.conrelid::regclass::text||'.'||c.conname AS name,pg_get_constraintdef(c.oid) AS definition
 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public'
 UNION ALL SELECT 'index',c.relname,pg_get_indexdef(c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='i'
 UNION ALL SELECT 'function',p.oid::regprocedure::text,pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind IN ('f','p') AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
 UNION ALL SELECT 'view',c.relname,pg_get_viewdef(c.oid,true) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('v','m')
 UNION ALL SELECT 'policy',c.relname||'.'||p.polname,concat_ws('|',p.polcmd,p.polpermissive,(SELECT string_agg(coalesce(r.rolname,'PUBLIC'),',' ORDER BY coalesce(r.rolname,'PUBLIC')) FROM unnest(p.polroles) o LEFT JOIN pg_roles r ON r.oid=o),pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid))
 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 UNION ALL SELECT 'trigger',c.relname||'.'||t.tgname,pg_get_triggerdef(t.oid)||'|'||t.tgenabled::text FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
 UNION ALL SELECT 'table_security',c.relname,concat_ws('|',c.relrowsecurity,c.relforcerowsecurity,r.rolname,c.relacl::text) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname='public' AND c.relkind IN ('r','v','m','S')
 UNION ALL SELECT 'schema_security',n.nspname,concat_ws('|',r.rolname,(SELECT string_agg(concat_ws(':',coalesce(g.rolname,'PUBLIC'),gr.rolname,a.privilege_type,a.is_grantable),',' ORDER BY coalesce(g.rolname,'PUBLIC'),gr.rolname,a.privilege_type) FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a LEFT JOIN pg_roles g ON g.oid=a.grantee JOIN pg_roles gr ON gr.oid=a.grantor)) FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner WHERE n.nspname='public'
 UNION ALL SELECT 'function_security',p.oid::regprocedure::text,concat_ws('|',r.rolname,p.proacl::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname='public' AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
 UNION ALL SELECT 'column',c.relname||'.'||a.attname,concat_ws('|',row_number() OVER(PARTITION BY c.oid ORDER BY a.attnum),format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid),a.attidentity,a.attgenerated,a.attacl::text) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped
 ) SELECT kind,name,md5(definition) AS hash FROM definitions ORDER BY kind,name`;
const externalFkSql=`SELECT DISTINCT n.nspname AS schema FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
 JOIN pg_namespace tn ON tn.oid=t.relnamespace JOIN pg_class r ON r.oid=c.confrelid JOIN pg_namespace n ON n.oid=r.relnamespace
 WHERE c.contype='f' AND tn.nspname='public' AND n.nspname<>'public' ORDER BY n.nspname`;

function digestSql(name){
  return `SELECT count(*)::text AS rows,md5(coalesce(string_agg(d,' ' ORDER BY d),'')) AS digest FROM
   (SELECT md5(row_to_json(t)::text) AS d FROM public.${identifier(name)} t) q`;
}

async function connect(){
  const client=new Client({host:access.host,port:access.port,database:access.database,user:access.user,password:access.password,
    application_name:'osplus_approved_readonly_backup',ssl:{ca:access.ca,rejectUnauthorized:true,minVersion:'TLSv1.2'},
    connectionTimeoutMillis:10000,query_timeout:20000,statement_timeout:15000,lock_timeout:1500,
    options:'-c default_transaction_read_only=on -c idle_in_transaction_session_timeout=120000 -c timezone=UTC -c datestyle=ISO'});
  client.on('error',()=>abort.abort());
  await client.connect();return client;
}

async function inspect(){
  await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const identity=(await source.query(`SELECT current_database() AS database,current_user AS username,
    current_setting('server_version_num') AS version,current_setting('transaction_read_only') AS readonly,
    transaction_timestamp() AS snapshotTime`)).rows[0];
  if(identity.database!=='postgres'||identity.username!=='postgres'||identity.readonly!=='on'||!compatibleServer(identity.version)){
    throw new Error('SERVER_IDENTITY_OR_VERSION_UNSUPPORTED');
  }
  report.serverVersion=Number(identity.version);report.readOnlyTransactionVerified=true;report.snapshotTime=identity.snapshottime.toISOString();
  report.step='metadata_tables';
  const tables=(await source.query(tablesSql)).rows;
  if(!tables.some(t=>t.name==='orders')||!tables.some(t=>t.name==='tenants')||tables.length>200)throw new Error('APPLICATION_SCHEMA_UNEXPECTED');
  report.step='metadata_dependencies';
  const externalFks=(await source.query(externalFkSql)).rows;
  const extensions=(await source.query(`SELECT e.extname AS name,n.nspname AS schema,e.extversion AS version FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace ORDER BY e.extname`)).rows;
  const functionSchemas=(await source.query(`SELECT DISTINCT n.nspname AS schema FROM pg_namespace n
    WHERE n.nspname NOT IN ('public','pg_catalog','information_schema') AND n.nspname !~ '^pg_' AND n.nspname ~ '^[a-z_][a-z0-9_]*$'
    AND EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace pn ON pn.oid=p.pronamespace
      WHERE pn.nspname='public' AND p.prosrc ~ ('(^|[^A-Za-z0-9_])"?'||n.nspname||'"?\\.')) ORDER BY n.nspname`)).rows;
  const extensionReferences=(await source.query(`WITH bodies AS (
    SELECT p.prosrc AS body FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
    UNION ALL SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    ), refs AS(SELECT DISTINCT (regexp_matches(body,'(^|[^A-Za-z0-9_])"?extensions"?\\."?([A-Za-z_][A-Za-z0-9_]*)"?','g'))[2] AS name FROM bodies),
    members AS(SELECT DISTINCT p.proname AS name,e.extname AS extension FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      JOIN pg_depend d ON d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e' JOIN pg_extension e ON e.oid=d.refobjid
      WHERE n.nspname='extensions') SELECT r.name,m.extension FROM refs r LEFT JOIN members m ON m.name=r.name ORDER BY r.name,m.extension`)).rows;
  report.step='metadata_roles';
  const roles=(await source.query(rolesSql)).rows;
  const bootstrapRole=(await source.query('SELECT rolname AS name FROM pg_roles WHERE oid=10')).rows[0]?.name;
  if(!bootstrapRole||!roles.some(r=>r.name===bootstrapRole))throw new Error('BOOTSTRAP_ROLE_UNSUPPORTED');
  report.step='metadata_catalogue';
  const catalogue=(await source.query(catalogueSql)).rows;
  const unsupportedRelations=(await source.query(`SELECT c.relname AS name,c.relkind::text AS kind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND (c.relkind IN ('f','p','m') OR EXISTS(SELECT 1 FROM pg_inherits i WHERE i.inhrelid=c.oid OR i.inhparent=c.oid)) ORDER BY c.relname`)).rows;
  const permissionCounts=(await source.query(`SELECT (SELECT count(*)::int FROM pg_auth_members) AS memberships,
    (SELECT count(*)::int FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE d.defaclnamespace=0 OR n.nspname='public') AS defaultprivileges`)).rows[0];
  const memberships=(await source.query(membershipSql(identity.version))).rows;
  const defaultPrivileges=(await source.query(defaultsSql)).rows;
  const schemaPrivileges=(await source.query(schemaAclSql)).rows;
  if(memberships.length!==permissionCounts.memberships||roles.length>100||memberships.length>200||defaultPrivileges.length>1000){throw new Error('PERMISSION_SNAPSHOT_NOT_VERIFIED');}
  // Validate support before any private copy or temporary privilege recreation.
  globalDefaultCommands(defaultPrivileges);schemaAclCommands(schemaPrivileges);
  report.serverVersion=Number(identity.version);report.tableCount=tables.length;
  report.catalogueObjects=catalogue.length;report.externalForeignKeySchemas=externalFks.map(row=>row.schema);
  report.catalogueSha256=createHash('sha256').update(JSON.stringify(catalogue)).digest('hex');
  report.readOnlyTransactionVerified=true;
  report.unsupportedRelationCount=unsupportedRelations.length;report.permissionMetadataCounts=permissionCounts;
  report.deferredFunctionSchemas=functionSchemas.map(r=>r.schema);
  report.deferredExtensionReferenceCount=extensionReferences.length;
  return {identity,tables,externalFks,extensions,roles,catalogue,unsupportedRelations,memberships,defaultPrivileges,schemaPrivileges,functionSchemas,extensionReferences,bootstrapRole,permissionSnapshotVerified:true};
}

async function localSql(name,sql){
  return docker(['exec','-i',name,'psql','-X','--no-password','--set','ON_ERROR_STOP=1','--tuples-only','--no-align','-U',localAdmin,'-d','postgres'],Buffer.from(sql));
}
async function localRows(name,query){
  return parseRows(await localSql(name,rowsQuery(query)));
}

async function cleanup(){
  const failures=[];
  for(const name of containers.reverse()){
    try{
      const listed=await docker(['ps','-aq','--filter',`name=^/${name}$`]);
      if(!listed)continue;
      const owner=await docker(['inspect','--format',`{{index .Config.Labels "${label}"}}`,name]);
      if(owner!==resourceNonce){failures.push(name);continue;}
      await docker(['stop','--time','5',name]);
      if(await docker(['ps','-aq','--filter',`name=^/${name}$`]))failures.push(name);
    }catch{failures.push(name);}
  }
  return failures;
}

async function savedRecoveryKeyVerified(file,key){
  const executable='C:/Users/abhij/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe';
  const verifier=path.join(root,'scripts','verify-private-backup-key.ps1');
  const child=spawn(executable,['-NoProfile','-File',verifier,'-KeyFile',file],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let out='',errBytes=0;const timer=setTimeout(()=>child.kill(),10000);
  child.stdout.on('data',v=>{out+=v;if(out.length>2048)child.kill();});child.stderr.on('data',v=>{errBytes+=v.length;if(errBytes>2048)child.kill();});
  await new Promise((resolve,reject)=>{child.once('error',()=>reject(new Error('SAVED_KEY_CHECK_FAILED')));child.once('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error('SAVED_KEY_CHECK_FAILED'));});});
  const result=JSON.parse(out);
  if(result.verified!==true||result.sha256!==createHash('sha256').update(key).digest('hex'))throw new Error('SAVED_KEY_CHECK_FAILED');
}

async function savedCatalogue(file,aad,key){
  const decrypted=await decryptStream(file,aad,key);let length=0;const parts=[];
  await pipeline(decrypted.input,decrypted.decipher,new Writable({write(chunk,encoding,callback){
    length+=chunk.length;if(length>1048576){callback(new Error('CATALOGUE_LIMIT'));return;}parts.push(chunk);callback();
  }}));
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}

async function backup(metadata){
  // Fail closed until the exact permission snapshot is captured/restorable.
  assertCoverage({...metadata,publicExtensions:metadata.extensions.filter(e=>e.schema==='public'&&e.name!=='plpgsql')});
  // Stock image cannot silently substitute for platform-specific extensions.
  const publicExtensions=metadata.extensions.filter(e=>e.schema==='public'&&e.name!=='plpgsql');
  if(publicExtensions.some(e=>!['pgcrypto','uuid-ossp'].includes(e.name)))throw new Error('RESTORE_EXTENSION_UNSUPPORTED');
  if(publicExtensions.length)throw new Error('PUBLIC_EXTENSION_RESTORE_REQUIRES_REVIEW');
  if(metadata.functionSchemas.some(row=>row.schema!=='extensions'))throw new Error('OUT_OF_SCOPE_DEFERRED_FUNCTION_DEPENDENCIES');
  if(metadata.extensionReferences.some(r=>!['pgcrypto','uuid-ossp'].includes(r.extension)))throw new Error('DEFERRED_EXTENSION_REFERENCE_UNSUPPORTED');
  const requiredNames=new Set(metadata.extensionReferences.map(r=>r.extension));
  const requiredExtensions=metadata.extensions.filter(e=>e.schema==='extensions'&&requiredNames.has(e.name));
  if(metadata.functionSchemas.length&&!requiredExtensions.some(e=>e.name==='pgcrypto'))throw new Error('REQUIRED_NATIVE_EXTENSION_MISSING');
  report.step='source_integrity';
  const integrity=[];
  for(const table of metadata.tables){
    const count=(await source.query(`SELECT count(*)::text AS rows FROM public.${identifier(table.name)}`)).rows[0].rows;
    if(BigInt(count)>100000n)throw new Error('TABLE_SIZE_REQUIRES_NEW_LIMIT_REVIEW');
    const digest=(await source.query(digestSql(table.name))).rows[0];
    integrity.push({name:table.name,...digest});
  }
  const snapshot=(await source.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
  if(!/^[0-9a-f]{8}-[0-9a-f]{8}-[0-9]+$/i.test(snapshot))throw new Error('SNAPSHOT_INVALID');
  folder=path.join(access.privateRoot,`backup-${nonce}`);
  await mkdir(folder,{mode:0o700});
  report.artifactDirectory=folder;report.step='encrypted_export';
  await writeFile(path.join(folder,'archive-key.dpapi.json'),JSON.stringify({version:1,ownerSid:access.ownerSid,
    runId:nonce,projectRef:access.projectRef,keyDpapi:access.protectedKey}),{flag:'wx',mode:0o600});
  const aad=archiveHeader(nonce),archive=path.join(folder,'application.pgcustom.aesgcm');
  const dumpName=`osplus-private-dump-${resourceNonce}`;containers.push(dumpName);
  const dumpProgram=`set -euo pipefail; umask 077; IFS= read -r passline; IFS= read -r caline;
    printf '%s\\n' "$passline" > /run/osplus/pgpass;
    printf '%s' "$caline" | base64 -d > /run/osplus/root.crt;
    unset passline caline;
    exec env PGPASSFILE=/run/osplus/pgpass PGSSLROOTCERT=/run/osplus/root.crt PGSSLMODE=verify-full
    PGCONNECT_TIMEOUT=10 PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=120000 -c lock_timeout=1500 -c timezone=UTC'
    pg_dump --format=custom --schema=public --no-password --lock-wait-timeout=1500ms
    --host=${access.host} --port=5432 --username=${access.user} --dbname=postgres --snapshot=${snapshot}`.replace(/\n\s+PG/g,' PG').replace(/\n\s+pg_dump/g,' pg_dump').replace(/\n\s+--host/g,' --host');
  const dump=command(['run','--rm','--pull','never','-i','--name',dumpName,'--label',`${label}=${resourceNonce}`,
    '--network','bridge','--log-driver','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',
    '--memory','256m','--cpus','1','--tmpfs','/run/osplus:rw,noexec,nosuid,size=1048576,mode=0700',
    '--entrypoint','bash',image,'-ec',dumpProgram],{stream:true,timeout:120000});
  let dumpIsolation;
  for(let attempt=0;attempt<20;attempt++){
    try{dumpIsolation=JSON.parse(await docker(['inspect','--format','{{json .HostConfig}}',dumpName]));break;}
    catch{await new Promise(resolve=>setTimeout(resolve,100));}
  }
  if(dumpIsolation?.LogConfig?.Type!=='none'||dumpIsolation?.ReadonlyRootfs!==true)throw new Error('DUMP_ISOLATION_INVALID');
  // Bash is waiting on stdin until privacy configuration is confirmed.
  dump.child.stdin.end(pgpass(access)+Buffer.from(access.ca).toString('base64')+'\n');
  const key=Buffer.from(access.key,'base64');
  await Promise.all([encryptStream(dump.child.stdout,archive,aad,key,abort.signal),dump.done]);
  await source.query('COMMIT');await source.end();source=null;
  report.snapshotExportedAt=new Date().toISOString();
  await encryptStream(Readable.from([JSON.stringify({...metadata,integrity,snapshot,requiredExtensions})]),path.join(folder,'catalogue.json.aesgcm'),Buffer.concat([aad,Buffer.from('catalogue\n')]),key,abort.signal);
  await verifyArtifact({metadata,integrity,snapshot,requiredExtensions},key,archive,aad);
}

async function verifyArtifact({metadata,integrity,snapshot,requiredExtensions},key,archive,aad){
  report.step='archive_authentication';
  // Authenticate the COMPLETE GCM archive before feeding any bytes to restore.
  const decryptedBytes=await authenticateArchive(archive,aad,key,abort.signal);
  if(decryptedBytes<5)throw new Error('ARCHIVE_EMPTY');
  await savedRecoveryKeyVerified(path.join(folder,'archive-key.dpapi.json'),key);
  const recovered=await savedCatalogue(path.join(folder,'catalogue.json.aesgcm'),Buffer.concat([aad,Buffer.from('catalogue\n')]),key);
  assertCoverage({...recovered,publicExtensions:recovered.extensions.filter(e=>e.schema==='public'&&e.name!=='plpgsql')});
  if(!compatibleServer(recovered.identity.version)||recovered.identity.readonly!=='on'||recovered.tables.length>200)throw new Error('SAVED_CATALOGUE_DIFFERS');
  const persistedExpected=JSON.parse(JSON.stringify({...metadata,integrity,snapshot,requiredExtensions}));
  if(JSON.stringify(recovered)!==JSON.stringify(persistedExpected))throw new Error('SAVED_CATALOGUE_DIFFERS');
  report.savedRecoverySetVerified=true;
  report.step='isolated_restore';
  localAdmin=recovered.bootstrapRole;
  if(!/^[a-z_][a-z0-9_]{0,62}$/.test(localAdmin))throw new Error('BOOTSTRAP_ROLE_UNSUPPORTED');
  const dbName=`osplus-private-restore-${resourceNonce}`;containers.push(dbName);
  await docker(['run','--rm','--pull','never','-d','--name',dbName,'--label',`${label}=${resourceNonce}`,
    '--network','none','--log-driver','none','--memory','1g','--cpus','2','--tmpfs','/var/lib/postgresql/data:rw,size=536870912',
    '--security-opt','no-new-privileges','-e',`POSTGRES_USER=${localAdmin}`,'-e','POSTGRES_DB=postgres','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','PGDATA=/var/lib/postgresql/data/pgdata',image]);
  let ready=false;
  for(let attempt=0;attempt<40&&!abort.signal.aborted;attempt++){
    try{await docker(['exec',dbName,'bash','-ec',`test "$(cat /proc/1/comm)" = postgres && pg_isready -U ${localAdmin} -d postgres`]);ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,250));}
  }
  if(!ready)throw new Error('RESTORE_DATABASE_NOT_READY');
  const isolation=JSON.parse(await docker(['inspect','--format','{{json .HostConfig}}',dbName]));
  if(isolation.NetworkMode!=='none'||isolation.LogConfig.Type!=='none'||Object.keys(isolation.PortBindings??{}).length){throw new Error('RESTORE_ISOLATION_INVALID');}
  const boot=recovered.roles.filter(role=>role.name!==localAdmin).map(role=>
    `CREATE ROLE ${identifier(role.name)} NOLOGIN ${roleFlags(role)};`).join('\n');
  await localSql(dbName,`${boot}\nDROP SCHEMA public CASCADE;`);
  if(recovered.requiredExtensions.length){
    await localSql(dbName,'CREATE SCHEMA extensions;'+recovered.requiredExtensions.map(e=>{
      if(!['pgcrypto','uuid-ossp'].includes(e.name)||!/^[0-9]+\.[0-9]+$/.test(e.version))throw new Error('RESTORE_EXTENSION_UNSUPPORTED');
      return `CREATE EXTENSION ${identifier(e.name)} WITH SCHEMA extensions VERSION '${e.version}';`;
    }).join(''));
    if((await localRows(dbName,"SELECT octet_length(extensions.gen_random_bytes(1))=1 AS available"))[0]?.available!==true)throw new Error('EXTENSION_RUNTIME_UNAVAILABLE');
  }
  let pending=[...recovered.memberships];
  for(let attempt=0;pending.length&&attempt<=recovered.memberships.length;attempt++){
    const next=[];
    for(const row of pending){try{await localSql(dbName,membershipCommands(row));}catch{next.push(row);}}
    if(next.length===pending.length)throw new Error('RESTORE_MEMBERSHIPS_UNSUPPORTED');pending=next;
  }
  // Do not silently create platform/extension compatibility shims.
  const restore=command(['exec','-i',dbName,'pg_restore','--exit-on-error','--no-password','-U',localAdmin,'-d','postgres'],{stream:true,timeout:90000});
  restore.child.stdout.resume();
  const decrypted=await decryptStream(archive,aad,key);
  await Promise.all([pipeline(decrypted.input,decrypted.decipher,restore.child.stdin,{signal:abort.signal}),restore.done]);
  report.step='restore_integrity';
  const localSchemaAcl=await localRows(dbName,schemaAclSql);
  await localSql(dbName,globalDefaultCommands(recovered.defaultPrivileges)+schemaAclCommands(recovered.schemaPrivileges,localSchemaAcl));
  const bootstrapCapabilities=recovered.roles.find(role=>role.name===localAdmin);
  if(!bootstrapCapabilities)throw new Error('BOOTSTRAP_ROLE_UNSUPPORTED');
  await localSql(dbName,`ALTER ROLE ${identifier(localAdmin)} ${roleFlags(bootstrapCapabilities)};`);
  const localCatalogue=await localRows(dbName,catalogueSql);
  if(JSON.stringify(canonicalBackupCatalogue(localCatalogue))!==JSON.stringify(canonicalBackupCatalogue(recovered.catalogue))){
    // Schema object names/hashes only; never definitions or business values.
    const objectKey=row=>`${row.kind}:${row.name}`;
    const expected=new Map(recovered.catalogue.map(row=>[objectKey(row),row.hash]));
    const actual=new Map(localCatalogue.map(row=>[objectKey(row),row.hash]));
    const changed=recovered.catalogue.filter(row=>actual.get(objectKey(row))!==row.hash);
    const extra=localCatalogue.filter(row=>!expected.has(objectKey(row)));
    report.catalogueDifference={changedCount:changed.length,extraCount:extra.length,
      changed:changed.slice(0,12).map(row=>({kind:row.kind,name:row.name,expectedHash:row.hash,actualHash:actual.get(objectKey(row))??null})),
      extra:extra.slice(0,12)};
    throw new Error('RESTORED_SCHEMA_OR_GRANTS_DIFFER');
  }
  report.schemaComparison='exact hashes with three narrowly pinned pg_dump representation equivalents';
  for(const [query,expected] of [[rolesSql,recovered.roles],[membershipSql(170000),recovered.memberships],
    [defaultsSql,recovered.defaultPrivileges],[schemaAclSql,recovered.schemaPrivileges]]){
    if(JSON.stringify(await localRows(dbName,query))!==JSON.stringify(expected))throw new Error('RESTORED_EFFECTIVE_PERMISSIONS_DIFFER');
  }
  const localTables=await localRows(dbName,tablesSql);
  if(JSON.stringify(localTables)!==JSON.stringify(recovered.tables))throw new Error('RESTORED_TABLE_SET_DIFFERS');
  for(const expected of recovered.integrity){
    const actual=(await localRows(dbName,digestSql(expected.name)))[0];
    if(actual.rows!==expected.rows||actual.digest!==expected.digest)throw new Error('RESTORED_DATA_DIGEST_DIFFERS');
  }
  const hash=createHash('sha256');await pipeline(createReadStream(archive),new Transform({transform(chunk,encoding,callback){hash.update(chunk);callback();}}));
  report.archiveSha256=hash.digest('hex');report.archiveBytes=(await stat(archive)).size;
  report.verifiedTables=integrity.length;report.verifiedCatalogueObjects=localCatalogue.length;
  report.requiredNativeExtensions=recovered.requiredExtensions.map(e=>({name:e.name,version:e.version}));
  report.restoreVerified=true;report.status='verified';report.step='cleanup';
  if(access.mode==='RehearseExisting'){
    if(report.archiveSha256!=='9e0fd1fefe2e1485f162ae36357e3f606a8eb96cd4df72b6a4e7bd4bdab6985e')throw new Error('REHEARSAL_ARCHIVE_CHECKSUM_INVALID');
    report.step='offline_migration_rehearsal';
    report.cloneOwnershipAlignment=await alignVerifiedCloneOwner({exec:text=>localSql(dbName,text),rows:query=>localRows(dbName,query)});
    report.rehearsal=await rehearseShopify({exec:text=>localSql(dbName,text),rows:query=>localRows(dbName,query),
      metadata:recovered,signal:abort.signal});
    report.status=report.rehearsal.blockers.length?'rehearsal_completed_with_blockers':'rehearsal_completed';
    report.step='cleanup';
  }
}

try{
  access=await input();nonce=access.nonce;
  if(access.mode==='RehearseExisting'){clearTimeout(deadline);deadline=setTimeout(()=>abort.abort(),600000);}
  if(['VerifyExisting','RehearseExisting'].includes(access.mode)){
    report.productionConnection=false;report.offlineVerification=true;
    if(access.mode==='RehearseExisting'){report.rehearsalApproved=true;report.mayApplyToSharedDatabase=false;report.mayDeploy=false;report.mayActivate=false;}
    folder=path.join(access.privateRoot,`backup-${nonce}`);report.artifactDirectory=folder;
    const key=Buffer.from(access.key,'base64'),aad=archiveHeader(nonce);
    const saved=await savedCatalogue(path.join(folder,'catalogue.json.aesgcm'),Buffer.concat([aad,Buffer.from('catalogue\n')]),key);
    report.snapshotTime=saved.identity.snapshottime;report.serverVersion=Number(saved.identity.version);
    await verifyArtifact({metadata:saved,integrity:saved.integrity,snapshot:saved.snapshot,requiredExtensions:saved.requiredExtensions},key,path.join(folder,'application.pgcustom.aesgcm'),aad);
  }else{
  report.step='read_only_connection';source=await connect();
  report.step='metadata_preflight';const metadata=await inspect();
  if(access.mode==='Inspect'){
    report.step='readonly_shopify_preflight';
    report.shopifyPreflight=await readOnlyPreflight(source);
    await source.query('ROLLBACK');report.status='inspection_complete';report.step='complete';
    report.extensionSchemas=metadata.extensions.map(e=>({name:e.name,schema:e.schema}));
  }else await backup(metadata);
  }
}catch(error){
  // Step is a fixed enum written by this runner, never arbitrary input/error text.
  report.status='failed';if(report.restoreVerified!==true)report.restoreVerified=false;process.exitCode=1;
  const allowed=new Set(['SERVER_IDENTITY_OR_VERSION_UNSUPPORTED','APPLICATION_SCHEMA_UNEXPECTED','OUT_OF_SCOPE_SCHEMA_DEPENDENCIES',
    'RESTORE_EXTENSION_UNSUPPORTED','PUBLIC_EXTENSION_RESTORE_REQUIRES_REVIEW','TABLE_SIZE_REQUIRES_NEW_LIMIT_REVIEW',
    'SNAPSHOT_INVALID','DOCKER_COMMAND_FAILED','ARCHIVE_EMPTY','RESTORE_DATABASE_NOT_READY','RESTORED_SCHEMA_OR_GRANTS_DIFFER',
    'RESTORED_TABLE_SET_DIFFERS','RESTORED_DATA_DIGEST_DIFFERS','ACCESS_BINDING_INVALID','CA_INVALID','PRIVATE_PATH_INVALID',
    'BACKUP_APPROVAL_OR_KEY_INVALID','INPUT_LIMIT','ARCHIVE_LIMIT','ARCHIVE_HEADER_INVALID','ARCHIVE_FORMAT_INVALID',
    'UNSUPPORTED_APPLICATION_RELATIONS','PERMISSION_SNAPSHOT_NOT_VERIFIED','PERMISSION_KIND_UNSUPPORTED','DEFAULT_PERMISSION_SCOPE_UNSUPPORTED',
    'SCHEMA_PERMISSION_EMPTY','SAVED_KEY_CHECK_FAILED','SAVED_CATALOGUE_DIFFERS','CATALOGUE_LIMIT','RESTORE_MEMBERSHIPS_UNSUPPORTED',
    'SOURCE_POSTGRES_ROLE_MISSING','RESTORED_EFFECTIVE_PERMISSIONS_DIFFER','OUT_OF_SCOPE_DEFERRED_FUNCTION_DEPENDENCIES',
    'REQUIRED_NATIVE_EXTENSION_MISSING','RESTORE_ISOLATION_INVALID','DUMP_ISOLATION_INVALID','EXTENSION_RUNTIME_UNAVAILABLE',
    'DEFERRED_EXTENSION_REFERENCE_UNSUPPORTED','BOOTSTRAP_ROLE_UNSUPPORTED','OFFLINE_BINDING_INVALID','LOCAL_RESULT_INVALID',
    'REHEARSAL_SCOPE_INVALID','REHEARSAL_ARCHIVE_CHECKSUM_INVALID','REHEARSAL_MANIFEST_INVALID','REHEARSAL_LEGACY_DATA_CHANGED','REHEARSAL_OWNERSHIP_EVIDENCE_INVALID','PREFLIGHT_RESULT_INVALID']);
  if(['SyntaxError','TypeError','RangeError'].includes(error?.name))report.errorType=error.name;
  report.code=allowed.has(error?.message)?error.message:({ '28P01':'DATABASE_AUTHENTICATION_FAILED','42501':'DATABASE_PERMISSION_DENIED' }[error?.code]??'BACKUP_STEP_FAILED');
  if(typeof error?.code==='string'&&/^[0-9A-Z]{5}$/.test(error.code))report.databaseSqlState=error.code;
}finally{
  clearTimeout(deadline);
  for(const child of children)child.kill();
  await source?.end().catch(()=>{});
  // Cleanup must remain usable even after deadline abort; reset only for cleanup.
  const failures=await cleanup();
  report.disposableCleanupComplete=failures.length===0;
  if(failures.length){report.status='failed';report.cleanupTargets=failures;process.exitCode=1;}
  if(folder){
    if((report.status==='failed'||report.rehearsal?.blockers?.includes('CANDIDATE_MIGRATION_FAILED'))&&lastChildDiagnostics&&access?.key){
      try{await encryptStream(Readable.from([lastChildDiagnostics]),path.join(folder,access.mode==='RehearseExisting'?`rehearsal-diagnostics-${resourceNonce}.aesgcm`:'diagnostics.aesgcm'),
        Buffer.concat([archiveHeader(nonce),Buffer.from('diagnostics\n')]),Buffer.from(access.key,'base64'));}
      catch{report.privateDiagnosticsSaved=false;}
    }
    const resultName=access.mode==='RehearseExisting'?`rehearsal-${resourceNonce}.json`:access.mode==='VerifyExisting'?`verification-${resourceNonce}.json`:'result.json';
    try{report.verificationReport=path.join(folder,resultName);await writeFile(report.verificationReport,JSON.stringify(report,null,2),{flag:'wx',mode:0o600});}
    catch{report.status='failed';report.manifestSaved=false;process.exitCode=1;}
  }
  if(access){access.password=null;access.key=null;}
  process.stdout.write(JSON.stringify(report));
}
