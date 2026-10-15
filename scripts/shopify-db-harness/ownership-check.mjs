// Owner specifically approved ONE read-only catalogue check; no business rows.
import { Client } from 'pg';
import { randomBytes,createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateInput } from './private-backup-contract.mjs';
export const ownershipSql=`SELECT current_database() AS database,current_user AS actor,
  current_setting('transaction_read_only') AS readonly,r.rolname AS owner,
  has_schema_privilege('postgres','public','CREATE') AS migration_actor_can_create,
  has_database_privilege('postgres',current_database(),'CREATE') AS migration_actor_database_create,
  transaction_timestamp() AS checked_at FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba WHERE d.datname=current_database()`;
let source,input;const report={kind:'osplus-private-backup-report-v1',status:'failed',check:'approved-database-ownership-only',productionWrites:false};
try{
  const parts=[];let bytes=0;const timer=setTimeout(()=>process.stdin.destroy(),10000);
  try{for await(const part of process.stdin){bytes+=part.length;if(bytes>65536)throw new Error('LIMIT');parts.push(part);}}finally{clearTimeout(timer);}
  input=validateInput(JSON.parse(Buffer.concat(parts).toString('utf8')));if(input.mode!=='Inspect')throw new Error('MODE');
  source=new Client({host:input.host,port:input.port,database:input.database,user:input.user,password:input.password,
    ssl:{ca:input.ca,rejectUnauthorized:true,minVersion:'TLSv1.2'},application_name:'osplus_approved_ownership_catalogue_only',
    connectionTimeoutMillis:10000,query_timeout:10000,statement_timeout:5000,lock_timeout:1000,
    options:'-c default_transaction_read_only=on -c idle_in_transaction_session_timeout=15000'});
  source.on('error',()=>{});await source.connect();input.password=null;
  await source.query('BEGIN READ ONLY');const row=(await source.query(ownershipSql)).rows[0];
  if(row.database!=='postgres'||row.actor!=='postgres'||row.readonly!=='on')throw new Error('IDENTITY');
  await source.query('ROLLBACK');
  report.status='ownership_checked_readonly';report.projectRef=input.projectRef;
  report.ownership={database:row.database,actor:row.actor,owner:row.owner,readOnly:true,
    migrationActorCanCreate:row.migration_actor_can_create,migrationActorDatabaseCreate:row.migration_actor_database_create,checkedAt:row.checked_at.toISOString()};
  const file=new URL(`../../docs/shopify-ownership-check-${randomBytes(16).toString('hex')}.json`,import.meta.url);
  const text=JSON.stringify(report,null,2)+'\n';await writeFile(file,text,{flag:'wx'});
  report.evidenceFile=fileURLToPath(file);report.evidenceSha256=createHash('sha256').update(text).digest('hex');
}catch{report.code='OWNERSHIP_CHECK_FAILED';process.exitCode=1;}
finally{await source?.end().catch(()=>{});if(input)input.password=null;process.stdout.write(JSON.stringify(report));}
