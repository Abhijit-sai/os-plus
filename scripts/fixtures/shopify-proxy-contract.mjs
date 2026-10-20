// Exercise the actual middleware function, not a substring approximation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
export async function assertShopifyProxyBoundary(){
  const source=readFileSync(new URL('../../src/proxy.ts',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,m={exports:{}};
  vm.runInNewContext(code,{module:m,exports:m.exports,URL,require(name){assert.equal(name,'@clerk/nextjs/server');return {
    clerkMiddleware:handler=>handler,createRouteMatcher:()=>()=>false};}});
  for(const route of ['orders-webhook','privacy-webhook','uninstall-webhook','worker'])for(const method of ['POST','GET','HEAD']){
    let calls=0;await m.exports.default({protect:async()=>{calls++;}},new Request(`https://example.invalid/api/integrations/shopify/${route}`,{method}));
    assert.equal(calls,method==='POST'?0:1,route+' '+method);
  }
  for(const route of ['test-connection','privacy-export','orders-webhook/extra','worker-extra','other'])for(const method of ['POST','GET']){
    let calls=0;await m.exports.default({protect:async()=>{calls++;}},new Request(`https://example.invalid/api/integrations/shopify/${route}`,{method}));
    assert.equal(calls,1,route+' '+method);
  }
  assert.ok(!source.includes('/api/(.*)'));
}
