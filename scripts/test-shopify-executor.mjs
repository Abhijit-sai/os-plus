import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {createShopifyDraftExecutor} from '../src/integrations/shopify/draft-executor.ts';
import {ShopifyIntegrationError} from '../src/integrations/shopify/errors.ts';
import {context,lease,env,now,snapshot} from './fixtures/shopify-draft.mjs';
const settings={...env,SHOPIFY_EXECUTOR_ENABLED:'true',SHOPIFY_DRAFT_IMPORT_ENABLED:'true',
 SHOPIFY_SOURCE_KEY_ID:'synthetic',SHOPIFY_SOURCE_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')};
const token={tenantId:context.tenantId,connectionId:context.connectionId,shopGid:context.shopGid,appRef:context.appRef,
 environment:'production',connectionRevision:context.revision,expiresAt:'2026-10-08T13:00:00Z',accessToken:'synthetic-secret'};
const saved={status:'draft',tenantId:context.tenantId,orderId:randomUUID(),releaseEligible:false};
function fixture(overrides={}) {
 const calls=[];
 const record=(name,result)=>async(...args)=>{calls.push({name,args});return typeof result==='function'?result(...args):result;};
 const deps={queue:{claim:record('claim',[lease]),update:record('fail',true)},
  readCredential:record('credential',token),hydrate:record('hydrate',{status:'complete',snapshot:snapshot()}),
  drafts:{importSnapshot:record('import',saved),importPartialEnvelope:record('partial',saved),
   recoverCommittedSnapshot:record('recover',null),recoverPartialEnvelope:record('recoverPartial',null)}};
 for(const [key,value] of Object.entries(overrides)) deps[key]=typeof value==='function'?value:({...deps[key],...value});
 return {deps,calls,run:createShopifyDraftExecutor(deps,()=>now,100)};
}
test('one claimed generation follows credentials→hydrate→atomic import; output has IDs not PII/token',async()=>{
 const f=fixture(), result=await f.run(context,settings);
 assert.deepEqual(result,{status:'draft',jobId:lease.jobId,orderId:saved.orderId});
 assert.deepEqual(f.calls.map(call=>call.name),['claim','credential','hydrate','import']);
 assert.equal(f.calls[0].args[1],1); assert.ok(!JSON.stringify(result).includes('secret'));
});
test('disabled/missing-key/preview gates precede all dependencies; empty queue does not read token',async()=>{
 for(const invalid of [{...settings,SHOPIFY_EXECUTOR_ENABLED:'false'},{...settings,SHOPIFY_SOURCE_ENCRYPTION_KEY:''},{...settings,VERCEL_ENV:'preview'}]) {
  const f=fixture(); await assert.rejects(()=>f.run(context,invalid)); assert.equal(f.calls.length,0);
 }
 const f=fixture({queue:{claim:async()=>[]}});assert.deepEqual(await f.run(context,settings),{status:'idle'});assert.equal(f.calls.length,0);
});
test('foreign/stale/expired credential cannot issue Shopify requests or import',async()=>{
 for(const invalid of [{...token,tenantId:randomUUID()},{...token,connectionRevision:3},{...token,shopGid:'gid://shopify/Shop/999'},
  {...token,expiresAt:'2026-10-08T12:00:01Z'}]) {
  const f=fixture({readCredential:async()=>invalid});const result=await f.run(context,settings);
  assert.equal(result.status,'retry');assert.ok(!f.calls.some(call=>call.name==='hydrate'||call.name==='import'));
  assert.equal(f.calls.at(-1).args[3],'VALIDATION_REQUIRED');
 }
});
test('partial result retains observation and cannot enter full snapshot import',async()=>{
 const partial={status:'review',completeness:'partial',reason:'LINE_LIMIT',envelope:{id:lease.orderGid,createdAt:'2026-10-08T10:00:00Z',updatedAt:'2026-10-08T10:00:00Z'}};
 const f=fixture({hydrate:async()=>partial});assert.equal((await f.run(context,settings)).status,'draft');
 const call=f.calls.at(-1);assert.equal(call.name,'partial');assert.equal(call.args[4],new Date(now).toISOString());
});
test('lost import response checks original intent and never independently completes or retries a committed generation',async()=>{
 const f=fixture({drafts:{importSnapshot:async()=>{throw Error('private SQL/token');},recoverCommittedSnapshot:async()=>saved}});
 assert.equal((await f.run(context,settings)).status,'draft');
 assert.ok(!f.calls.some(call=>call.name==='fail'));
});
test('429 is persisted with delay; lost lease is fenced; validation/ineligible is held not fabricated complete',async()=>{
 for(const code of ['THROTTLED','RESPONSE_INVALID','AUTHENTICATION_REQUIRED','ACCESS_DENIED','API_VERSION_MISMATCH','UPSTREAM_REJECTED']) {
  const f=fixture({hydrate:async()=>{throw new ShopifyIntegrationError(code,180);}});
  assert.equal((await f.run(context,settings)).status,'retry');const failure=f.calls.at(-1);
  assert.equal(failure.args[3],code==='THROTTLED'?'THROTTLED':code==='AUTHENTICATION_REQUIRED'?'AUTH_REQUIRED':code==='ACCESS_DENIED'?'SCOPE_REQUIRED':'VALIDATION_REQUIRED');
  assert.equal(failure.args[4],code==='THROTTLED'?180:null);
 }
 const f=fixture({hydrate:async()=>{throw Error('private');},queue:{update:async()=>false}});
 assert.equal((await f.run(context,settings)).status,'fenced');
});
test('ignoring-abort dependency is bounded; foreign claim never touches another tenant failure command',async()=>{
 const stalled=fixture({readCredential:async()=>new Promise(()=>{})}),start=performance.now();
 assert.equal((await stalled.run(context,settings)).status,'retry');assert.ok(performance.now()-start<1000);
 const foreign=fixture({queue:{claim:async()=>[{...lease,tenantId:randomUUID()}]}});
 assert.equal((await foreign.run(context,settings)).status,'unknown');assert.equal(foreign.calls.length,0);
});
