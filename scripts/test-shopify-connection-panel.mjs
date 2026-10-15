import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
function load(path,imports){
  const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,
    target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const m={exports:{}};vm.runInNewContext(code,{module:m,exports:m.exports,require(name){
    if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;
    if(Object.hasOwn(imports,name))return imports[name];throw Error(name);
  }});return m.exports;
}
const tenantId='10000000-0000-4000-8000-000000000001';
test('actual panel renders distinct responsive states, one read-only button and no credential/import form',()=>{
  const cards=load('../src/components/ui/card.tsx',{'@/lib/utils':{cn:(...v)=>v.filter(Boolean).join(' ')}});
  const {ShopifyConnectionPanel}=load('../src/components/settings/shopify-connection-panel.tsx',{
    '@/components/ui/card':cards,'@/components/ui/button':{Button:props=>React.createElement('button',props)},
    '@/integrations/shopify/access-check-client':{checkShopifyAccess:()=>assert.fail('Render must not fetch')}});
  for(const availability of ['configuration_pending','database_pending','not_connected','available','unavailable']){
    const state={availability,shopDomain:availability==='configuration_pending'?null:'synthetic-shop.myshopify.com',
      canCheckAccess:availability!=='configuration_pending',connection:availability==='available'?{status:'pending',revision:1}:null};
    const html=renderToStaticMarkup(React.createElement(ShopifyConnectionPanel,{state,tenantId}));
    assert.ok(html.includes('Live imports are not available'));assert.ok(html.includes('Customer messages remain off'));
    assert.equal((html.match(/<button/g)||[]).length,1);assert.ok(html.includes('min-h-11'));assert.ok(html.includes('break-all'));
    assert.ok(html.includes('aria-live="polite"'));assert.ok(html.includes('<dl'));assert.ok(html.includes('<ol'));
    assert.ok(!/<input|<form|private-synthetic|synthetic-app/.test(html));
    if(availability==='database_pending')assert.ok(html.includes('Database setup pending'));
    if(availability==='configuration_pending')assert.ok(html.includes('disabled=""'));
    if(availability==='unavailable')assert.ok(html.includes('Do not assume that no connection exists'));
  }
});
test('route/card are owner-only pilot-gated, tenant changes remount client state, and flag defaults off',()=>{
  const page=readFileSync(new URL('../src/app/(tenant)/settings/shopify/page.tsx',import.meta.url),'utf8');
  const overview=readFileSync(new URL('../src/app/(tenant)/settings/page.tsx',import.meta.url),'utf8');
  assert.ok(page.includes('getShopifyProbeActor'));assert.ok(page.includes('actor.role!=="owner_admin"'));
  assert.ok(page.includes('isShopifyConnectionScreenEnabled'));assert.ok(page.includes('notFound()'));
  assert.ok(page.includes('key={actor.tenantId'));assert.ok(overview.includes('isShopifyConnectionScreenEnabled(tenant.id'));
  assert.ok(readFileSync(new URL('../.env.example',import.meta.url),'utf8').includes('SHOPIFY_CONNECTION_SCREEN_ENABLED=false'));
  const panel=readFileSync(new URL('../src/components/settings/shopify-connection-panel.tsx',import.meta.url),'utf8');
  assert.ok(panel.includes('active.current=null'));assert.ok(panel.includes('30000'));
});
