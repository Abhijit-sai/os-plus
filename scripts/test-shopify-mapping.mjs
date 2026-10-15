import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {resolveShopifyMapping} from '../src/integrations/shopify/mapping.ts';
import {createShopifyMappingStore} from '../src/integrations/shopify/mapping-store.ts';
import {tenantA,tenantB,connectionA} from './fixtures/shopify-intake.mjs';
const binding={tenantId:tenantA,connectionId:connectionA.id};
const row={id:randomUUID(),tenant_id:tenantA,connection_id:connectionA.id,variant_gid:'gid://shopify/ProductVariant/1',sku:'EXACT',
 classification:'production',item_type_id:randomUUID(),workflow_id:randomUUID(),standard_size_id:null,is_active:true,revision:1};
test('exact variant disambiguates duplicate SKU and known rename warns; never fuzzy matches',()=>{
 const duplicate={...row,id:randomUUID(),variant_gid:'gid://shopify/ProductVariant/2'};
 assert.equal(resolveShopifyMapping(binding,{variantGid:row.variant_gid,sku:'EXACT'},[duplicate,row]).mapping.id,row.id);
 assert.deepEqual(resolveShopifyMapping(binding,{variantGid:row.variant_gid,sku:'RENAMED'},[row]).warnings,['MAPPING_SKU_CHANGED']);
 assert.equal(resolveShopifyMapping(binding,{variantGid:null,sku:'EXACT'},[row,duplicate]).reason,'AMBIGUOUS_SKU');
 assert.equal(resolveShopifyMapping(binding,{variantGid:null,sku:'exact'},[row]).reason,'MISSING_MAPPING');
});
test('SKU-only future rules are forbidden; missing/deleted variant never guesses identity; disabled variant stays blocked',()=>{
 assert.equal(resolveShopifyMapping(binding,{variantGid:null,sku:'EXACT'},[row]).reason,'VARIANT_IDENTITY_MISMATCH');
 assert.throws(()=>resolveShopifyMapping(binding,{variantGid:'gid://shopify/ProductVariant/999',sku:'EXACT'},[{...row,variant_gid:null}]),error=>error.code==='RESPONSE_INVALID');
 assert.equal(resolveShopifyMapping(binding,{variantGid:row.variant_gid,sku:'EXACT'},[{...row,is_active:false}]).reason,'INACTIVE_MAPPING');
 assert.equal(resolveShopifyMapping(binding,{variantGid:null,sku:null},[]).reason,'MISSING_MAPPING');
});
test('foreign/duplicate/unsafe candidate sets fail closed',()=>{
 for(const candidates of [[{...row,tenant_id:tenantB}],[{...row,connection_id:randomUUID()}],[row,row],[{...row,revision:2**53}],[{...row,rawCustomer:'private'}]])
  assert.throws(()=>resolveShopifyMapping(binding,{variantGid:row.variant_gid,sku:'EXACT'},candidates),error=>error.code==='RESPONSE_INVALID');
});
test('save adapter sends exact trusted scope and validates optimistic result without private error leakage',async()=>{
 const signal=new AbortController().signal, key=randomUUID(), command={mappingId:null,expectedRevision:0,variantGid:row.variant_gid,sku:row.sku,
 classification:row.classification,itemTypeId:row.item_type_id,workflowId:row.workflow_id,standardSizeId:null,isActive:true,reason:'Synthetic reviewed choice'};
 const calls=[];
 const fake=response=>createShopifyMappingStore({rpc(name,args){calls.push({name,args});return {abortSignal(s){assert.equal(s,signal);return Promise.resolve(response);}};}});
 const saved={mappingId:row.id,revision:1};
 assert.deepEqual(await fake({data:saved,error:null}).save(binding,'owner',key,command,signal),saved);
 assert.deepEqual(calls[0],{name:'save_shopify_mapping',args:{p_tenant_id:tenantA,p_connection_id:connectionA.id,p_actor_id:'owner',p_request_key:key,p_input:command}});
 for(const data of [{...saved,revision:2},{...saved,private:'secret'},null]) await assert.rejects(()=>fake({data,error:null}).save(binding,'owner',key,command,signal),error=>error.code==='RESPONSE_INVALID');
 await assert.rejects(()=>fake({data:null,error:{message:'private'}}).save(binding,'owner',key,command,signal),error=>error.code==='UPSTREAM_UNAVAILABLE'&&!JSON.stringify(error).includes('private'));
 const before=calls.length;
 await assert.rejects(()=>fake({data:saved,error:null}).save(binding,'owner',key,{...command,classification:'nonproduction'},signal));
 assert.equal(calls.length,before);
});
