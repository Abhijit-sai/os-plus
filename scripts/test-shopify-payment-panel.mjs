import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
function load(path,imports) {
  const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,
    target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const testModule={exports:{}};vm.runInNewContext(code,{module:testModule,exports:testModule.exports,require(name){
    if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;
    if(Object.hasOwn(imports,name))return imports[name];throw Error(name);
  }});return testModule.exports;
}
const cards=load('../src/components/ui/card.tsx',{'@/lib/utils':{cn:(...values)=>values.filter(Boolean).join(' ')}});
const {ShopifyPaymentPanel}=load('../src/components/orders/shopify-payment-panel.tsx',{'@/components/ui/card':cards});
const amounts={total:'118.00',received:'118.00',refunded:'0.00',net:'118.00',outstanding:'-20.00'};
const payment={availability:'available',status:'PAID',statusLabel:'Paid',currency:'INR',presentmentCurrency:'USD',amounts,
  presentmentAmounts:{...amounts,total:'2.00',received:'2.00',net:'2.00'},observedAt:'2026-10-08T18:30:00Z',
  sourceUpdatedAt:'2026-10-08T18:00:00Z',productionHeld:true,validation:'source_consistent',reasons:[]};
test('actual server panel renders labelled source money and held/as-observed context without any payment form',()=>{
  const html=renderToStaticMarkup(React.createElement(ShopifyPaymentPanel,{payment}));
  for(const label of ['Shopify payment summary','Paid','INR 118.00','INR −20.00','USD 2.00','Received','Refunded','Outstanding',
    'Excluded from OS PLUS cash','Production is held','9 Oct 2026','IST','not a live Shopify balance'])assert.ok(html.includes(label),label);
  assert.ok(html.includes('<dl'));assert.ok(html.includes('<dt'));assert.ok(html.includes('<dd'));
  assert.ok(!/<form|<input|<button/.test(html));
});
test('unavailable and review states are distinct from zero/verified cash; exact large decimals are not rounded',()=>{
  const unavailable=renderToStaticMarkup(React.createElement(ShopifyPaymentPanel,{payment:{availability:'unavailable'}}));
  assert.ok(unavailable.includes('role="status"'));assert.ok(unavailable.includes('do not assume a zero payment'));assert.ok(!unavailable.includes('INR 0'));
  const review=renderToStaticMarkup(React.createElement(ShopifyPaymentPanel,{payment:{...payment,validation:'review',amounts:{...amounts,received:'999999999999999999.001'}}}));
  assert.ok(review.includes('role="alert"'));assert.ok(review.includes('not verified cash receipts'));assert.ok(review.includes('9,99,99,99,99,99,99,99,999.001'));
});
