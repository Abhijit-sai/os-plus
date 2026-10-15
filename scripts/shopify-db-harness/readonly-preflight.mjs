// SELECT-only supplement to the existing protected Inspect mode. No Docker,
// credentials, environment, source business rows or migration execution.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

export const contextSql=`SELECT current_setting('transaction_read_only') AS readonly,
  current_database() AS database,current_user AS actor,r.rolname AS owner,
  has_schema_privilege(current_user,'public','CREATE') AS schema_create,
  has_database_privilege(current_user,current_database(),'CREATE') AS database_create,
  to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS history_present
  FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba WHERE d.datname=current_database()`;
export const pilotSql=`SELECT count(*)::int AS matches,bool_and(status::text='active') AS active
  FROM public.tenants WHERE id=$1`;
export const presenceSql=`SELECT c.relname::text AS name FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
  AND (c.relname LIKE 'shopify\\_%' ESCAPE '\\' OR c.relname IN ('operational_orders','local_operational_orders'))
  AND c.relkind IN ('r','v','m','p','f') ORDER BY c.relname`;
export const rolesSql=`SELECT rolname AS name,rolsuper AS superuser,rolbypassrls AS bypassrls
  FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') ORDER BY rolname`;
const counts=['missing_customer_or_delivery','invalid_customer_tenant_link','existing_new_shopify_source','existing_draft_status'];
function invalid(){throw new Error('PREFLIGHT_RESULT_INVALID');}
function identifier(value){if(typeof value!=='string'||!/^[a-z_][a-z0-9_]{0,62}$/.test(value))invalid();return value;}
function bool(value){if(typeof value!=='boolean')invalid();return value;}

export async function readOnlyPreflight(source){
  const context=(await source.query(contextSql)).rows[0];
  if(context?.readonly!=='on'||context.database!=='postgres'||context.actor!=='postgres')invalid();
  const safetySql=await readFile(new URL('../shopify-hosted-compatibility-check.sql',import.meta.url),'utf8');
  const raw=(await source.query(safetySql)).rows[0]?.result;if(!raw)invalid();
  const orderSafety=Object.fromEntries(counts.map(name=>{
    const value=raw.order_safety?.[name];if(!Number.isSafeInteger(value)||value<0)invalid();return [name,value];
  }));
  if(!Array.isArray(raw.missing_prerequisite_tables)||!Array.isArray(raw.customer_indexes))invalid();
  const missing=raw.missing_prerequisite_tables.map(identifier);
  const indexes=raw.customer_indexes.map(row=>{
    if(typeof row.definition!=='string'||Buffer.byteLength(row.definition)>16384)invalid();
    return {name:identifier(row.name),sha256:createHash('sha256').update(row.definition).digest('hex')};
  });
  const pilot=(await source.query(pilotSql,['7be40f50-94a0-46c5-af57-7eea5e36ea8a'])).rows[0];
  if(!Number.isSafeInteger(pilot?.matches)||pilot.matches<0||!(pilot.active===null||typeof pilot.active==='boolean'))invalid();
  const relations=(await source.query(presenceSql)).rows.map(row=>identifier(row.name));
  const roles=(await source.query(rolesSql)).rows.map(row=>({name:identifier(row.name),superuser:bool(row.superuser),bypassrls:bool(row.bypassrls)}));
  return {kind:'shopify-readonly-preflight-v1',scope:'shared-schema-all-tenant-aggregates-no-business-rows',
    readyForMigration:false,mayApply:false,mayDeploy:false,mayActivate:false,
    ownership:{database:context.database,actor:context.actor,owner:identifier(context.owner),
      schemaCreate:bool(context.schema_create),databaseCreate:bool(context.database_create)},
    historyPresent:bool(context.history_present),orderSafety,missingPrerequisiteTables:missing,
    setUpdatedAtPresent:bool(raw.set_updated_at_present),customerIndexes:indexes,
    pilot:{matches:pilot.matches,active:pilot.active},existingShopifyRelations:relations,roles,
    limitation:'Inspection only; no rebuilt migration reference or full new compatibility verdict. Known drift remains subject to review.'};
}

