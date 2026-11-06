import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {z} from 'zod';
import {randomBytes} from 'node:crypto';
const root=process.cwd();
function load(path,imports){
 const code=ts.transpileModule(readFileSync(root+'/'+path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const m={exports:{}};vm.runInNewContext(code,{module:m,exports:m.exports,URLSearchParams,Date,Map,Set,Error,FormData,Buffer,console,require(name){
  if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;if(Object.hasOwn(imports,name))return imports[name];throw Error('Unexpected import '+name);
 }});return m.exports;
}
const children=({children})=>children;
const ui={
 'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
 'lucide-react':new Proxy({},{get:()=>()=>null}),
 '@/components/ui/card':Object.fromEntries(['Card','CardHeader','CardContent','CardTitle','CardDescription'].map(n=>[n,children])),
 '@/components/ui/button':{Button:children},
 '@/components/layout/page-header':{PageHeader:({title})=>React.createElement('h1',null,title)},
 '@/components/design-system/status-badge':{StatusBadge:({value})=>React.createElement('span',{'data-status':value},value)},
 '@/components/item-types/item-type-icon':{ItemTypeIcon:()=>null},
 '@/components/production/production-filter-bar':{ProductionFilterBar:()=>null},
 '@/components/production/item-workflow-panel':{ItemWorkflowPanel:()=>null},
};
function productionData({status='completed',lastName='Dispatch',workflowStatus='completed',stageStatus='completed'}={}){
 return {context:{membership:{role:'owner_admin'}},shopifySummaries:[],orders:[{id:'order',order_number:'FIXTURE-ONLY',customer_id:'customer',source:'walk_in'}],
 customers:[{id:'customer',name:'Fixture customer'}],items:[{id:'item',order_id:'order',name:'Finished fixture shirt',color:'White',item_type_id:'type',workflow_id:'workflow',item_status:status,expected_completion_date:'2020-01-01'}],
 itemTypes:[{id:'type',name:'Shirt'}],workflows:[{id:'workflow',name:'Fixture workflow'}],workflowStages:[],
 workflowInstances:[{id:'instance',order_item_id:'item',status:workflowStatus,current_stage_instance_id:workflowStatus==='completed'?null:'last'}],
 stageInstances:[{id:'last',workflow_instance_id:'instance',order_item_id:'item',stage_master_id:'dispatch',sequence_number:1,status:stageStatus}],stages:[{id:'dispatch',name:lastName}],workLogs:[],workers:[]};
}
async function production(params={},fixture={}){
 const {default:Page}=load('src/app/(tenant)/production/page.tsx',{...ui,'@/features/production/queries':{getProductionPageData:async()=>productionData(fixture),getProductionItemPageData:async()=>null}});
 return renderToStaticMarkup(await Page({searchParams:Promise.resolve(params)}));
}
test('finished production is excluded from the active workshop and has a separate completed queue',async()=>{
 assert.ok(!(await production()).includes('Finished fixture shirt'),'Completed workflow is still shown as active work');
 assert.ok((await production({queue:'completed'})).includes('Finished fixture shirt'),'Completed work must remain discoverable');
});
test('stage names cannot manufacture customer delivery; delivered items remain discoverable',async()=>{
 assert.ok(!(await production({queue:'delivered'},{lastName:'Delivery preparation'})).includes('Finished fixture shirt'),'A stage name must not be treated as proof of delivery');
 assert.ok((await production({queue:'delivered'},{status:'delivered',lastName:'Handover check'})).includes('Finished fixture shirt'));
});
test('main dashboard exposes delivered products and finished production awaiting handoff',async()=>{
 const item=productionData().items[0];
 const data={context:{tenant:{store_name:'Fixture shop'}},orders:[],orderPayments:[],items:[item,{...item,id:'delivered',item_status:'delivered'}],workflowInstances:[],stageInstances:[],workflows:[],stages:[],workLogs:[],workers:[],expenses:[],dues:[],attendance:[]};
 const {default:Page}=load('src/app/(tenant)/dashboard/page.tsx',{...ui,
  '@/features/dashboard/queries':{getDashboardPageData:async()=>data},
  '@/components/leads/waiting-widget':{ChatWaitingWidget:()=>null},
  '@/components/layout/command-bar':{CommandBar:children},
  '@/components/ui/dialog':{Dialog:children},
  '@/components/dashboard/analytics-charts':{SalesBarChart:()=>null,AttendanceStackedBarChart:()=>null,WorkerLineChart:()=>null},
  '@/components/dashboard/metric-card':{MetricCard:({label,value})=>React.createElement('div',{'data-metric':label},String(value))},
 });
 const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({})}));
 assert.match(html,/data-metric="Delivered items">1</,'Delivered products need an explicit dashboard count');
 assert.match(html,/data-metric="Ready handoff">1</,'Finished production must remain visible for handoff');
});
const ids={tenant:'10000000-0000-4000-8000-000000000001',customer:'10000000-0000-4000-8000-000000000002',type:'10000000-0000-4000-8000-000000000003',workflow:'10000000-0000-4000-8000-000000000004',order:'10000000-0000-4000-8000-000000000005'};
function orderHarness(role='manager',failTable=null){
 const writes=[],workflowItems=[],cachePaths=[];
 class Query{
  constructor(table){this.table=table;this.operation='read';}
  select(){return this;}eq(){return this;}in(){return this;}is(){return this;}
  insert(value){this.operation='insert';this.value=value;return this;}
  result(single=false){
   if(this.operation==='insert'){
    writes.push({table:this.table,value:JSON.parse(JSON.stringify(this.value))});
    if(this.table===failTable)return {data:null,error:{message:'PRIVATE_DATABASE_DETAIL_FIXTURE'}};
    if(this.table==='orders')return {data:{id:ids.order},error:null};
    if(this.table==='order_items')return {data:this.value.map((row,index)=>({...row,id:`20000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`})),error:null};
    return {data:null,error:null};
   }
   const id={customers:ids.customer,item_types:ids.type,workflows:ids.workflow}[this.table];
   return {data:single?{id}:[{id}],error:null};
  }
  maybeSingle(){return Promise.resolve(this.result(true));}single(){return Promise.resolve(this.result(true));}
  then(ok,bad){return Promise.resolve(this.result()).then(ok,bad);}
 }
 const permissions=load('src/lib/permissions/roles.ts',{});
 const actions=load('src/features/orders/actions.ts',{
  crypto:{randomBytes},'next/cache':{revalidatePath:path=>cachePaths.push(path)},
  'next/navigation':{redirect(path){const e=Error('redirect');e.digest='NEXT_REDIRECT';e.path=path;throw e;},unstable_rethrow(e){if(e?.digest==='NEXT_REDIRECT')throw e;}},
  zod:{z},'@/lib/permissions/roles':permissions,
  '@/lib/supabase/server':{createSupabaseServiceRoleClient:()=>({from:table=>new Query(table)})},
  '@/lib/tenant/context':{requireTenantContext:async()=>({tenant:{id:ids.tenant},membership:{role,clerk_user_id:'fixture-operator'}})},
  '@/features/production/instances':{createWorkflowInstanceForOrderItem:async(item)=>{workflowItems.push(item.id);return 'fixture-instance';}},
 });
 return {actions,writes,workflowItems,cachePaths};
}
function orderForm(){
 const f=new FormData();
 for(const [key,value] of Object.entries({referenceOrderId:'',source:'walk_in',customerId:ids.customer,orderDate:'2026-11-06',promisedDeliveryDate:'',deliveryType:'store_pickup',deliveryAddress:'',orderGstTreatment:'not_applicable',orderGstRate:'0',notes:'',initialPaymentAmount:'0',initialPaymentModeId:'',initialPaymentDate:'2026-11-06',initialPaymentReference:'',initialPaymentNotes:''}))f.set(key,value);
 for(const [row,name,color] of [['row_1','White shirt','White'],['row_2','Black shirt','Black']]){
  f.append('itemRowId',row);for(const [field,value] of Object.entries({itemName:name,itemTypeId:ids.type,workflowId:ids.workflow,itemColor:color,itemQuantity:'1',itemUnitPrice:'100',itemDiscountAmount:'0'}))f.set(`${field}_${row}`,value);
 }return f;
}
test('owner and manager order submission preserve distinct product names and initialize each item',async()=>{
 for(const role of ['owner_admin','manager']){
  const h=orderHarness(role);
  await assert.rejects(()=>h.actions.createOrderAction(orderForm()),e=>e.digest==='NEXT_REDIRECT'&&e.path===`/orders/${ids.order}`);
  const items=h.writes.find(w=>w.table==='order_items').value;
  assert.deepEqual(items.map(i=>[i.name,i.color]),[['White shirt','White'],['Black shirt','Black']]);
  assert.equal(h.workflowItems.length,2);assert.equal(new Set(h.workflowItems).size,2);
 }
});
test('new-order validation returns actionable inline feedback without database writes',async()=>{
 const h=orderHarness();const form=orderForm();form.set('customerId','');
 assert.equal(typeof h.actions.createOrderFormAction,'function','The new-order form needs a recoverable action result');
 const state=await h.actions.createOrderFormAction({ok:false,message:null},form);
 assert.equal(state.ok,false);assert.match(state.message,/select a customer/i);assert.equal(h.writes.length,0);
});
test('new-order form preserves successful redirects and denies Finance without writes',async()=>{
 const success=orderHarness();await assert.rejects(()=>success.actions.createOrderFormAction({ok:false,message:null,reviewOrders:false},orderForm()),e=>e.digest==='NEXT_REDIRECT');
 const denied=orderHarness('finance');const result=await denied.actions.createOrderFormAction({ok:false,message:null,reviewOrders:false},orderForm());
 assert.equal(result.ok,false);assert.match(result.message,/role cannot create orders/i);assert.equal(denied.writes.length,0);
});
test('a second item with a missing workflow receives a row-specific recoverable error',async()=>{
 const h=orderHarness();const form=orderForm();form.set('workflowId_row_2','');
 const state=await h.actions.createOrderFormAction({ok:false,message:null,reviewOrders:false},form);
 assert.equal(state.ok,false);assert.match(state.message,/workflow for item 2/i);assert.equal(state.reviewOrders,false);assert.equal(h.writes.length,0);
});
test('new orders invalidate the production and main-dashboard views as well as the order list',async()=>{
 const h=orderHarness();await assert.rejects(()=>h.actions.createOrderAction(orderForm()),e=>e.digest==='NEXT_REDIRECT');
 for(const path of ['/orders','/production','/dashboard'])assert.ok(h.cachePaths.includes(path),`Missing invalidation for ${path}`);
});
test('uncertain or partial order saves require reconciliation and never expose database details',async()=>{
 for(const table of ['orders','order_items']){
  const h=orderHarness('manager',table);const state=await h.actions.createOrderFormAction({ok:false,message:null,reviewOrders:false},orderForm());
  assert.equal(state.ok,false);assert.equal(state.reviewOrders,true);assert.match(state.message,/check the order list/i);assert.ok(!state.message.includes('PRIVATE_DATABASE_DETAIL_FIXTURE'));
 }
});

