import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {applicationView} from './fixtures/shopify-application-view.mjs';
function component(){
  const code=ts.transpileModule(readFileSync(new URL('../src/components/settings/shopify-workspace.tsx',import.meta.url),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const m={exports:{}};vm.runInNewContext(code,{module:m,exports:m.exports,require(name){
    if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;
    if(name==='next/navigation')return {useRouter:()=>({refresh(){}})};
    if(name==='next/link')return {default:({children,...props})=>React.createElement('a',props,children),__esModule:true};
    if(name==='@/components/ui/button')return {Button:({children,...props})=>React.createElement('button',props,children)};
    if(name==='@/components/ui/dialog')return {Dialog:({trigger})=>React.createElement('button',{type:'button'},trigger)};
    if(name==='@/integrations/shopify/application-display')return {shopifyPilotTime:()=> '13 Oct 2026, 05:30 IST'};
    throw Error(name);
  }});return m.exports.ShopifyWorkspace;
}
test('actual workspace renders bounded owner workflow with responsive forms and source-only payment copy',()=>{
  const Workspace=component(),html=renderToStaticMarkup(React.createElement(Workspace,{view:applicationView(),action:async()=>assert.fail('render must not mutate')}));
  for(const text of ['One approved existing Shopify order only','Back to settings','Review before production','Variant mappings','Health &amp; privacy','No OS Plus receipt','Save review'])assert.ok(html.includes(text),text);
  assert.ok(html.includes('sm:grid-cols-2'));assert.ok(html.includes('data-preserve-dirty-on-submit="true"'));assert.ok(html.includes('data-unsaved-guard="true"'));
  assert.ok(!/<input[^>]+(?:quantity|amount|price|tenantId|clientSecret)/i.test(html));assert.ok(!html.includes('ciphertext'));assert.ok(!html.includes('<button type="button"><button'));
  assert.ok(html.includes('<section hidden=""'));assert.ok(!html.includes('Date.now'));
});
test('unknown outcome preserves form/retry intent and mapping dialog is controlled through pending and success',()=>{
  const code=readFileSync(new URL('../src/components/settings/shopify-workspace.tsx',import.meta.url),'utf8');
  assert.ok(code.includes('if(next.status==="success"){intent.current=null;'));assert.ok(code.includes('onPendingChange={setBusy}'));assert.ok(code.includes('preventClose={busy}'));
  assert.ok(code.includes('onSuccess={()=>{setOpen(false)'));assert.ok(code.includes('try{next=await action(previous,payload);}catch'));
  assert.ok(!code.includes('tab==="inbox"&&'));assert.ok(!code.includes('toLocaleString'));assert.ok(!code.includes('Date.now()'));
});
