import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { prepareShopifyDraft } from '../src/integrations/shopify/draft-preparation.ts';
import { prepareShopifyRelease, verifyShopifyReleaseSource } from '../src/integrations/shopify/release-preparation.ts';
import { createShopifyReleaseStore } from '../src/integrations/shopify/release-store.ts';
import { sealShopifySource } from '../src/integrations/shopify/source-crypto.ts';
import { context, lease, snapshot, env, now } from './fixtures/shopify-draft.mjs';

const settings={...env,SHOPIFY_SOURCE_KEY_ID:'synthetic-v1',SHOPIFY_SOURCE_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')};
function fixture(source=snapshot()) {
  source.lines[0].variant={id:'gid://shopify/ProductVariant/21'};
  const draft=prepareShopifyDraft(source,context,lease,settings,now);
  // Stored derived fields deliberately lie: release must recompute them.
  draft.lines[0].quantity=999;draft.lines[0].title='Untrusted derived name';
  const plaintext=JSON.stringify(draft),sourceDigest=createHash('sha256').update(plaintext).digest('hex');
  const revision={id:randomUUID(),tenantId:context.tenantId,connectionId:context.connectionId,shopGid:context.shopGid,
    sourceOrderId:randomUUID(),sourceOrderGid:source.order.id,sourceDigest,sourceUpdatedAt:source.order.updatedAt,completeness:'complete',
    sealedSource:sealShopifySource(plaintext,JSON.stringify([context.tenantId,context.connectionId,context.shopGid,source.order.id,sourceDigest]),settings)};
  const mapping={id:randomUUID(),tenant_id:context.tenantId,connection_id:context.connectionId,variant_gid:source.lines[0].variant.id,
    sku:source.lines[0].sku.trim(),classification:'production',item_type_id:randomUUID(),workflow_id:randomUUID(),standard_size_id:null,is_active:true,revision:1};
  const decision={customerId:randomUUID(),deliveryType:'store_pickup',reason:'Reviewed fictional source',lines:[
    {lineGid:source.lines[0].id,mappingId:mapping.id,mappingRevision:1}]};
  const proof={tenantId:context.tenantId,connectionId:context.connectionId,shopGid:context.shopGid,connectionRevision:context.revision,
    orderGid:source.order.id,sourceUpdatedAt:source.order.updatedAt,verifiedAt:new Date(now).toISOString()};
  const run=(row=revision,choices=decision,mappings=[mapping],verified=proof)=>prepareShopifyRelease(row,context,choices,mappings,verified,settings,now);
  return {source,revision,mapping,decision,proof,run};
}
test('release decrypts bound source and reconstructs original quantity/name/colour and exact net value, not stored derived fields',()=>{
  const f=fixture(),value=f.run();
  assert.equal(value.lines[0].quantity,1);assert.equal(value.lines[0].name,'Synthetic blue shirt');assert.equal(value.lines[0].colour,'Blue');
  assert.equal(value.lines[0].originalUnitMinorUnits,'11000');assert.equal(value.lines[0].netMinorUnits,'10000');
  assert.equal(value.moneyValidation,'restricted_reconciliation_passed');assert.equal(JSON.stringify(value).includes('payment'),false);
  assert.equal(value.connectionRevision,context.revision);
});
test('browser review cannot supply source quantity, money, source update, or unknown line choices',()=>{
  const f=fixture();
  for(const patch of [{quantity:99},{netMinorUnits:'1'},{sourceUpdatedAt:new Date(now).toISOString()}])
    assert.throws(()=>f.run(f.revision,{...f.decision,lines:[{...f.decision.lines[0],...patch}]}));
  assert.throws(()=>f.run(f.revision,{...f.decision,lines:[{...f.decision.lines[0],lineGid:'gid://shopify/LineItem/999'}]}),/REVIEW_REQUIRED/);
});
test('tenant/store/order AAD, digest and authenticated snapshot mismatches fail closed',()=>{
  const f=fixture();
  assert.throws(()=>f.run({...f.revision,tenantId:randomUUID()}),/ACCESS_DENIED/);
  assert.throws(()=>f.run({...f.revision,sourceOrderGid:'gid://shopify/Order/999'}),/ACCESS_DENIED/);
  assert.throws(()=>f.run({...f.revision,sourceOrderGid:'gid://shopify/Order/999'},f.decision,[f.mapping],
    {...f.proof,orderGid:'gid://shopify/Order/999'}),/RESPONSE_INVALID/);
  assert.throws(()=>f.run({...f.revision,sourceDigest:'c'.repeat(64)}),/RESPONSE_INVALID/);
  assert.throws(()=>f.run({...f.revision,sealedSource:{...f.revision.sealedSource,tag:'a'.repeat(22)+'=='}}),/RESPONSE_INVALID/);
});
test('source proof rejects changed update/revision, stale and future remote observations',()=>{
  const f=fixture();
  for(const patch of [{sourceUpdatedAt:new Date(now).toISOString()},{verifiedAt:new Date(now-120001).toISOString()},
    {verifiedAt:new Date(now+1).toISOString()}]) assert.throws(()=>f.run(f.revision,f.decision,[f.mapping],{...f.proof,...patch}),/SOURCE_CHANGED/);
  assert.throws(()=>f.run(f.revision,f.decision,[f.mapping],{...f.proof,connectionRevision:3}),/ACCESS_DENIED/);
});
test('mapping changes/foreign candidates cannot silently release and SKU renames require explicit reviewed acknowledgement',()=>{
  const f=fixture();
  assert.throws(()=>f.run(f.revision,f.decision,[{...f.mapping,revision:2}]),/STALE_REVISION/);
  assert.throws(()=>f.run(f.revision,f.decision,[{...f.mapping,tenant_id:randomUUID()}]),/RESPONSE_INVALID/);
  assert.throws(()=>f.run(f.revision,f.decision,[{...f.mapping,sku:'RENAMED'}]),/REVIEW_REQUIRED/);
  const choices={...f.decision,lines:[{...f.decision.lines[0],skuChangeAcknowledged:true}]};
  assert.equal(f.run(f.revision,choices,[{...f.mapping,sku:'RENAMED'}]).lines[0].productionAllowed,true);
});
test('contradictory colour requires a reasoned explicit override; no inferred title-colour extraction',()=>{
  const source=snapshot();source.lines[0].customAttributes.push({key:'Color',value:'Red'});
  const f=fixture(source);assert.throws(()=>f.run(),/REVIEW_REQUIRED/);
  const choices={...f.decision,lines:[{...f.decision.lines[0],colourOverride:'Blue and red'}]};
  assert.equal(f.run(f.revision,choices).lines[0].colour,'Blue and red');
});
test('unsupported financial shapes, inconsistent original totals and wholly nonproduction remain held',()=>{
  const refunded=snapshot();refunded.order.totalRefundedSet.shopMoney.amount='1.00';assert.throws(()=>fixture(refunded).run(),/REVIEW_REQUIRED/);
  const inconsistentRefund=snapshot();inconsistentRefund.order.displayFinancialStatus='PARTIALLY_REFUNDED';assert.throws(()=>fixture(inconsistentRefund).run(),/REVIEW_REQUIRED/);
  const broken=snapshot();broken.lines[0].originalTotalSet.shopMoney.amount='111.00';assert.throws(()=>fixture(broken).run(),/REVIEW_REQUIRED/);
  const f=fixture(),mapping={...f.mapping,classification:'nonproduction',item_type_id:null,workflow_id:null};
  assert.throws(()=>f.run(f.revision,f.decision,[mapping]),/REVIEW_REQUIRED/);
});
test('live source fence uses pinned internal read-only query, canonical store and source GID, rejecting changed or foreign Shopify results',async()=>{
  const f=fixture();let calls=0;
  const response=(update=f.revision.sourceUpdatedAt,shop=context.shopGid)=>async(url,init)=>{
    calls++;assert.equal(url,`https://${context.shopDomain}/admin/api/2026-10/graphql.json`);
    assert.equal(new Headers(init.headers).get('X-Shopify-Access-Token'),'synthetic-token');
    const body=JSON.parse(init.body);assert.equal(body.variables.id,f.source.order.id);assert.match(body.query,/^query OSPlusReleaseRevision/);
    return new Response(JSON.stringify({data:{shop:{id:shop,myshopifyDomain:context.shopDomain},order:{id:f.source.order.id,updatedAt:update}}}),
      {headers:{'X-Shopify-API-Version':'2026-10'}});
  };
  const signal=new AbortController().signal;
  assert.deepEqual(await verifyShopifyReleaseSource(context,f.revision,'synthetic-token',signal,settings,response(),()=>now),f.proof);
  await assert.rejects(()=>verifyShopifyReleaseSource(context,f.revision,'synthetic-token',signal,settings,response(new Date(now).toISOString()),()=>now),/SOURCE_CHANGED/);
  await assert.rejects(()=>verifyShopifyReleaseSource(context,f.revision,'synthetic-token',signal,settings,response(f.revision.sourceUpdatedAt,'gid://shopify/Shop/999'),()=>now),/ACCESS_DENIED/);
  assert.equal(calls,3);
});
test('adapter review/release/recovery only issue service commands and mask SQL details',async()=>{
  const f=fixture(),prepared=f.run(),key=randomUUID(),reviewId=randomUUID(),released={status:'released',orderId:randomUUID(),sourceRevisionId:f.revision.id,itemCount:1};
  const calls=[];let reply=released,error=null;
  const store=createShopifyReleaseStore({rpc(name,args){calls.push({name,args});return {abortSignal:async()=>({data:reply,error})};}});
  const args=[{tenantId:context.tenantId,connectionId:context.connectionId},'synthetic-owner',key,f.revision.sourceOrderId,reviewId,prepared,new AbortController().signal];
  assert.deepEqual(await store.release(...args),released);assert.equal(calls[0].args.p_recovery_only,false);
  assert.deepEqual(await store.recoverCommittedRelease(...args),released);assert.equal(calls[1].args.p_recovery_only,true);
  reply=null;assert.equal(await store.recoverCommittedRelease(...args),null);
  error={message:'SQL failure exposes PRIVATE SOURCE / token',details:'secret'};
  await assert.rejects(()=>store.release(...args),err=>err.code==='UPSTREAM_UNAVAILABLE'&&!JSON.stringify(err).includes('secret'));
  error={message:'SHOPIFY_STALE_REVISION'};await assert.rejects(()=>store.release(...args),err=>err.code==='STALE_REVISION');
  error=null;reply={reviewId,version:1};
  assert.deepEqual(await store.saveReview(args[0],args[1],key,f.revision.sourceOrderId,f.revision.id,0,f.decision,args.at(-1)),reply);
});