function pageQueryHarness() {
 const tenant='fixture-tenant';
 const items=Array.from({length:1205},(_,i)=>({id:`item-${String(i).padStart(4,'0')}`,tenant_id:tenant,order_id:'order',item_status:i===1204?'delivered':'in_production'}));
 const stages=items.flatMap(item=>Array.from({length:2},(_,n)=>({id:`${item.id}-stage-${n}`,tenant_id:tenant,order_item_id:item.id})));
 const calls=[];
 class Query {
  constructor(table){this.table=table;this.filters=[];this.start=0;this.end=999;}
  select(){return this;}eq(field,value){this.filters.push([field,value]);return this;}is(){return this;}order(){return this;}
  in(field,values){this.filters.push([field,values]);return this;}
  limit(n){this.end=n-1;return this;}range(from,to){this.start=from;this.end=to;return this;}
  then(ok,bad){
   calls.push({table:this.table,filters:this.filters});
   assert.ok(this.filters.some(([field,value])=>field==='tenant_id'&&value===tenant),'Every page must be tenant-scoped');
   let rows=['operational_order_items','order_items'].includes(this.table)?items:this.table==='item_stage_instances'?stages:this.table==='operational_orders'?[{id:'order',tenant_id:tenant,customer_id:'customer',source:'walk_in'}]:this.table==='customers'?[{id:'customer',tenant_id:tenant,name:'Fictional buyer'}]:[];
   for(const [field,value] of this.filters)rows=rows.filter(row=>Array.isArray(value)?value.includes(row[field]):row[field]===value);
   return Promise.resolve({data:rows.slice(this.start,Math.min(this.end+1,this.start+1000)),error:null}).then(ok,bad);
  }
 }
 const imports={'server-only':{},zod:{z},'next/navigation':{notFound(){throw Error('not found');}},
 '@/lib/supabase/server':{createSupabaseServiceRoleClient:()=>({from:table=>new Query(table)})},
 '@/lib/tenant/context':{requireTenantContext:async()=>({tenant:{id:tenant},membership:{role:'owner_admin'}})},
 '@/features/orders/shopify-operational':{getShopifyOperationalSummaries:async()=>[]},
 '@/lib/permissions/roles':{assertPermission(){},hasPermission(){return true;}}};
 return {imports,calls};
}
test('production retains older delivered products and every related stage beyond response caps',async()=>{
 const h=pageQueryHarness();const queries=load('src/features/production/queries.ts',h.imports);
 const data=await queries.getProductionPageData({itemTypeIds:[],workflowIds:[]});
 assert.equal(data.items.length,1205,'Latest-100 truncation hides older products before the delivered filter');
 assert.equal(data.items.at(-1).item_status,'delivered');
 assert.equal(data.stageInstances.length,2410,'PostgREST default cap must not truncate workflow stages');
 assert.equal(new Set(data.stageInstances.map(row=>row.id)).size,2410);
 for(const call of h.calls.filter(c=>['item_stage_instances','item_stage_work_logs','item_workflow_instances'].includes(c.table)))assert.ok(call.filters.some(([field,ids])=>field==='order_item_id'&&Array.isArray(ids)&&ids.length<=100),'Related pages must be scoped to bounded displayed-item IDs');
});
test('dashboard product metrics read beyond the newest 200 items',async()=>{
 const h=pageQueryHarness();const queries=load('src/features/dashboard/queries.ts',h.imports);
 const data=await queries.getDashboardPageData();assert.equal(data.items.length,1205);assert.equal(data.items.at(-1).item_status,'delivered');
});
test('legacy completion uses explicit final status for both completion and correction callers',async()=>{
 const path='src/features/production/actions.ts';
 const source=readFileSync(root+'/'+path,'utf8');
 const code=ts.transpileModule(source+'\n;module.exports.resolveCompletionForFixture = getCompletedWorkflowItemStatus;', {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 for(const [label,final,expected] of [['Receipt confirmed',true,'delivered'],['Delivery preparation',false,'completed']]){
  const m={exports:{}};const predicates=[];
  const query={select(){return this;},eq(field,value){predicates.push([field,value]);return this;},is(){return this;},maybeSingle:async()=>({data:{name:label,is_final_status:final},error:null})};
  vm.runInNewContext(code,{module:m,exports:m.exports,require(name){
   if(name==='zod')return {z};if(name==='next/cache')return {revalidatePath(){}};
   if(name==='@/lib/supabase/server')return {createSupabaseServiceRoleClient:()=>({from:()=>query})};
   if(['@/features/production/instances','@/lib/permissions/roles','@/lib/tenant/context'].includes(name))return {};
   throw Error('Unexpected import '+name);
  }});
  assert.equal(await m.exports.resolveCompletionForFixture('fixture-tenant',{customer_status_id:'fixture-status',stage_master_id:'fixture-stage'}),expected);
  assert.ok(predicates.some(([field,value])=>field==='tenant_id'&&value==='fixture-tenant'));
 }
});

test('completed products still warn when another product in the order is unfinished',async()=>{
 const data=productionData();data.items.push({...data.items[0],id:'unfinished',name:'Unfinished sibling',item_status:'in_production',expected_completion_date:null});
 data.workflowInstances.push({...data.workflowInstances[0],id:'sibling-instance',order_item_id:'unfinished',status:'in_progress',current_stage_instance_id:'sibling-stage'});
 data.stageInstances.push({...data.stageInstances[0],id:'sibling-stage',order_item_id:'unfinished',workflow_instance_id:'sibling-instance',status:'in_progress'});
 const {default:Page}=load('src/app/(tenant)/production/page.tsx',{...ui,'@/features/production/queries':{getProductionPageData:async()=>data,getProductionItemPageData:async()=>null}});
 const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({queue:'completed'})}));
 assert.match(html,/Another item in this order is not ready yet/,'Completed products need the existing sibling dependency alert');
});
test('cancelled products cannot reappear in manufacturing subqueues',async()=>{
 for(const [queue,stageStatus] of [['ready','ready_to_start'],['in_progress','in_progress'],['blocked','blocked']]){
  assert.ok(!(await production({queue},{status:'cancelled',workflowStatus:'in_progress',stageStatus})).includes('Finished fixture shirt'),`Cancelled product appeared in ${queue}`);
 }
});

