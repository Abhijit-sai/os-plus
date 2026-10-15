import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanupOwned,cleanupSummary } from './cleanup.mjs';
const names={api:'owned-api',db:'owned-db',network:'owned-net'},label='owned.label',nonce='random-owner';
function fake({wrongOwner,failStop,absent=false}={}){
  const calls=[];
  return {calls,async docker(...args){
    calls.push(args);const name=args.at(-1);
    if(args.includes('inspect')){
      if(absent)throw new Error(args[0]==='network'?'network not found':'No such object');
      return name===wrongOwner?'foreign-owner':nonce;
    }
    if(args[0]==='stop'&&name===failStop)throw new Error('stop failed');
    return name;
  }};
}
test('owned resources are removed and success is reported only when cleanup succeeds',async()=>{
  const fixture=fake();const failures=await cleanupOwned({...fixture,names,label,nonce});
  assert.deepEqual(failures,[]);assert.match(cleanupSummary(failures),/^Owned disposable containers\/network removed/);
  assert.deepEqual(fixture.calls.filter(call=>call[0]==='stop').map(call=>call.at(-1)),[names.api,names.db]);
});
test('ownership mismatch prevents destructive action and forbids a cleanup success claim',async()=>{
  const fixture=fake({wrongOwner:names.db});const failures=await cleanupOwned({...fixture,names,label,nonce});
  assert.deepEqual(failures,[{name:names.db,message:'ownership mismatch'}]);
  assert.equal(fixture.calls.some(call=>call[0]==='stop'&&call.at(-1)===names.db),false);
  assert.match(cleanupSummary(failures),/^Cleanup incomplete;.*owned-db/);assert.doesNotMatch(cleanupSummary(failures),/containers\/network removed/);
});
test('stop failure is retained in explicit unresolved targets; already absent resources are harmless',async()=>{
  const failure=await cleanupOwned({...fake({failStop:names.api}),names,label,nonce});
  assert.deepEqual(failure,[{name:names.api,message:'stop failed'}]);assert.match(cleanupSummary(failure),/remaining\/unverified targets: owned-api/);
  const missing=fake({absent:true});assert.deepEqual(await cleanupOwned({...missing,names,label,nonce}),[]);
  assert.equal(missing.calls.some(call=>call[0]==='stop'||call.includes('rm')),false);
});
