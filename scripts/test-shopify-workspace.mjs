import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {applicationView} from './fixtures/shopify-application-view.mjs';
function component({actionState,onStateChange,onButton}={}){
  const code=ts.transpileModule(readFileSync(new URL('../src/components/settings/shopify-workspace.tsx',import.meta.url),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const m={exports:{}};vm.runInNewContext(code,{module:m,exports:m.exports,require(name){
    if(name==='react')return {...React,
      ...(actionState?{useActionState:()=>[actionState,()=>{},false]}:{}),
      ...(onStateChange?{useState:initial=>[initial,onStateChange]}:{})};if(name==='react/jsx-runtime')return jsx;
    if(name==='next/navigation')return {useRouter:()=>({refresh(){}})};
    if(name==='next/link')return {default:({children,...props})=>React.createElement('a',props,children),__esModule:true};
    if(name==='@/components/ui/button')return {Button:({children,...props})=>{onButton?.({children,...props});return React.createElement('button',props,children);}};
    if(name==='@/components/ui/dialog')return {Dialog:({trigger})=>React.createElement('button',{type:'button'},trigger)};
    if(name==='@/integrations/shopify/application-display')return {shopifyPilotTime:()=> '13 Oct 2026, 05:30 IST'};
    throw Error(name);
  },requestAnimationFrame:callback=>callback()});return m.exports.ShopifyWorkspace;
}
test('actual workspace renders bounded owner workflow with responsive forms and source-only payment copy',()=>{
  const Workspace=component(),html=renderToStaticMarkup(React.createElement(Workspace,{view:applicationView(),action:async()=>assert.fail('render must not mutate')}));
  for(const text of ['One approved existing Shopify order only','Back to settings','Review before production','Variant mappings','Health &amp; privacy','No OS Plus receipt','Save review'])assert.ok(html.includes(text),text);
  assert.ok(html.includes('sm:grid-cols-2'));assert.ok(html.includes('data-preserve-dirty-on-submit="true"'));assert.ok(html.includes('data-unsaved-guard="true"'));
  assert.ok(!/<input[^>]+(?:quantity|amount|price|tenantId|clientSecret)/i.test(html));assert.ok(!html.includes('ciphertext'));assert.ok(!html.includes('<button type="button"><button'));
  assert.ok(html.includes('<section hidden=""'));assert.ok(!html.includes('Date.now'));
});

test('automatic import mode links unreleased orders and removes mandatory production forms',()=>{
  const view=applicationView();view.automaticOrderCreation=true;
  const html=renderToStaticMarkup(React.createElement(component(),{view,action:async()=>assert.fail('render must not mutate')}));
  assert.ok(html.includes(`href="/orders/${view.sources[0].orderId}"`));
  assert.ok(html.includes('without mapping or release'));
  assert.ok(!html.includes('Save review'));assert.ok(!html.includes('Release reviewed items'));
  assert.ok(!html.includes('Needs mapping'));assert.ok(!html.includes('Map variants, choose'));
});
test('unknown outcome preserves form/retry intent and mapping dialog is controlled through pending and success',()=>{
  const code=readFileSync(new URL('../src/components/settings/shopify-workspace.tsx',import.meta.url),'utf8');
  assert.ok(code.includes('if(next.status==="success"){intent.current=null;'));assert.ok(code.includes('onPendingChange={setBusy}'));assert.ok(code.includes('preventClose={busy}'));
  assert.ok(code.includes('onSuccess={()=>{setOpen(false)'));assert.ok(code.includes('try{next=await action(previous,payload);}catch'));
  assert.ok(!code.includes('tab==="inbox"&&'));assert.ok(!code.includes('toLocaleString'));assert.ok(!code.includes('Date.now()'));
});

test('unreleased drafts stay in the inbox, including the copy-success action',()=>{
  const view=applicationView(),buttons=[],changes=[];
  const Workspace=component({actionState:{status:'success',message:'Draft copied.',orderId:view.sources[0].orderId},onButton:b=>buttons.push(b),onStateChange:s=>changes.push(s)});
  const html=renderToStaticMarkup(React.createElement(Workspace,{view,action:async()=>assert.fail('navigation must not mutate')}));
  assert.ok(!html.includes(`/orders/${view.sources[0].orderId}`),'a draft must not link to the released-only details page');
  assert.ok(html.includes('Review this draft below'));
  const review=buttons.find(b=>b.children==='Review copied order');
  assert.ok(review,'copy success needs an inbox action');
  assert.equal(review.type,'button','review must not submit another worker request');
  review.onClick();
  assert.deepEqual(changes,['inbox']);
  assert.match(html,/<h3[^>]*tabindex="-1"[^>]*>Review before production/);
});

test('released order details remain available without exposing draft operations',()=>{
  const view=applicationView();view.sources[0].orderStatus='confirmed';
  const html=renderToStaticMarkup(React.createElement(component(),{view,action:async()=>assert.fail('render must not mutate')}));
  assert.ok(html.includes(`href="/orders/${view.sources[0].orderId}"`));
  assert.ok(html.includes('Order details'));assert.ok(!html.includes('Save review'));assert.ok(!html.includes('Review this draft below'));
});

test('unavailable draft sources never expose an operational details link',()=>{
  for(const status of ['partial','expired','redacted']){
    const view=applicationView();Object.assign(view.sources[0],{sourceStatus:status,lines:[],payment:null});
    const html=renderToStaticMarkup(React.createElement(component(),{view,action:async()=>assert.fail('render must not mutate')}));
    assert.ok(!html.includes(`/orders/${view.sources[0].orderId}`),status);
    assert.match(html,/disabled=""[^>]*>Save review/);
  }
});

test('copy feedback stays safe while the refreshed inbox has not arrived',()=>{
  const view=applicationView(),orderId=view.sources[0].orderId;view.sources=[];
  const Workspace=component({actionState:{status:'success',message:'Draft copied.',orderId}});
  const html=renderToStaticMarkup(React.createElement(Workspace,{view,action:async()=>assert.fail('render must not mutate')}));
  assert.ok(html.includes('Review copied order'));assert.ok(!html.includes(`/orders/${orderId}`));
});

test('only successful release feedback offers an operational order link',()=>{
  const view=applicationView(),source=view.sources[0];
  source.review={id:'c0000000-0000-4000-8000-000000000001',version:1,current:true,
    decision:{customerId:source.customerId,deliveryType:'courier',reason:'Fictional review',lines:[]}};
  const render=status=>renderToStaticMarkup(React.createElement(component({actionState:{status,message:'Action result',orderId:source.orderId}}),{view,action:async()=>assert.fail('render must not mutate')}));
  const success=render('success');
  assert.equal(success.split(`href="/orders/${source.orderId}"`).length-1,1,'only the release command may expose the operational link');
  assert.ok(success.includes('Open order'));
  for(const status of ['error','idle']){
    const html=render(status);assert.ok(!html.includes(`/orders/${source.orderId}`));assert.ok(!html.includes('Review copied order'));
  }
});
