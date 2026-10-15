// Pure evidence validation: no network, private paths, secrets or execution authority.
import assert from 'node:assert/strict';
import { runtimeRpcNames } from './private-rehearsal.mjs';

// Exact reviewed inventory, not a count or subset supplied by the candidate report.
export const finalRehearsalScenarioIds=Object.freeze([
  'DRAFT_NOT_IN_PRODUCTION',
  'PARTIAL_SOURCE_HAS_NO_CUSTOMER_OR_ITEMS',
  'IMPORT_IDENTICAL_RETRY_NO_DUPLICATES',
  'RELEASE_TWO_LINES_QUANTITIES_AND_MONEY',
  'RELEASE_RETRY_ONE_MATERIALIZATION',
  'DENY_RELEASE_REHEARSAL_MANAGER',
  'DENY_RELEASE_REHEARSAL_FINANCE',
  'DENY_RELEASE_REHEARSAL_FOREIGN_OWNER',
  'DENY_RELEASE_UNKNOWN',
  'DENY_CROSS_TENANT_RELEASE',
  'DENY_ANON_SOURCE_TABLE_READ',
  'DENY_ANON_IMPORT_RPC',
  'DENY_AUTHENTICATED_SOURCE_TABLE_READ',
  'DENY_AUTHENTICATED_IMPORT_RPC',
  'SERVICE_CANNOT_FORGE_RELEASE_CAPABILITY',
  'MANAGER_CAN_READ_ORDER_PAYMENTS_NOT_CONTRIBUTIONS',
  'DENY_SOURCE_PAYMENT_REHEARSAL_FINANCE',
  'DENY_SOURCE_PAYMENT_REHEARSAL_FOREIGN_OWNER',
  'DENY_SOURCE_PAYMENT_UNKNOWN',
  'DENY_FOREIGN_SOURCE_PAYMENT',
  'LOCAL_PAYMENT_POSTING_BLOCKED',
  'COMMERCIAL_AMOUNT_EDIT_BLOCKED',
  'ITEM_QUANTITY_EDIT_BLOCKED',
  'SOURCE_CHANGE_HOLDS_PRODUCTION',
  'HELD_ORDER_NOTES_STILL_EDITABLE',
  'PARTIAL_POST_RELEASE_CANNOT_CONTINUE',
  'IMMUTABLE_SOURCE_HISTORY',
  'RELEASE_AUDIT_FAILURE_ROLLS_BACK',
  'FOREIGN_MAPPING_REJECTED',
  'STALE_SOURCE_PROOF_REJECTED',
  'FOREIGN_CURRENCY_REVIEW_ONLY',
  'RELEASE_FLAG_OFF_REJECTED',
  'PAUSE_BLOCKS_NEW_PROCESSING',
  'RECOVERY_AFTER_PAUSE_IS_READ_ONLY',
  'HANDOVER_RELEASED_UNHELD_VALID_CONTROL',
  'HANDOVER_DRAFT_ORDER_BLOCKED',
  'HANDOVER_HELD_ORDER_BLOCKED',
  'HANDOVER_ITEM_RELEASED_UNHELD_VALID_CONTROL',
  'HANDOVER_HELD_ITEM_INSERT_BLOCKED',
  'HANDOVER_HELD_ITEM_UPDATE_BLOCKED',
  'HANDOVER_HELD_ITEM_DELETE_BLOCKED',
  'ORDINARY_V2_MUTATION_RPC_EXECUTE_REVOKED',
  'V2_WORK_UNIT_VALID_CONTROL',
  'ANON_CANNOT_CREATE_V2_WORK',
  'AUTHENTICATED_CANNOT_CREATE_V2_WORK',
  'APPLICATION_OWNER_READ_AND_ONE_ORDER_APPROVAL',
  'APPLICATION_DENY_REHEARSAL_MANAGER',
  'APPLICATION_DENY_REHEARSAL_FINANCE',
  'APPLICATION_DENY_REHEARSAL_FOREIGN_OWNER',
  'APPLICATION_OTHER_ORDER_WEBHOOK_IGNORED',
  'APPLICATION_COPY_QUEUE_RETRY_ONE_GENERATION',
  'APPLICATION_EXPIRED_SOURCE_PURGE_PRESERVES_BUSINESS',
]);

export function assertFinalRehearsalEvidence(evidence,manifest){
  assert.equal(evidence.kind,'osplus-shopify-private-rehearsal-redacted-v1');
  assert.equal(evidence.status,'FINAL_LOCAL_REHEARSAL_VERIFIED');
  assert.equal(evidence.scope,'verified-backup-local-rehearsal-no-production-no-chat-crm');
  for(const key of ['productionConnection','productionWrites','hostedTestPopulated','liveEndToEndVerified','mayApply','mayDeploy','mayActivate'])assert.equal(evidence[key],false,key);
  for(const key of ['restoreVerified','savedRecoverySetVerified','disposableCleanupComplete','legacySecurityPreserved','legacyDataPreservedAfterScenarios'])assert.equal(evidence[key],true,key);
  assert.equal(evidence.archiveId,'1b2bc4faa9b34c0b8af1e5eb1e9dba5b');
  assert.equal(evidence.archiveSha256,'9e0fd1fefe2e1485f162ae36357e3f606a8eb96cd4df72b6a4e7bd4bdab6985e');
  assert.equal(evidence.snapshotTime,'2026-10-14T10:40:12.129Z');
  assert.equal(evidence.verifiedTables,73);assert.equal(evidence.verifiedCatalogueObjects,2140);
  assert.equal(evidence.legacyTablesPreserved,73);
  assert.equal(evidence.cloneOwnershipAlignment?.cloneOnly,true);
  assert.equal(evidence.cloneOwnershipAlignment?.archiveDatabaseOwnerCaptured,false);
  assert.equal(evidence.cloneOwnershipAlignment?.evidenceSha256,'5bd249847bcef0f62907f020b46a7e6cbac77cb2d98e889f7876c53eedc0f2d4');
  assert.deepEqual(evidence.cloneOwnershipAlignment?.after,{owner:'postgres',can_create:true,database_create:true});
  assert.equal(manifest.migrations.length,12);assert.equal(evidence.migrations.length,12);
  assert.deepEqual(evidence.migrations.map(({file,sha256})=>({file,sha256})),manifest.migrations.map(({file,sha256})=>({file,sha256})));
  assert.ok(evidence.migrations.every(m=>m.status==='committed_locally'));
  assert.equal(evidence.expectedPermissionRepairs.length,36);
  assert.equal(new Set(evidence.expectedPermissionRepairs).size,36);
  for(const name of runtimeRpcNames)for(const role of ['anon','authenticated'])assert.equal(evidence.expectedPermissionRepairs.filter(n=>n.startsWith(name+'(')&&n.endsWith('.'+role)).length,1);
  assert.deepEqual(evidence.legacySchema.missing,[]);assert.deepEqual(evidence.legacySchema.unexpectedChanges,[]);
  assert.equal(evidence.sourceEncryptionTestedHere,false,'SQL rehearsal is not the separate application crypto test');
  assert.equal(evidence.passed,52);assert.equal(evidence.failed,0);assert.deepEqual(evidence.blockers,[]);
  assert.equal(evidence.scenarios.length,52);assert.equal(new Set(evidence.scenarios.map(s=>s.id)).size,52);
  assert.ok(evidence.scenarios.every(s=>s.passed===true&&s.reason!=='SCENARIO_SETUP_OR_EXECUTION_FAILED'));
  assert.deepEqual(evidence.scenarios.map(s=>s.id).sort(),[...finalRehearsalScenarioIds].sort());
}
