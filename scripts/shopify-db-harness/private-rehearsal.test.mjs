import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { literal,parseScenario,projectedDigest,rejectionMatches,validateOwnershipEvidence,alignVerifiedCloneOwner,expectedPermissionRepair,runtimeRpcNames } from './private-rehearsal.mjs';
import { validateInput } from './private-backup-contract.mjs';
test('rehearsal requires separate approval and the exact verified offline archive, not source credentials',()=>{
  const input={mode:'RehearseExisting',projectRef:'dxiyihrdfismbuqdmhit',approved:true,rehearsalApproved:true,
    localRoot:'C:\\Users\\Synthetic\\AppData\\Local',privateRoot:'C:\\Users\\Synthetic\\AppData\\Local\\OSPlusPrivateBackups',
    ownerSid:'S-1-5-21-100-200-300-1001',nonce:'1b2bc4faa9b34c0b8af1e5eb1e9dba5b',key:Buffer.alloc(32,7).toString('base64')};
  assert.equal(validateInput(input).mode,'RehearseExisting');
  for(const patch of [{approved:false},{rehearsalApproved:false},{nonce:'a'.repeat(32)},{password:'FICTIONAL'},{host:'example.invalid'},{ca:'any'},{user:'postgres'}])assert.throws(()=>validateInput({...input,...patch}));
});
test('synthetic SQL literals and original-column digests are quoted and projection-stable',()=>{
  assert.equal(literal("test'quote"),"'test''quote'");assert.throws(()=>literal('bad\0value'));
  const sql=projectedDigest('orders',['id','old"field']);assert.match(sql,/SELECT "id","old""field" FROM public\."orders"/);
  assert.ok(!sql.includes('SELECT *'));assert.throws(()=>projectedDigest('orders',[]));
});
test('result reader accepts exactly one bounded fixture result, not arbitrary query output',()=>{
  assert.equal(parseScenario('BEGIN\nCREATE FUNCTION\nOSPLUS_REHEARSAL_RESULT:{"passed":true}\nROLLBACK').passed,true);
  for(const text of ['{"passed":true}','OSPLUS_REHEARSAL_RESULT:{"passed":1}',
    'OSPLUS_REHEARSAL_RESULT:{"passed":true}\nOSPLUS_REHEARSAL_RESULT:{"passed":false}'])assert.throws(()=>parseScenario(text));
});
test('denial evidence cannot pass for syntax, missing objects, or unrelated constraints',()=>{
  assert.ok(rejectionMatches({rejected:true,sqlstate:'42501'},'42501'));
  assert.ok(rejectionMatches({rejected:true,code:'SHOPIFY_PRODUCTION_HELD'},'SHOPIFY_DRAFT_LOCKED|SHOPIFY_PRODUCTION_HELD'));
  for(const probe of [{rejected:true,sqlstate:'42703'},{rejected:true,sqlstate:'23502'},{rejected:true,code:'REDACTED_DATABASE_ERROR'},{rejected:false,code:'EXECUTED'}]){
    assert.equal(rejectionMatches(probe,'SHOPIFY_DRAFT_LOCKED|SHOPIFY_PRODUCTION_HELD'),false);
    assert.equal(rejectionMatches(probe,'42501'),false);
  }
  assert.equal(rejectionMatches({rejected:true}),false);
});

test('only the eighteen named commands losing ordinary EXECUTE are permitted catalogue changes',()=>{
  assert.equal(runtimeRpcNames.length,18);assert.equal(new Set(runtimeRpcNames).size,18);
  const hash='68934a3e9455fa72420237eb05902327'; // md5('false')
  const entry={kind:'function_access',name:'create_work_unit_runtime(uuid).anon',actualHash:hash};
  assert.equal(expectedPermissionRepair(entry),true);
  for(const patch of [{kind:'function'},{name:'some_other_function().anon'},{name:'create_work_unit_runtime(uuid).service_role'},{actualHash:'true'}])
    assert.equal(expectedPermissionRepair({...entry,...patch}),false);
});

test('clone ownership alignment requires the exact approved read-only attestation and fixed SQL',async()=>{
  const bytes=await readFile(new URL('../../docs/shopify-ownership-check-41d468410f65cd0f95f464fdc11cba7c.json',import.meta.url));
  assert.equal(validateOwnershipEvidence(bytes).owner,'postgres');
  assert.throws(()=>validateOwnershipEvidence(Buffer.from('{}')));
  const commands=[];let reads=0;
  const result=await alignVerifiedCloneOwner({exec:async sql=>commands.push(sql),rows:async()=>[++reads===1
    ?{owner:'fictional_bootstrap',can_create:false,database_create:false}:{owner:'postgres',can_create:true,database_create:true}]});
  assert.deepEqual(commands,['ALTER DATABASE postgres OWNER TO postgres;']);assert.equal(result.cloneOnly,true);
  assert.equal(result.archiveDatabaseOwnerCaptured,false);assert.equal(reads,2);
  await assert.rejects(alignVerifiedCloneOwner({exec:async()=>{},rows:async()=>[{owner:'fictional_bootstrap',can_create:false}]}));
});
test('rehearsal transport has no network, env reads or private-file paths and all domain cases roll back',async()=>{
  const text=await readFile(new URL('./private-rehearsal.mjs',import.meta.url),'utf8');
  assert.ok(!/process\.env|fetch\(|new Client|pooler|dpapi|access\.password/.test(text));
  assert.match(text,/SET LOCAL ROLE postgres/);assert.match(text,/ROLLBACK/);assert.match(text,/REHEARSAL_LEGACY_DATA_CHANGED/);
  assert.match(text,/UNEXPECTED_LEGACY_SCHEMA_OR_SECURITY_CHANGE/);assert.match(text,/outcome_unknown_stopped/);
  assert.ok(!text.includes("status:'failed_rolled_back'"));assert.match(text,/HANDOVER_RELEASED_UNHELD_VALID_CONTROL/);
  assert.match(text,/flag|manifest.mayApply/);assert.match(text,/REHEARSAL_MANIFEST_INVALID/);
  const runner=await readFile(new URL('./private-backup.mjs',import.meta.url),'utf8');
  assert.ok(runner.indexOf("['VerifyExisting','RehearseExisting'].includes(access.mode)")<runner.indexOf("report.step='read_only_connection'"));
  assert.match(runner,/REHEARSAL_ARCHIVE_CHECKSUM_INVALID/);assert.match(runner,/rehearsal-\$\{resourceNonce\}\.json/);
  const ps=await readFile(new URL('../run-shopify-private-backup.ps1',import.meta.url),'utf8');
  assert.match(ps,/ExecuteApprovedRehearsal/);assert.equal((ps.match(/\$Mode -in @\('VerifyExisting','RehearseExisting'\)/g)??[]).length,2);
});
