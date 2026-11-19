import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import * as draftSetup from '../src/integrations/shopify/draft-setup.ts';
const code=ts.transpileModule(readFileSync(new URL('../src/components/orders/shopify-draft-setup-form.tsx',import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function render(viewPatch={},title='Original Shopify title'){
  let customerProps;
  const mod={exports:{}},plain=({children,...props})=>React.createElement('div',props,children);
  const imports={'react':React,'react/jsx-runtime':jsx,'next/navigation':{useRouter:()=>({refresh(){}})},
    '@/components/ui/button':{Button:({asChild,children,...props})=>asChild?children:React.createElement('button',props,children)},
    '@/components/ui/card':{Card:plain,CardContent:plain,CardHeader:plain,CardTitle:plain},
    '@/integrations/shopify/draft-setup':draftSetup,
    '@/components/orders/shopify-image-preview':{ShopifyImagePreview:()=>null},
    '@/components/customers/create-customer-dialog':{CreateCustomerDialog:props=>{customerProps=props;return props.trigger;}}};
  vm.runInNewContext(code,{module:mod,exports:mod.exports,require:name=>{assert.ok(name in imports,name);return imports[name];}});
  const view={tenantId:id(1),orderId:id(2),connectionId:id(3),sourceRevisionId:id(4),setupId:id(5),version:1,current:true,
    customerId:null,customers:[],itemTypes:[],workflows:[],sizes:[],choices:{customerId:null,deliveryType:'store_pickup',
      promisedDeliveryDate:null,note:'',lines:[{lineGid:'gid://shopify/LineItem/1',itemTypeId:id(6),workflowId:id(7),standardSizeId:null,expectedCompletionDate:null}]}};
  const html=renderToStaticMarkup(React.createElement(mod.exports.ShopifyDraftSetupForm,{view:{...view,...viewPatch},sourceCustomerName:'Fictional buyer',
    lines:[{id:'gid://shopify/LineItem/1',title,variant:null,quantity:1}],
    submitAction:async()=>{throw Error('No external action permitted');},searchOptions:async()=>({status:'success',rows:[],hasMore:false})}));
  return {html,customerProps};
}
test('actual setup form explains the missing customer and offers an inline prefilled resolution',()=>{
  const {html,customerProps}=render();
  assert.ok(html.includes('You can still save this draft.'));
  assert.ok(html.includes('Add customer'));
  assert.equal(customerProps.initialName,'Fictional buyer');
  assert.equal(customerProps.initialPhone,undefined,'address phones must never be guessed into identity');
  assert.match(html,/<button[^>]*value="save"[^>]*>Save draft<\/button>/);
  assert.match(html,/<button[^>]*value="complete"[^>]*disabled=""[^>]*>Start production<\/button>/);
});

test('a linked buyer and the garment default make an existing draft ready while delivery stays highlighted',()=>{
  const view={customerId:id(8),itemTypes:[{id:id(6),name:'Shirt',defaultWorkflowId:id(7)}],
    workflows:[{id:id(7),name:'Default shirt workflow',itemTypeId:id(6)},{id:id(9),name:'Express workflow',itemTypeId:id(6)}],
    choices:{customerId:id(8),deliveryType:null,promisedDeliveryDate:null,note:'',lines:[{
      lineGid:'gid://shopify/LineItem/1',itemTypeId:null,workflowId:null,standardSizeId:null,expectedCompletionDate:null,
    }]}};
  const {html}=render(view,'Oxford shirt');
  assert.match(html,/<option[^>]*selected=""[^>]*>Default shirt workflow<\/option>/);
  assert.match(html,/<select[^>]*border-amber-500[^>]*>/);
  assert.match(html,/<button(?![^>]*disabled)[^>]*value="complete"[^>]*>Start production<\/button>/);
  view.choices.lines[0].itemTypeId=id(6);
  view.choices.lines[0].workflowId=id(9);
  assert.match(render(view,'Oxford shirt').html,/<option[^>]*selected=""[^>]*>Express workflow<\/option>/);
});
test('production name is editable while the Shopify title remains visible',()=>{
  const {html}=render();
  assert.ok(html.includes('Production name (optional)'));
  assert.ok(html.includes('Shopify title: Original Shopify title'));
  assert.match(html,/<input[^>]*maxLength="2000"[^>]*placeholder="Original Shopify title"/);
});
