import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { readOnlyPreflight,contextSql,pilotSql,presenceSql,rolesSql,assertFreshRecoveryEvidence } from './readonly-preflight.mjs';
function fixture(patch={}){
  const context={readonly:'on',database:'postgres',actor:'postgres',owner:'postgres',schema_create:true,database_create:true,history_present:false,...patch};
  const safety={order_safety:{missing_customer_or_delivery:0,invalid_customer_tenant_link:0,existing_new_shopify_source:0,existing_draft_status:0},
    missing_prerequisite_tables:[],set_updated_at_present:true,customer_indexes:[{name:'customers_pkey',definition:'FICTIONAL_PRIVATE_DEFINITION'}],privateField:'MUST_NOT_LEAVE'};
  const calls=[];return {calls,safety,source:{query:async(sql,params)=>{
    calls.push({sql,params});
    if(sql===contextSql)return {rows:[context]};
    if(sql===pilotSql)return {rows:[{matches:1,active:true,privateField:'MUST_NOT_LEAVE'}]};
    if(sql===presenceSql)return {rows:[]};
    if(sql===rolesSql)return {rows:[{name:'anon',superuser:false,bypassrls:false}]};
    return {rows:[{result:safety}]};
  }}};
}
test('preflight uses only SELECTs and emits explicit aggregate projection with all execution gates off',async()=>{
  const f=fixture(),report=await readOnlyPreflight(f.source);
  assert.equal(f.calls.length,5);
  for(const {sql} of f.calls)assert.match(sql.replace(/^--[^\n]*\n/gm,'').trim(),/^SELECT\b/i);
  assert.deepEqual(f.calls.find(c=>c.sql===pilotSql).params,['7be40f50-94a0-46c5-af57-7eea5e36ea8a']);
  for(const key of ['readyForMigration','mayApply','mayDeploy','mayActivate'])assert.equal(report[key],false);
  assert.equal(report.historyPresent,false);assert.equal(report.orderSafety.invalid_customer_tenant_link,0);
  assert.ok(!JSON.stringify(report).includes('MUST_NOT_LEAVE'));assert.ok(!JSON.stringify(report).includes('FICTIONAL_PRIVATE_DEFINITION'));
});
test('read-write, foreign actor/database and malformed safety fail closed before further reads',async()=>{
  for(const patch of [{readonly:'off'},{database:'other'},{actor:'other'}]){
    const f=fixture(patch);await assert.rejects(readOnlyPreflight(f.source),/PREFLIGHT_RESULT_INVALID/);assert.equal(f.calls.length,1);
  }
  for(const value of [null,-1,'0',NaN]){
    const f=fixture();f.safety.order_safety.missing_customer_or_delivery=value;
    await assert.rejects(readOnlyPreflight(f.source),/PREFLIGHT_RESULT_INVALID/);
  }
});
test('nonzero safety and missing prerequisites remain evidence, never hidden or auto-repaired',async()=>{
  const f=fixture();f.safety.order_safety.invalid_customer_tenant_link=2;f.safety.missing_prerequisite_tables=['workflows'];
  const report=await readOnlyPreflight(f.source);assert.equal(report.orderSafety.invalid_customer_tenant_link,2);
  assert.deepEqual(report.missingPrerequisiteTables,['workflows']);assert.equal(report.readyForMigration,false);
});
test('Inspect invokes the read-only supplement before rollback without reaching reference/rehearsal tooling',async()=>{
  const source=await readFile(new URL('./private-backup.mjs',import.meta.url),'utf8');
  const branch=source.slice(source.indexOf("if(access.mode==='Inspect'){"),source.indexOf('}else await backup(metadata);'));
  assert.ok(branch.indexOf('readOnlyPreflight(source)')<branch.indexOf("source.query('ROLLBACK')"));
  assert.ok(!/rehearseShopify|localSql|schema-compatibility/.test(branch));
});

const manifest=JSON.parse(await readFile(new URL('../../docs/shopify-hosted-test-package.json',import.meta.url),'utf8'));
const gate=manifest.freshRecoveryPreparation;
const preflight=JSON.parse(await readFile(new URL('../../docs/'+gate.preflightEvidenceFile,import.meta.url),'utf8'));
const recovery=JSON.parse(await readFile(new URL('../../docs/'+gate.recoveryEvidenceFile,import.meta.url),'utf8'));
test('fresh nonsecret evidence binds the preflight, snapshot, archive and verified recovery without execution authority',()=>{
  assert.doesNotThrow(()=>assertFreshRecoveryEvidence(preflight,recovery,gate));
});
test('fresh evidence rejects missing safety checks, privilege drift, changed binding, failed recovery or execution claims',()=>{
  for(const mutate of [p=>p.shopifyPreflight.orderSafety={},p=>delete p.shopifyPreflight.orderSafety.invalid_customer_tenant_link,
    p=>p.shopifyPreflight.orderSafety.invalid_customer_tenant_link=1,p=>p.shopifyPreflight.pilot.active=false,
    p=>p.shopifyPreflight.ownership.owner='other',p=>p.shopifyPreflight.roles[0].bypassrls=true,
    p=>p.shopifyPreflight.roles.pop(),p=>p.shopifyPreflight.existingShopifyRelations=['shopify_connections'],
    p=>p.shopifyPreflight.missingPrerequisiteTables=['workflows']]){
    const candidate=structuredClone(preflight);mutate(candidate);assert.throws(()=>assertFreshRecoveryEvidence(candidate,recovery,gate));
  }
  for(const mutate of [r=>r.productionWrites=true,r=>r.migrationsExecuted=true,r=>r.mayApply=true,r=>r.mayDeploy=true,
    r=>r.mayActivate=true,r=>r.restoreVerified=false,r=>r.savedRecoverySetVerified=false,r=>r.disposableCleanupComplete=false,
    r=>r.preflightEvidenceSha256='0'.repeat(64),r=>r.catalogueSha256='0'.repeat(64),r=>r.verifiedTables=0,
    r=>r.verifiedCatalogueObjects=0,r=>r.archiveRunId='0'.repeat(32),r=>r.hostedTestPopulated=true,
    r=>r.backupSnapshotTime='2026-10-14T00:00:00Z']){
    const candidate=structuredClone(recovery);mutate(candidate);assert.throws(()=>assertFreshRecoveryEvidence(preflight,candidate,gate));
  }
});
