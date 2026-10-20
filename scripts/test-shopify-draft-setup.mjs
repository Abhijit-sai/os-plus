import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { shopifyDraftSetupSchema, shopifySaveDraftSetupSchema, shopifyDraftSetupMissing } from '../src/integrations/shopify/draft-setup.ts';

const draft=()=>({customerId:null,deliveryType:null,promisedDeliveryDate:null,note:'',
  lines:[{lineGid:'gid://shopify/LineItem/1',itemTypeId:null,workflowId:null,standardSizeId:null,expectedCompletionDate:null}]});
test('incomplete manager choices save as drafts without mappings or forced delivery dates',()=>{
  const value=draft();assert.deepEqual(shopifyDraftSetupSchema.parse(value),value);
  assert.equal(shopifyDraftSetupMissing(value).length,4);
  value.customerId=randomUUID();value.deliveryType='store_pickup';
  value.lines[0].itemTypeId=randomUUID();value.lines[0].workflowId=randomUUID();
  assert.deepEqual(shopifyDraftSetupMissing(value),[]);
});
test('draft choices reject source money/quantity, mappings, authority and invalid calendar dates',()=>{
  for(const key of ['tenantId','amountPaid','total','sourceOrderId','role'])
    assert.equal(shopifyDraftSetupSchema.safeParse({...draft(),[key]:'forged'}).success,false);
  for(const key of ['mappingId','quantity','price']){
    const value=draft();value.lines[0][key]=1;assert.equal(shopifyDraftSetupSchema.safeParse(value).success,false);
  }
  assert.equal(shopifyDraftSetupSchema.safeParse({...draft(),promisedDeliveryDate:'2026-02-30'}).success,false);
  const duplicate=draft();duplicate.lines.push({...duplicate.lines[0]});assert.equal(shopifyDraftSetupSchema.safeParse(duplicate).success,false);
});
test('save commands require immutable source revision, optimistic version and an exact retry key',()=>{
  const command={orderId:randomUUID(),sourceRevisionId:randomUUID(),expectedVersion:0,requestKey:randomUUID(),choices:draft()};
  assert.deepEqual(shopifySaveDraftSetupSchema.parse(command),command);
  for(const patch of [{sourceRevisionId:null},{expectedVersion:-1},{expectedVersion:Number.MAX_SAFE_INTEGER},{requestKey:'retry'}, {connectionId:randomUUID()}])
    assert.equal(shopifySaveDraftSetupSchema.safeParse({...command,...patch}).success,false);
});
