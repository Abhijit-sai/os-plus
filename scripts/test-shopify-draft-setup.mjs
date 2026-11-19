import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { shopifyDraftSetupSchema, shopifySaveDraftSetupSchema, shopifyDraftSetupMissing, shopifyDefaultWorkflow, shopifyGarmentType } from '../src/integrations/shopify/draft-setup.ts';

const draft=()=>({customerId:null,deliveryType:null,promisedDeliveryDate:null,note:'',
  lines:[{lineGid:'gid://shopify/LineItem/1',itemTypeId:null,workflowId:null,standardSizeId:null,expectedCompletionDate:null}]});

test('production names are optional team choices, normalize blanks and reject forged source data',()=>{
  const value=draft();value.lines[0].productionName='  Navy shirt with monogram  ';
  assert.equal(shopifyDraftSetupSchema.parse(value).lines[0].productionName,'Navy shirt with monogram');
  value.lines[0].productionName='   ';
  assert.equal(shopifyDraftSetupSchema.parse(value).lines[0].productionName,null);
  for(const invalid of [12,{},'x'.repeat(2001)]){
    value.lines[0].productionName=invalid;
    assert.equal(shopifyDraftSetupSchema.safeParse(value).success,false);
  }
  delete value.lines[0].productionName;
  assert.deepEqual(shopifyDraftSetupSchema.parse(value),value,'historical setup shape must survive unchanged');
});
test('incomplete manager choices save as drafts without mappings or forced delivery dates',()=>{
  const value=draft();assert.deepEqual(shopifyDraftSetupSchema.parse(value),value);
  assert.equal(shopifyDraftSetupMissing(value).length,3);
  value.customerId=randomUUID();
  value.lines[0].itemTypeId=randomUUID();value.lines[0].workflowId=randomUUID();
  assert.deepEqual(shopifyDraftSetupMissing(value),[]);
});

test('Shopify titles match whole garment names and compatible defaults without guessing on bundles',()=>{
  const shirt=randomUUID(),pant=randomUUID(),tee=randomUUID(),workflow=randomUUID();
  const itemTypes=[{id:shirt,name:'Shirt',defaultWorkflowId:workflow},{id:pant,name:'Trousers'},{id:tee,name:'T Shirt'}];
  assert.equal(shopifyGarmentType('Black Oxford Shirt',itemTypes),shirt);
  assert.equal(shopifyGarmentType('Classic linen pants',itemTypes),pant);
  assert.equal(shopifyGarmentType('Black T-shirt',itemTypes),tee);
  for(const title of ['Pantone color card','Shirtdress','Shirt + Pant set',''])
    assert.equal(shopifyGarmentType(title,itemTypes),null,title);
  assert.equal(shopifyGarmentType('Shirt and Pants',itemTypes.slice(0,1)),null);
  assert.equal(shopifyGarmentType('Navy Pants',[...itemTypes,{id:randomUUID(),name:'Pant'}]),null);
  assert.equal(shopifyGarmentType('Linen Shirt',[{id:shirt,name:'Mens Shirts'}]),shirt);
  assert.equal(shopifyGarmentType('Linen Shirt',[{id:shirt,name:'Mens Shirts'},{id:pant,name:'Women’s shirts'}]),null);
  assert.equal(shopifyDefaultWorkflow(shirt,{itemTypes,workflows:[{id:workflow,name:'Default shirt',itemTypeId:shirt}]}),workflow);
  assert.equal(shopifyDefaultWorkflow(shirt,{itemTypes,workflows:[{id:workflow,name:'Incompatible',itemTypeId:pant}]}),null);
  assert.equal(shopifyDefaultWorkflow(pant,{itemTypes,workflows:[{id:workflow,name:'Unconfigured',itemTypeId:pant}]}),null);
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