async function correctionFixture(skipTerminal){
 const terminalId='30000000-0000-4000-8000-000000000001',priorId='30000000-0000-4000-8000-000000000002';
 const finalStatus='final-status',priorStatus='prior-status';
 const stages=[{id:priorId,tenant_id:ids.tenant,order_item_id:ids.type,workflow_instance_id:ids.workflow,stage_master_id:'prior-master',sequence_number:1,status:'completed',customer_status_id:priorStatus},{id:terminalId,tenant_id:ids.tenant,order_item_id:ids.type,workflow_instance_id:ids.workflow,stage_master_id:'dispatch-master',sequence_number:2,status:'completed',customer_status_id:finalStatus}];
 const item={id:ids.type,tenant_id:ids.tenant,order_id:ids.order,item_status:'delivered',customer_status_id:finalStatus};
 const tables={item_stage_instances:stages,order_items:[item],local_operational_orders:[{id:ids.order,tenant_id:ids.tenant}],orders:[{id:ids.order,tenant_id:ids.tenant,order_status:'delivered'}],customer_statuses:[{id:finalStatus,tenant_id:ids.tenant,is_final_status:true},{id:priorStatus,tenant_id:ids.tenant,is_final_status:false}],item_stage_work_logs:[],item_workflow_instances:[{id:ids.workflow,tenant_id:ids.tenant}],item_history:[]};
 class Query{
  constructor(table){this.table=table;this.filters=[];this.values=null;}
  select(){return this;}eq(field,value){this.filters.push(row=>row[field]===value);return this;}neq(field,value){this.filters.push(row=>row[field]!==value);return this;}is(){return this;}order(){return this;}
  update(value){this.values=value;return this;}insert(){return this;}
  result(single=false){let rows=tables[this.table]??[];rows=rows.filter(row=>this.filters.every(predicate=>predicate(row)));if(this.values)rows.forEach(row=>Object.assign(row,this.values));return {data:single?rows[0]??null:rows,error:null};}
  maybeSingle(){return Promise.resolve(this.result(true));}then(ok,bad){return Promise.resolve(this.result()).then(ok,bad);}
 }
 const actions=load('src/features/production/actions.ts',{'next/cache':{revalidatePath(){}},zod:{z},'@/features/production/instances':{},'@/lib/permissions/roles':{assertPermission(){}},'@/lib/supabase/server':{createSupabaseServiceRoleClient:()=>({from:table=>new Query(table)})},'@/lib/tenant/context':{requireTenantContext:async()=>({tenant:{id:ids.tenant},membership:{role:'owner_admin',clerk_user_id:'fictional-owner'}})}});
 const form=new FormData();for(const [key,value] of Object.entries({stageInstanceId:skipTerminal?terminalId:priorId,status:skipTerminal?'skipped':'completed',workerId:'',startedAt:skipTerminal?'':'2026-11-06T10:00',completedAt:skipTerminal?'':'2026-11-06T11:00',stageNotes:'',correctionReason:'Fictional correction'}))form.set(key,value);
 await actions.correctStageAction(form);return {item,finalStatus};
}
test('skipping terminal Dispatch in an owner correction does not prove delivery',async()=>{
 const {item}=await correctionFixture(true);assert.equal(item.item_status,'completed');
});
test('correcting earlier work after completed Dispatch retains the terminal public status',async()=>{
 const {item,finalStatus}=await correctionFixture(false);assert.equal(item.item_status,'delivered');assert.equal(item.customer_status_id,finalStatus);
});
