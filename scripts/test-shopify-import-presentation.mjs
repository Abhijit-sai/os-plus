import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importDateError,importExplanation,previewExpired} from '../src/integrations/shopify/import-presentation.ts';
test('inclusive dates accept 31 days, reject reverse, future and missing ranges',()=>{
  assert.equal(importDateError('2026-10-01','2026-10-31','2026-10-31'),'');
  for(const dates of [['2026-09-30','2026-10-31'],['2026-10-20','2026-10-19'],['2026-10-01','2026-11-01'],['','2026-10-20']])
    assert.notEqual(importDateError(...dates,'2026-10-31'),'');
});
test('preview expiry is fail closed, including exact boundary',()=>{
  const now=Date.parse('2026-10-20T00:00Z');
  assert.equal(previewExpired({expiresAt:new Date(now+1).toISOString()},now),false);
  for(const expiresAt of [null,'bad',new Date(now).toISOString(),new Date(now-1).toISOString()])
    assert.equal(previewExpired({expiresAt},now),true);
});
test('reference matches are not described as verified duplicates or identical details',()=>{
  assert.match(importExplanation({status:'reference_match'}),/not a verified Shopify link/);
  assert.match(importExplanation({status:'already_imported'}),/already linked/);
  assert.match(importExplanation({status:'conflict',reference:''}),/no reference/);
  assert.match(importExplanation({status:'conflict',reference:'PT1',incomingReferenceConflict:true}),/Multiple Shopify orders/);
  assert.match(importExplanation({status:'conflict',reference:'PT1'}),/ambiguous/);
});