// Repository evidence only. Success never grants migration or deployment authority.
export function assertFreshRecoveryEvidence(preflight,recovery,gate){
  assert.equal(preflight.kind,'osplus-shopify-readonly-preflight-redacted-v1');assert.equal(preflight.status,'INSPECTED_NOT_APPROVED');
  assert.equal(recovery.kind,'osplus-shopify-fresh-recovery-redacted-v1');assert.equal(recovery.status,'FRESH_BACKUP_RECOVERY_VERIFIED');
  for(const report of [preflight,recovery]){
    assert.equal(report.projectRef,'dxiyihrdfismbuqdmhit');assert.equal(report.productionConnection,true);
    assert.equal(report.readOnlyTransactionVerified,true);assert.equal(report.disposableCleanupComplete,true);
    for(const flag of ['productionWrites','migrationsExecuted','mayApply','mayDeploy','mayActivate'])assert.equal(report[flag],false);
  }
  const p=preflight.shopifyPreflight;
  for(const flag of ['readyForMigration','mayApply','mayDeploy','mayActivate'])assert.equal(p[flag],false);
  assert.deepEqual(Object.keys(p.orderSafety).sort(),[...counts].sort());
  assert.ok(Object.values(p.orderSafety).every(n=>n===0));
  assert.deepEqual(p.missingPrerequisiteTables,[]);assert.deepEqual(p.existingShopifyRelations,[]);
  assert.deepEqual(p.pilot,{matches:1,active:true});assert.equal(p.setUpdatedAtPresent,true);
  assert.deepEqual(p.ownership,{database:'postgres',actor:'postgres',owner:'postgres',schemaCreate:true,databaseCreate:true});
  assert.deepEqual(p.roles,[{name:'anon',superuser:false,bypassrls:false},{name:'authenticated',superuser:false,bypassrls:false},{name:'service_role',superuser:false,bypassrls:true}]);
  assert.equal(typeof p.historyPresent,'boolean');
  assert.equal(recovery.preflightEvidenceFile,gate.preflightEvidenceFile);assert.equal(recovery.preflightEvidenceSha256,gate.preflightEvidenceSha256);
  assert.equal(recovery.preflightSnapshotTime,preflight.snapshotTime);
  assert.equal(recovery.archiveRunId,gate.archiveRunId);assert.match(recovery.archiveRunId,/^[a-f0-9]{32}$/);
  assert.equal(gate.recoveryEvidenceFile,'shopify-fresh-recovery-'+recovery.archiveRunId+'.json');
  assert.equal(recovery.backupSnapshotTime,gate.backupSnapshotTime);
  assert.ok(Number.isFinite(Date.parse(preflight.snapshotTime))&&Date.parse(recovery.backupSnapshotTime)>=Date.parse(preflight.snapshotTime));
  assert.match(recovery.archiveSha256,/^[a-f0-9]{64}$/);assert.ok(Number.isSafeInteger(recovery.archiveBytes)&&recovery.archiveBytes>0);
  assert.equal(recovery.restoreVerified,true);assert.equal(recovery.savedRecoverySetVerified,true);assert.equal(recovery.preflightAndBackupCatalogueMatch,true);
  for(const [actual,expected] of [[recovery.verifiedTables,preflight.tableCount],[recovery.verifiedCatalogueObjects,preflight.catalogueObjects]]){
    assert.ok(Number.isSafeInteger(actual)&&actual>0);assert.equal(actual,expected);
  }
  assert.match(recovery.catalogueSha256,/^[a-f0-9]{64}$/);assert.equal(recovery.catalogueSha256,preflight.catalogueSha256);
  assert.equal(recovery.hostedTestPopulated,false);
}
