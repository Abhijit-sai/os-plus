import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { assertFinalRehearsalEvidence } from './final-rehearsal-evidence.mjs';

const manifest=JSON.parse(await readFile(new URL('../../docs/shopify-hosted-test-package.json',import.meta.url),'utf8'));
const historical=JSON.parse(await readFile(new URL('../../docs/shopify-private-rehearsal-dfe2ea34822a86007cffb0eda59fd181.json',import.meta.url),'utf8'));
// Test-only shape fixture, never written or represented as executed rehearsal evidence.
function fixture(){return {...structuredClone(historical),status:'FINAL_LOCAL_REHEARSAL_VERIFIED',savedRecoverySetVerified:true,
  migrations:manifest.migrations.map(m=>({...m,status:'committed_locally'})),passed:52,failed:0,
  scenarios:[...structuredClone(historical.scenarios),...['APPLICATION_OWNER_READ_AND_ONE_ORDER_APPROVAL',
    'APPLICATION_DENY_REHEARSAL_MANAGER','APPLICATION_DENY_REHEARSAL_FINANCE','APPLICATION_DENY_REHEARSAL_FOREIGN_OWNER',
    'APPLICATION_OTHER_ORDER_WEBHOOK_IGNORED','APPLICATION_COPY_QUEUE_RETRY_ONE_GENERATION',
    'APPLICATION_EXPIRED_SOURCE_PURGE_PRESERVES_BUSINESS'].map(id=>({id,passed:true,category:'application'}))]};}

test('complete local evidence validates without granting any shared action',()=>{
  const evidence=fixture();assertFinalRehearsalEvidence(evidence,manifest);
  assert.equal(evidence.mayApply,false);assert.equal(evidence.mayDeploy,false);assert.equal(evidence.mayActivate,false);
  assert.throws(()=>assertFinalRehearsalEvidence(historical,manifest));
});
test('rejects altered candidate, failed or duplicated scenarios and missing cleanup/integrity',()=>{
  for(const mutate of [e=>e.migrations.pop(),e=>e.migrations[11].sha256='0'.repeat(64),e=>e.migrations[11].status='outcome_unknown_stopped',
    e=>e.scenarios[0].passed=false,e=>e.scenarios[51]=e.scenarios[50],e=>e.scenarios[51].id='NOT_THE_RETENTION_TEST',
    e=>e.disposableCleanupComplete=false,e=>e.legacyTablesPreserved=72,e=>e.legacyDataPreservedAfterScenarios=false,
    e=>e.legacySecurityPreserved=false,e=>e.legacySchema.unexpectedChanges.push('other'),e=>e.savedRecoverySetVerified=false,
    e=>e.expectedPermissionRepairs[0]='unrelated_function().anon',e=>e.cloneOwnershipAlignment.after.owner='other',
    e=>e.archiveSha256='0'.repeat(64),e=>e.sourceEncryptionTestedHere=true]){
    const evidence=fixture();mutate(evidence);assert.throws(()=>assertFinalRehearsalEvidence(evidence,manifest));
  }
});
test('rejects production access, hosted claims or activation authority in local evidence',()=>{
  for(const key of ['productionConnection','productionWrites','hostedTestPopulated','liveEndToEndVerified','mayApply','mayDeploy','mayActivate']){
    const evidence=fixture();evidence[key]=true;assert.throws(()=>assertFinalRehearsalEvidence(evidence,manifest));
  }
});
test('every required scenario must be present, not replaced by another passing label',()=>{
  for(let index=0;index<52;index++){
    const evidence=fixture(),missing=evidence.scenarios[index].id;
    evidence.scenarios[index].id='UNRELATED_PASS';
    assert.throws(()=>assertFinalRehearsalEvidence(evidence,manifest),undefined,'Missing scenario must be rejected: '+missing);
  }
});
