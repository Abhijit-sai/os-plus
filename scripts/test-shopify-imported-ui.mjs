import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
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
const cards=load('../src/components/ui/card.tsx',{'@/lib/utils':{cn:(...values)=>values.filter(Boolean).join(' ')}});
const payment=load('../src/components/orders/shopify-payment-panel.tsx',{'@/components/ui/card':cards});
const {ShopifyImportedOrder,ShopifyImportedOrderList}=load('../src/components/orders/shopify-imported-order.tsx',{
  '@/components/ui/card':cards,'@/components/orders/shopify-payment-panel':payment,
  'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
  '@/components/ui/button':{Button:({children})=>children},
});
const order={id:'fictional',number:'ORD-TEST',sourceNumber:'#TEST',availability:'available',createdAt:'2026-10-19T08:00:00Z',cancelledAt:null,
  fulfillmentStatus:'UNFULFILLED',note:'<script>not executable</script>',customer:{name:'Guest',email:null,phone:null},
  shippingAddress:{firstName:'Fictional',lastName:'Buyer',phone:'fictional-shipping-phone',address1:'Test address'},
  billingAddress:{firstName:'Fictional',lastName:'Buyer',phone:'fictional-billing-phone',address1:'Test billing address'},
  lines:[{id:'line',title:'Test pants',quantity:3,currentQuantity:2,variant:'Black / 38',sku:null,unitPrice:'100.00',unitCurrency:'INR',currentLineSubtotal:'180.00',properties:[]}],
  payment:{availability:'unavailable'},currency:'INR',subtotal:'180.00',discount:'20.00',shipping:'10.00',tax:'32.40'};
test('actual imported detail shows source line totals and address phones without mapping release or money controls',()=>{
  const html=renderToStaticMarkup(React.createElement(ShopifyImportedOrder,{order}));
  for(const label of ['Back to orders','ORD-TEST','#TEST','Test pants','Quantity 3','Current quantity: 2','Original unit price: INR 100.00',
    'Current line subtotal after discounts, before tax: INR 180.00','fictional-shipping-phone','fictional-billing-phone','Production not assigned'])assert.ok(html.includes(label),label);
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
  assert.ok(!/<form|<input|Release reviewed|Save mapping/.test(html));
  assert.ok(html.includes('sm:grid-cols-2'));assert.ok(html.includes('break-words'));
});
test('expired/partial/unavailable imports render clearly without leaking prior customer or source details',()=>{
  for(const availability of ['expired','partial','unavailable']){
    const html=renderToStaticMarkup(React.createElement(ShopifyImportedOrder,{order:{...order,availability}}));
    assert.ok(html.includes('role="status"'));assert.ok(!html.includes('fictional-shipping-phone'));assert.ok(!html.includes('Test pants'));
  }
  const html=renderToStaticMarkup(React.createElement(ShopifyImportedOrderList,{orders:[{...order,availability:'expired'}]}));
  assert.ok(html.includes('href="/orders/fictional"'));assert.ok(html.includes('retention has expired'));
  assert.ok(!html.includes('Guest'));
});
