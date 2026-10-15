// Local files only: no credentials, network, subprocess, migration or activation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { assertFinalRehearsalEvidence } from './shopify-db-harness/final-rehearsal-evidence.mjs';
import { assertFreshRecoveryEvidence } from './shopify-db-harness/readonly-preflight.mjs';

const manifest=JSON.parse(readFileSync(new URL('../docs/shopify-hosted-test-package.json',import.meta.url),'utf8'));
assert.equal(manifest.status,'PREPARATION_ONLY_NOT_APPROVED');
for(const gate of ['mayApply','mayDeploy','mayActivate']) assert.equal(manifest[gate],false);
assert.equal(manifest.applicationArtifact,null,'No deployable application is pinned in this package');
assert.equal(manifest.localBlockerRepairsApproved,true);
assert.equal(manifest.localBlockerRepairValidation,'LOCAL_REPAIRS_VERIFIED');
assert.match(manifest.localBlockerRepairEvidenceFile,/^shopify-private-rehearsal-[a-f0-9]{32}\.json$/);
const repairedBytes=readFileSync(new URL('../docs/'+manifest.localBlockerRepairEvidenceFile,import.meta.url));
assert.equal(createHash('sha256').update(repairedBytes).digest('hex'),manifest.localBlockerRepairEvidenceSha256);
const repaired=JSON.parse(repairedBytes.toString('utf8'));
assert.equal(repaired.status,'LOCAL_REPAIRS_VERIFIED');assert.equal(repaired.kind,'osplus-shopify-private-rehearsal-redacted-v1');
for(const flag of ['productionConnection','productionWrites','hostedTestPopulated','liveEndToEndVerified','mayApply','mayDeploy','mayActivate'])assert.equal(repaired[flag],false);
for(const flag of ['restoreVerified','disposableCleanupComplete','legacySecurityPreserved','legacyDataPreservedAfterScenarios'])assert.equal(repaired[flag],true);
assert.equal(repaired.archiveId,'1b2bc4faa9b34c0b8af1e5eb1e9dba5b');assert.equal(repaired.legacyTablesPreserved,73);
assert.equal(repaired.passed,45);assert.equal(repaired.failed,0);assert.equal(repaired.scenarios.length,45);
assert.ok(repaired.scenarios.every(s=>s.passed===true));assert.deepEqual(repaired.blockers,[]);
assert.equal(repaired.expectedPermissionRepairs.length,36);assert.equal(repaired.legacySchema.missing.length,0);assert.equal(repaired.legacySchema.unexpectedChanges.length,0);
// This immutable evidence covers eleven files only, not the subsequent application migration.
assert.deepEqual(repaired.migrations.map(({file,sha256})=>({file,sha256})),manifest.migrations.slice(0,11).map(({file,sha256})=>({file,sha256})));
assert.ok(repaired.migrations.every(m=>m.status==='committed_locally'));assert.equal(repaired.migrations.length,11);
console.log('PASS local blocker repairs: 45/45 private-clone cases and 11 pinned files; shared execution NOT approved');
assert.equal(manifest.localApplicationWiringApproved,true);
assert.equal(manifest.migrations.length,12);
assert.equal(manifest.migrations[11].file,'20261014160000_shopify_pilot_application.sql');
if(manifest.finalPackagePrivateRehearsalStatus==='VERIFIED_LOCAL_ONLY'){
  assert.equal(manifest.localApplicationWiringValidation,'LOCAL_APPLICATION_AND_FINAL_PRIVATE_REHEARSAL_VERIFIED');
  assert.match(manifest.finalPackagePrivateRehearsalEvidenceFile,/^shopify-private-rehearsal-[a-f0-9]{32}\.json$/);
  assert.match(manifest.finalPackagePrivateRehearsalEvidenceSha256,/^[a-f0-9]{64}$/);
  const finalBytes=readFileSync(new URL('../docs/'+manifest.finalPackagePrivateRehearsalEvidenceFile,import.meta.url));
  assert.equal(createHash('sha256').update(finalBytes).digest('hex'),manifest.finalPackagePrivateRehearsalEvidenceSha256);
  assertFinalRehearsalEvidence(JSON.parse(finalBytes.toString('utf8')),manifest);
  console.log('PASS final twelve-file saved-backup rehearsal: 52/52 cases, 73 legacy tables, integrity/permissions and cleanup verified; shared action still NOT approved');
}else{
  assert.equal(manifest.localApplicationWiringValidation,'LOCAL_APPLICATION_CHECKS_PASSED_FINAL_PRIVATE_REHEARSAL_PENDING');
  assert.equal(manifest.finalPackagePrivateRehearsalStatus,'BLOCKED_DOCKER_STARTUP');
  assert.equal(manifest.finalPackagePrivateRehearsalEvidenceFile,undefined);
  assert.equal(manifest.finalPackagePrivateRehearsalEvidenceSha256,undefined);
  console.log('HOLD final twelve-file private-clone rehearsal: no final proof; prior eleven-file evidence does NOT cover application migration');
}
if(manifest.schemaCompatibility){
  const gate=manifest.schemaCompatibility;
  assert.equal(gate.status,'CHECKED_SHARED_APPROVAL_ON_HOLD');
  assert.equal(gate.privateCloneRehearsalApproved,true);assert.equal(gate.privateCloneRehearsalExecuted,true);
  assert.equal(gate.privateCloneRehearsalResultStatus,'COMPLETED_WITH_BLOCKERS');
  assert.match(gate.privateCloneRehearsalResultFile,/^shopify-private-rehearsal-[a-f0-9]{32}\.json$/);
  const rehearsalBytes=readFileSync(new URL('../docs/'+gate.privateCloneRehearsalResultFile,import.meta.url));
  assert.equal(createHash('sha256').update(rehearsalBytes).digest('hex'),gate.privateCloneRehearsalResultSha256);
  const rehearsal=JSON.parse(rehearsalBytes.toString('utf8'));
  assert.equal(rehearsal.kind,'osplus-shopify-private-rehearsal-redacted-v1');assert.equal(rehearsal.status,'COMPLETED_WITH_BLOCKERS');
  for(const flag of ['productionConnection','productionWrites','hostedTestPopulated','liveEndToEndVerified','mayApply','mayDeploy','mayActivate'])assert.equal(rehearsal[flag],false);
  for(const flag of ['restoreVerified','disposableCleanupComplete','legacySecurityPreserved','legacyDataPreservedAfterScenarios'])assert.equal(rehearsal[flag],true);
  assert.equal(rehearsal.legacyTablesPreserved,73);assert.equal(rehearsal.scenarios.length,41);
  assert.equal(rehearsal.passed,36);assert.equal(rehearsal.failed,5);assert.equal(rehearsal.blockers.length,5);
  assert.equal(rehearsal.scenarios.filter(s=>s.passed===true).length,rehearsal.passed);
  assert.deepEqual(rehearsal.scenarios.filter(s=>s.passed===false).map(s=>s.id),rehearsal.blockers);
  assert.ok(!rehearsal.scenarios.some(s=>s.reason==='SCENARIO_SETUP_OR_EXECUTION_FAILED'));
  assert.equal(rehearsal.migrations.length,9);
  assert.deepEqual(rehearsal.migrations.map(({file,sha256})=>({file,sha256})),manifest.migrations.slice(0,9).map(({file,sha256})=>({file,sha256})));
  assert.ok(rehearsal.migrations.every(m=>m.status==='committed_locally'));
  assert.equal(rehearsal.cloneOwnershipAlignment.archiveDatabaseOwnerCaptured,false);
  assert.equal(rehearsal.cloneOwnershipAlignment.evidenceSha256,'5bd249847bcef0f62907f020b46a7e6cbac77cb2d98e889f7876c53eedc0f2d4');
  assert.equal(gate.privateCloneRehearsalArchiveId,'1b2bc4faa9b34c0b8af1e5eb1e9dba5b');
  assert.equal(gate.privateCloneRehearsalScope,'verified-backup-local-rehearsal-no-production-no-chat-crm');
  assert.match(gate.evidenceFile,/^shopify-schema-check-[a-f0-9]{32}\.json$/);
  const bytes=readFileSync(new URL('../docs/'+gate.evidenceFile,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),gate.sha256,'Compatibility evidence changed; renew package review');
  const evidence=JSON.parse(bytes.toString('utf8'));
  assert.equal(evidence.status,'checked_not_approved');assert.equal(evidence.readOnlyTransactionVerified,true);
  assert.equal(evidence.productionWrites,false);assert.equal(evidence.disposableCleanupComplete,true);
  assert.equal(evidence.snapshotTime,gate.snapshotTime);
  assert.equal(evidence.reference.perFileTransaction,true);assert.equal(evidence.reference.candidateChecksumsVerified,true);
  for(const permission of ['mayApply','mayDeploy','mayActivate'])assert.equal(evidence[permission],false);
  console.log('PASS canonical read-only compatibility evidence hash; shared approval remains ON HOLD');
  console.log('PASS historical baseline evidence: 36/41 passed before repairs; superseded locally, shared approval still ON HOLD');
}
const folder=new URL('../supabase/migrations/',import.meta.url);
if(manifest.freshRecoveryPreparation){
  const gate=manifest.freshRecoveryPreparation;
  assert.equal(gate.status,'VERIFIED_READONLY_BACKUP_RECOVERY_ONLY');
  function evidence(file,sha,pattern){
    assert.match(file,pattern);assert.match(sha,/^[a-f0-9]{64}$/);
    const bytes=readFileSync(new URL('../docs/'+file,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),sha);
    return JSON.parse(bytes.toString('utf8'));
  }
  const preflight=evidence(gate.preflightEvidenceFile,gate.preflightEvidenceSha256,/^shopify-readonly-preflight-\d{8}T\d{9}Z\.json$/);
  const recovery=evidence(gate.recoveryEvidenceFile,gate.recoveryEvidenceSha256,/^shopify-fresh-recovery-[a-f0-9]{32}\.json$/);
  assertFreshRecoveryEvidence(preflight,recovery,gate);
  console.log('PASS fresh SELECT-only preflight and encrypted backup/offline recovery evidence; no new migration rehearsal or shared execution approval');
}
const all=readdirSync(folder).filter(name=>name.endsWith('.sql')).sort();
const expected=all.filter(name=>name.includes('_shopify_'));
assert.deepEqual(manifest.migrations.map(entry=>entry.file),expected,'Migration list/order must exactly match the prepared Shopify files');
for(const entry of manifest.migrations) {
  assert.match(entry.file,/^\d{14}_shopify_[a-z_]+\.sql$/);
  assert.match(entry.sha256,/^[a-f0-9]{64}$/);
  const bytes=readFileSync(new URL(entry.file,folder));
  assert.equal(bytes.length,entry.bytes,`${entry.file}: byte length changed`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,`${entry.file}: checksum changed; renew package review, do not apply`);
}
console.log(`PASS preparation-only manifest: ${manifest.migrations.length} ordered migration checksums; no execution authority`);
console.log(`Historical prerequisite files (${all.length-expected.length}), compare with hosted history individually; count alone is insufficient:`);
for(const file of all.filter(name=>!expected.includes(name))) console.log(file);
