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
  const m={exports:{}};vm.runInNewContext(code,{module:m,exports:m.exports,URLSearchParams,require(name){
    if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;
    if(Object.hasOwn(imports,name))return imports[name];throw Error(name);
  }});return m.exports;
}
const cards=load('../src/components/ui/card.tsx',{'@/lib/utils':{cn:(...values)=>values.filter(Boolean).join(' ')}});
const payment=load('../src/components/orders/shopify-payment-panel.tsx',{'@/components/ui/card':cards});
const utils={'@/lib/utils':{cn:(...values)=>values.filter(Boolean).join(' ')}};
const {ShopifyImportedOrder,ShopifyImportedOrderList}=load('../src/components/orders/shopify-imported-order.tsx',{
  '@/components/ui/card':cards,'@/components/orders/shopify-payment-panel':payment,
  '@/components/layout/page-header':load('../src/components/layout/page-header.tsx',utils),
  '@/components/layout/command-bar':load('../src/components/layout/command-bar.tsx',utils),
  '@/components/dashboard/metric-card':load('../src/components/dashboard/metric-card.tsx',{...utils,'@/components/ui/card':cards}),
  '@/components/orders/shopify-image-preview':{ShopifyImagePreview:()=>null},
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
    'Current line subtotal after discounts, before tax: INR 180.00','fictional-shipping-phone','fictional-billing-phone','Draft — needs setup'])assert.ok(html.includes(label),label);
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
  assert.ok(!/<form|<input|Release reviewed|Save mapping/.test(html));
  assert.ok(html.includes('sm:grid-cols-2'));assert.ok(html.includes('break-words'));
});

test('completed order can embed retained source details without a false draft heading or duplicate payment controls',()=>{
  const html=renderToStaticMarkup(React.createElement(ShopifyImportedOrder,{order,embedded:true}));
  assert.ok(html.includes('Test pants'));assert.ok(html.includes('fictional-shipping-phone'));
  assert.ok(!html.includes('Draft — needs setup'));assert.ok(!html.includes('Back to orders'));
  assert.ok(!html.includes('No workflow or worker has been assigned'));
});
test('draft setup is before commercial details and replaces the duplicate source item list',()=>{
  const html=renderToStaticMarkup(React.createElement(ShopifyImportedOrder,{order,
    setup:React.createElement('form',null,'Pending actions','Editable garment cards')}));
  assert.ok(html.includes('Pending actions'));
  assert.ok(html.indexOf('Pending actions')<html.indexOf('Shipping address'));
  assert.ok(!html.includes('Items from Shopify'));
  assert.ok(html.includes('Reference order ID'));
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

test('Orders renders local and Shopify drafts in one ordinary list, with no release gate or fake cash balance',async()=>{
  const base={order_number:'LOCAL-001',id:'local-order',source:'walk_in',order_status:'confirmed',reference_order_id:'LOCAL-REF',customer_id:'customer',
    delivery_type:'store_pickup',promised_delivery_date:null,payment_status:'unpaid',amount_paid:0,total_amount:100};
  const draft={...base,id:'shopify-draft',order_number:'SHOPIFY-001',source:'shopify',order_status:'draft',reference_order_id:'PT2324',customer_id:null,delivery_type:null};
  const data={page:1,hasNextPage:true,orders:[base,draft],customers:[{id:'customer',name:'Local customer',phone:null}],orderItems:[],stageInstances:[],search:'',shopifySummaries:[],
    shopifyCommercialSummaries:[{orderId:draft.id,reference:'PT2324',customerName:'Imported customer',customerPhone:null,currency:'INR',paymentLabel:'Paid',total:'3902.20',received:'3902.20',itemCount:1}]};
  const {default:Page}=load('../src/app/(tenant)/orders/page.tsx',{
    'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
    'lucide-react':{ArrowUpRight:()=>null,Plus:()=>null,Search:()=>null},
    '@/features/orders/queries':{getOrdersPageData:async()=>data},
    '@/features/orders/financial-display':{localOrderReceivable:o=>o.source==='shopify'?0:100,matchesLocalPayment:(o,s)=>o.source!=='shopify'&&o.payment_status===s},
    '@/features/orders/delivery-date':{deliveryDayOffset:()=>null},
    '@/components/dashboard/metric-card':{MetricCard:({label,value})=>React.createElement('div',null,label,value)},
    '@/components/design-system/status-badge':{StatusBadge:({value})=>React.createElement('span',null,value)},
    '@/components/layout/command-bar':{CommandBar:({children})=>children},
    '@/components/layout/page-header':{PageHeader:({title})=>React.createElement('h1',null,title)},
    '@/components/ui/button':{Button:({children})=>children},'@/components/ui/card':cards,
    '@/components/ui/input':{Input:props=>React.createElement('input',props)},
    '@/components/ui/label':{Label:props=>React.createElement('label',props)},
  });
  const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({})}));
  for(const label of ['LOCAL-001','SHOPIFY-001','PT2324','Imported customer','Needs manager setup','Not started · complete order setup','INR','3902.20','Not collected here'])
    assert.ok(html.includes(label),label);
  assert.equal((html.match(/href="\/orders\/shopify-draft"/g)??[]).length,1);
  assert.ok(!html.includes('Imported from Shopify'));assert.ok(!html.includes('Production held · owner review'));
  assert.ok(html.includes('value="draft"'));
  assert.ok(html.includes('aria-label="Order pages"'));assert.ok(html.includes('href="/orders?page=2"'));
});
