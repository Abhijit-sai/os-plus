import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { before, after, test } from "node:test";
import { testDatabase } from "./database.mjs";
import {
  tenantA,
  tenantB,
  connectionA,
  orderGid,
} from "../fixtures/shopify-intake.mjs";
import { snapshot, bag, context, env } from "../fixtures/shopify-draft.mjs";
import { createShopifyDraftStore } from "../../src/integrations/shopify/draft-store.ts";
import { createShopifyQueueStore } from "../../src/integrations/shopify/queue-store.ts";
import { createShopifyOrderHydrator } from "../../src/integrations/shopify/order-hydration.ts";
import { createShopifyDraftExecutor } from "../../src/integrations/shopify/draft-executor.ts";
import { prepareShopifyRelease, verifyShopifyReleaseSource } from "../../src/integrations/shopify/release-preparation.ts";
import { createShopifyReleaseStore } from "../../src/integrations/shopify/release-store.ts";
import { decodeShopifySourcePayment } from "../../src/integrations/shopify/source-payment.ts";

// Actual selected historical migrations/populated upgrade. Memory default,
// optionally owned real PostgreSQL; full upgrade/API/races are separate.
const db = await testDatabase('draft');
const path = (name) =>
  new URL(`../../supabase/migrations/${name}`, import.meta.url);
const read = (name) => readFileSync(path(name), "utf8");
const result = async (sql, values = []) =>
  (await db.query(sql, values)).rows[0].result;
const fixtureTimestamp = async () =>
  (await db.query('select clock_timestamp() as current')).rows[0].current.toISOString();
const count = async (table) =>
  Number((await db.query(`select count(*) as n from ${table}`)).rows[0].n);
const isolated = (fn) => async () => {
  await db.exec("begin");
  try {
    await fn();
  } finally {
    await db.exec("rollback");
  }
};
const rejected = async (fn, pattern) => {
  await db.exec("savepoint rejection");
  await assert.rejects(fn, pattern);
  await db.exec("rollback to savepoint rejection");
};
const receive = async (order = orderGid) =>
  result(
    `select receive_shopify_event($1,$2,'synthetic-intake.myshopify.com',
 'synthetic-app','production',(select revision from shopify_connections where id=$2),'orders/create',$3,null,
 '2026-10',$4,$5,null) as result`,
    [tenantA, connectionA.id, randomUUID(), order, "a".repeat(64)],
  );
async function payload(order = orderGid, customer = {}) {
  await receive(order);
  const [lease] = await result(
    "select claim_shopify_jobs($1,$2,'production','synthetic-app',1) as result",
    [tenantA, connectionA.id],
  );
  // Authoritative fixture clock avoids host/Docker sub-millisecond skew;
  // production future-observation checks remain unchanged.
  const current = await fixtureTimestamp();
  return {
    tenantId: tenantA,
    connectionId: connectionA.id,
    environment: "production",
    appRef: "synthetic-app",
    shopGid: "gid://shopify/Shop/101",
    shopDomain: "synthetic-intake.myshopify.com",
    apiVersion: "2026-10",
    jobId: lease.jobId,
    generation: lease.generation,
    leaseToken: lease.leaseToken,
    connectionRevision: lease.connectionRevision,
    sourceOrderGid: order,
    sourceCreatedAt: current,
    sourceUpdatedAt: current,
    observedAt: current,
    sourceCurrency: "INR",
    sourceDigest: "b".repeat(64),
    meaningfulDigest: "c".repeat(64),
    customer: {
      proposedName: "Fictional buyer",
      generatedName: false,
      shopifyCustomerGid: "gid://shopify/Customer/11",
      verifiedPhoneE164: "+919876543210",
      emailSuggestion: null,
      unverifiedPrimaryPhone: null,
      phoneCountryConflict: false,
      ...customer,
    },
    reasons: ["MAPPING_REQUIRED", "DELIVERY_REVIEW_REQUIRED"],
    // Structurally valid synthetic envelope, NOT encryption validation; adapter tests cover real AES-GCM.
    sealedSource: {
      version: 1,
      keyId: "synthetic-key",
      iv: "a".repeat(16),
      tag: "a".repeat(24),
      ciphertext: "a".repeat(48),
    },
    lines: [
      { lineGid: "gid://shopify/LineItem/1", quantity: 1, currentQuantity: 1 },
    ],
  };
}
const persist = (input) =>
  result("select import_shopify_draft($1::jsonb) as result", [
    JSON.stringify(input),
  ]);
before(async () => {
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls;",
  );
  for (const name of [
    "20260517120000_foundation_tenants.sql",
    "20260518170000_configuration_foundation.sql",
    "20260518190000_workflow_configuration.sql",
    "20260519110000_worker_master.sql",
    "20260519150000_customer_master_measurements.sql",
    "20260519170000_order_foundation.sql",
    "20260519183000_order_reference_and_numbering.sql",
    "20260519193000_workflow_execution_foundation.sql",
    "20260528100000_item_type_measurement_fields.sql",
    "20260529100000_item_type_standard_sizes.sql",
    "20260605110000_tenant_gst_configuration.sql",
    "20260605120000_order_gst_capture.sql",
    "20260705160000_v2_phase_1_platform_primitives.sql",
  ]) {
    await db.exec(
      read(name).replace('create extension if not exists "pgcrypto";', ""),
    );
  }
  // Customer-import migration depends on the immutable-audit helper from salary hardening.
  // Use the same existing implementation, without loading unrelated salary/worker tables.
  const auditSql = read(
    "20260808100000_configuration_editing_and_expense_defaults.sql",
  );
  const helper = auditSql.match(
    /create(?: or replace)? function (?:public\.)?prevent_immutable_audit_change\(\)[\s\S]*?\$\$[\s\S]*?\$\$[\s\S]*?;/i,
  );
  assert.ok(helper, "historical immutable helper exists");
  await db.exec(helper[0]);
  await db.exec(read("20260809100000_customer_import_and_phone_identity.sql"));
  await db.query(
    "insert into tenants(id,name,slug,store_name) values($1,'A','a','A'),($2,'B','b','B')",
    [tenantA, tenantB],
  );
  await db.query(
    "insert into customers(tenant_id,name,normalized_phone_e164) values($1,'Legacy buyer','+919000000001')",
    [tenantA],
  );
  await db.query(
    "insert into orders(tenant_id,order_number,customer_id,tracking_token,total_amount) select $1,'',id,'legacy-token',100 from customers where tenant_id=$1",
    [tenantA],
  );
  // Actual historical V2 runtime includes the existing order composite key.
  await db.exec(read("20260706110000_v2_phase_2_work_unit_runtime.sql"));
  assert.equal(
    (
      await db.query(
        "select count(*)::integer as n from pg_constraint where conrelid='orders'::regclass and conname='orders_tenant_id_id_unique' and contype='u'",
      )
    ).rows[0].n,
    1,
  );
  await db.exec(read("20261008100000_shopify_intake_foundation.sql"));
  await db.query(
    `insert into shopify_connections(id,tenant_id,shop_gid,canonical_domain,app_ref,environment,status,verified_at,intake_enabled,import_created_at_cutoff)
    values($1,$2,'gid://shopify/Shop/101','synthetic-intake.myshopify.com','synthetic-app','production','verified',now(),true,'2026-10-08')`,
    [connectionA.id, tenantA],
  );
  await db.exec(read("20261008120000_shopify_worker_leases.sql"));
  await db.query(
    "update shopify_connections set processing_enabled=true where id=$1",
    [connectionA.id],
  );
  for (const name of [
    "20261008140000_shopify_draft_enums.sql",
    "20261008141000_shopify_draft_import.sql",
    "20261008150000_shopify_privacy.sql",
    "20261008160000_shopify_mappings.sql",
    "20261008170000_shopify_review_release.sql",
    "20261008180000_shopify_source_changes.sql",
    "20261009090000_shopify_payment_source_read.sql",
  ]) {
    if (existsSync(path(name))) await db.exec(read(name));
  }
  assert.equal(
    await result(
      "select draft_import_enabled as result from shopify_connections",
    ),
    false,
  );
  // Synthetic fixture only, privileged in-memory setup. No live approval implied.
  await db.exec(
    "update shopify_connections set draft_import_enabled=true,scopes_verified_at=now(),protected_customer_fields_verified_at=now(),source_copy_authorized_at=now()",
  );
});
after(() => db.close());

test('real queue→HTTP hydration→encrypted atomic SQL draft handles follow-up without duplicate customer/order',isolated(async()=>{
  const source=snapshot();
  const current=await fixtureTimestamp(),fixtureClock=()=>Date.parse(current);
  Object.assign(source.order,{id:orderGid,createdAt:current,updatedAt:current});
  const currentContext={...context,revision:await result('select revision as result from shopify_connections')};
  const settings={...env,SHOPIFY_EXECUTOR_ENABLED:'true',SHOPIFY_DRAFT_IMPORT_ENABLED:'true',SHOPIFY_SOURCE_KEY_ID:'synthetic',
    SHOPIFY_SOURCE_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')};
  let httpCalls=0;
  const transport=async(url,init)=>{
    assert.equal(new URL(url).hostname,context.shopDomain);
    assert.equal(new Headers(init.headers).get('X-Shopify-Access-Token'),'synthetic-token');
    const query=JSON.parse(init.body).query;httpCalls++;
    let data;
    if(query.includes('OSPlusOrderShipping')) data={order:{...source.order,shippingLines:{nodes:[],pageInfo:{hasNextPage:false,endCursor:null}}}};
    else if(query.includes('lineItems(first:')) data={order:{...source.order,lineItems:{nodes:source.lines,pageInfo:{hasNextPage:false,endCursor:null}}}};
    else data={shop:{id:context.shopGid,myshopifyDomain:context.shopDomain},order:source.order};
    return new Response(JSON.stringify({data}),{headers:{'content-type':'application/json','X-Shopify-API-Version':'2026-10'}});
  };
  const rpc={rpc(name,args){return {abortSignal:async(signal)=>{
    assert.equal(signal.aborted,false);
    let data;
    if(name==='claim_shopify_jobs') data=await result('select claim_shopify_jobs($1,$2,$3,$4,$5) as result',
      [args.p_tenant_id,args.p_connection_id,args.p_environment,args.p_app_ref,args.p_limit]);
    else if(name==='import_shopify_draft') data=await persist(args.p_input);
    else if(name==='recover_shopify_draft') data=await result('select recover_shopify_draft($1::jsonb) as result',[JSON.stringify(args.p_input)]);
    else throw Error(`Unexpected synthetic RPC ${name}`);
    return {data,error:null};
  }};}};
  const run=createShopifyDraftExecutor({queue:createShopifyQueueStore(rpc),drafts:createShopifyDraftStore(rpc),
    hydrate:createShopifyOrderHydrator(transport,fixtureClock),readCredential:async()=>({tenantId:context.tenantId,connectionId:context.connectionId,
      shopGid:context.shopGid,appRef:context.appRef,environment:'production',connectionRevision:currentContext.revision,
      expiresAt:new Date(fixtureClock()+3_600_000).toISOString(),accessToken:'synthetic-token'})},fixtureClock);
  await receive();
  const first=await run(currentContext,settings);
  assert.equal(first.status,'draft');assert.equal(httpCalls,4);
  await receive();
  const second=await run(currentContext,settings);
  assert.equal(second.orderId,first.orderId);
  assert.equal(await count('shopify_source_orders'),1);assert.equal(await count('shopify_source_revisions'),2);
  assert.equal(await count('shopify_customer_bindings'),1);assert.equal(await count('order_items'),0);assert.equal(await count('order_payments'),0);
  assert.equal(await result('select completed_generation as result from shopify_sync_jobs'),2);
  assert.equal((await run(currentContext,settings)).status,'idle');assert.equal(httpCalls,8);
}));

async function mappingSetup() {
  await db.query("insert into tenant_users(tenant_id,clerk_user_id,role,status) values($1,'mapping-owner','owner_admin','active'),($1,'mapping-manager','manager','active'),($2,'foreign-owner','owner_admin','active')", [tenantA,tenantB]);
  await db.query("insert into tenant_verticals(tenant_id,vertical_definition_id,is_enabled,enabled_at) select $1,id,true,now() from vertical_definitions where key='boutique'",[tenantA]);
  const itemTypeId=randomUUID(), workflowId=randomUUID(), stageId=randomUUID(), standardSizeId=randomUUID();
  await db.query("insert into item_types(id,tenant_id,name) values($1,$2,'Synthetic shirt')",[itemTypeId,tenantA]);
  await db.query("insert into stage_master(id,tenant_id,name) values($1,$2,'Synthetic stitch')",[stageId,tenantA]);
  await db.query("insert into workflows(id,tenant_id,name,item_type_id) values($1,$2,'Synthetic workflow',$3)",[workflowId,tenantA,itemTypeId]);
  await db.query("insert into workflow_stages(tenant_id,workflow_id,stage_master_id,sequence_number) values($1,$2,$3,1)",[tenantA,workflowId,stageId]);
  await db.query("insert into item_type_standard_sizes(id,tenant_id,item_type_id,size_label) values($1,$2,$3,'M')",[standardSizeId,tenantA,itemTypeId]);
  return { mappingId:null,expectedRevision:0,variantGid:'gid://shopify/ProductVariant/21',sku:'EXACT-SKU',
    classification:'production',itemTypeId,workflowId,standardSizeId,isActive:true,reason:'Synthetic catalogue decision',stageId };
}
function saveMapping(input,key=randomUUID(),actor='mapping-owner',tenant=tenantA,conn=connectionA.id) {
  const {stageId,...command}=input;
  return result('select save_shopify_mapping($1,$2,$3,$4,$5::jsonb) as result',[tenant,conn,actor,key,JSON.stringify(command)]);
}
async function releaseSetup() {
  const config=await mappingSetup();
  await db.exec('update shopify_connections set release_enabled=true');
  const input=await payload();
  input.lines.push({lineGid:'gid://shopify/LineItem/2',quantity:2,currentQuantity:2});
  const saved=await persist(input);
  const first=await saveMapping(config);
  const second=await saveMapping({...config,variantGid:'gid://shopify/ProductVariant/22',sku:'SECOND'});
  const decision={customerId:saved.customerId,deliveryType:'store_pickup',reason:'Reviewed fictional source',lines:[
    {lineGid:input.lines[0].lineGid,mappingId:first.mappingId,mappingRevision:1},
    {lineGid:input.lines[1].lineGid,mappingId:second.mappingId,mappingRevision:1},
  ]};
  const sourceId=await result('select id as result from shopify_source_orders where order_id=$1',[saved.orderId]);
  const saveReview=(choice=decision,key=randomUUID(),version=0,actor='mapping-owner',tenant=tenantA)=>result(
    'select save_shopify_draft_review($1,$2,$3,$4,$5,$6,$7,$8::jsonb) as result',
    [tenant,connectionA.id,actor,key,sourceId,saved.sourceRevisionId,version,JSON.stringify(choice)]);
  const review=await saveReview();
  const releaseInput={connectionRevision:input.connectionRevision,sourceDigest:input.sourceDigest,sourceUpdatedAt:input.sourceUpdatedAt,verifiedAt:await fixtureTimestamp(),
    sourceCurrency:'INR',moneyValidation:'restricted_reconciliation_passed',lines:[
      {lineGid:input.lines[0].lineGid,variantGid:config.variantGid,quantity:1,name:'Fictional shirt',originalUnitMinorUnits:'100000',netMinorUnits:'90000',productionAllowed:true},
      {lineGid:input.lines[1].lineGid,variantGid:'gid://shopify/ProductVariant/22',quantity:2,name:'Fictional trousers',originalUnitMinorUnits:'200000',netMinorUnits:'360000',productionAllowed:true},
    ]};
  const release=(value=releaseInput,key=randomUUID(),actor='mapping-owner',tenant=tenantA,reviewId=review.reviewId)=>result(
    'select release_shopify_order($1,$2,$3,$4,$5,$6,$7::jsonb) as result',
    [tenant,connectionA.id,actor,key,sourceId,reviewId,JSON.stringify(value)]);
  return {config,input,saved,decision,sourceId,review,releaseInput,saveReview,release,first,second};
}
test('owner release creates all two-line items, stages, history and stable links atomically with exact operational merchandise value',isolated(async()=>{
  const f=await releaseSetup(),key=randomUUID();
  const released=await f.release(f.releaseInput,key);
  assert.equal(released.status,'released');assert.equal(released.itemCount,2);assert.equal(released.orderId,f.saved.orderId);
  assert.deepEqual(await f.release({...f.releaseInput,verifiedAt:new Date().toISOString()},key),released);
  assert.equal(await count('order_items'),2);assert.equal(await count('item_workflow_instances'),2);
  assert.equal(await count('item_stage_instances'),2);assert.equal(await count('item_history'),2);assert.equal(await count('shopify_order_item_links'),2);
  assert.equal(await count('shopify_releases'),1);assert.equal(await count('shopify_release_capabilities'),0);
  const rows=(await db.query('select quantity,unit_price,discount_amount,final_price from order_items order by name')).rows;
  assert.equal(Number(rows[0].discount_amount),100);assert.equal(Number(rows[1].discount_amount),400);
  assert.equal(await result("select count(*)::integer as result from item_stage_instances where status='ready_to_start'"),2);
  assert.equal(await result('select count(*)::integer as result from item_workflow_instances where current_stage_instance_id is not null'),2);
  assert.equal(await result('select total_amount::text as result from orders where id=$1',[released.orderId]),'4500.00');
  assert.equal(await count('order_payments'),0);
  assert.equal(await result('select count(*)::integer as result from local_operational_orders where id=$1',[released.orderId]),0);
  await rejected(()=>f.release({...f.releaseInput,lines:[...f.releaseInput.lines].reverse()},key),/SHOPIFY_IDEMPOTENCY_CONFLICT/);
}));
async function observeReleased(f, digest='d'.repeat(64), reasons=[]) {
  const next=await payload();
  Object.assign(next,{sourceCreatedAt:f.input.sourceCreatedAt,meaningfulDigest:digest,reasons,lines:f.input.lines});
  return {next,saved:await persist(next)};
}
test('operational source and literal customer search apply before the page cap with stable ordering and tenant boundaries',isolated(async()=>{
  const f=await releaseSetup();await f.release();await observeReleased(f);
  await db.query("insert into orders(tenant_id,customer_id,tracking_token,created_at,total_amount) select $1,$2,'list-'||g,current_timestamp+interval '1 day',100 from generate_series(1,51) g",[tenantA,f.saved.customerId]);
  // The original limit-before-filter path demonstrably loses this held import.
  const oldPage=(await db.query('select id,source from operational_orders where tenant_id=$1 order by created_at desc limit 50',[tenantA])).rows;
  assert.equal(oldPage.some(row=>row.source==='shopify'),false);
  const list=async(tenant=tenantA,search=null,source=null,payment=null,view='all',limit=50)=>(await db.query(
    'select * from list_operational_orders($1,$2,$3,null,$4,$5,$6)',[tenant,search,source,payment,view,limit])).rows;
  assert.deepEqual((await list(tenantA,null,'shopify')).map(row=>row.id),[f.saved.orderId]);
  assert.deepEqual((await list(tenantA,'fictional buyer','shopify')).map(row=>row.id),[f.saved.orderId]);
  assert.equal((await list(tenantA,'%',null)).length,0);
  assert.equal((await list(tenantA,null,'shopify','unpaid')).length,0);
  assert.equal((await list(tenantB,null,'shopify')).length,0);
  const first=await list(),second=await list();assert.deepEqual(first.map(row=>row.id),second.map(row=>row.id));
  assert.equal(first.length,50);assert.ok(first.slice(0,49).every((row,index)=>row.id>first[index+1].id));
  for(const role of ['anon','authenticated'])await rejected(()=>db.exec(`set local role ${role};select * from list_operational_orders('${tenantA}')`),/permission denied/);
}));
test('source-payment read is current-actor/tenant/release scoped, follows latest observation and never posts local money',isolated(async()=>{
  const f=await releaseSetup();
  const readPayment=(actor='mapping-owner',tenant=tenantA,order=f.saved.orderId)=>result('select read_shopify_payment_source($1,$2,$3) as result',[tenant,actor,order]);
  assert.equal(await readPayment(),null); // Draft is not exposed through operational Orders.
  await f.release();const initial=await readPayment();assert.equal(initial.tenantId,tenantA);assert.equal(initial.orderId,f.saved.orderId);
  assert.equal(initial.sourceDigest,f.input.sourceDigest);assert.equal(initial.productionHeld,false);
  assert.deepEqual(await readPayment('mapping-manager'),initial);
  await db.query("insert into tenant_users(tenant_id,clerk_user_id,role,status) values($1,'payment-finance','finance','active'),($1,'payment-viewer','viewer','active')",[tenantA]);
  for(const actor of ['foreign-owner','payment-finance','payment-viewer','no-member'])assert.equal(await readPayment(actor),null);
  assert.equal(await readPayment('foreign-owner',tenantB),null);
  const next=await observeReleased(f);const current=await readPayment();assert.equal(current.productionHeld,true);
  assert.equal(Date.parse(current.observedAt),Date.parse(next.next.observedAt));assert.deepEqual(current.sealedSource,next.next.sealedSource);
  await db.exec("savepoint disabled_payment_reader");await db.exec("update tenant_users set status='disabled' where clerk_user_id='mapping-owner'");
  assert.equal(await readPayment(),null);await db.exec('rollback to savepoint disabled_payment_reader');
  await db.exec('savepoint suspended_payment_reader');await db.query("update tenants set status='suspended' where id=$1",[tenantA]);
  assert.equal(await readPayment(),null);await db.exec('rollback to savepoint suspended_payment_reader');
  for(const role of ['anon','authenticated'])await rejected(()=>db.exec(`set local role ${role};select read_shopify_payment_source('${tenantA}','mapping-owner','${f.saved.orderId}')`),/permission denied/);
  assert.equal(await count('order_payments'),0);assert.equal(await result('select count(*)::integer as result from local_operational_orders where id=$1',[f.saved.orderId]),0);
}));
async function decideChange(f,action='keep_os_plus_continue',actor='mapping-owner',key=randomUUID(),reason='Keep local production after reviewing source',overrides={}) {
  const st=(await db.query('select * from shopify_operational_state where source_order_id=$1',[f.sourceId])).rows[0];
  return result('select review_shopify_change($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as result',
    [tenantA,connectionA.id,actor,key,f.sourceId,overrides.caseId??st.latest_case_id,overrides.observed??st.latest_revision_id,
      overrides.accepted??st.accepted_revision_id,action,reason]);
}
test('released observations create one review per meaningful change and never rewrite local production, customer or money',isolated(async()=>{
  const f=await releaseSetup();await f.release();
  const before=(await db.query('select id,quantity,unit_price,final_price from order_items order by id')).rows;
  const observed=await observeReleased(f);
  assert.equal(observed.saved.status,'observed');assert.equal(await count('shopify_change_cases'),1);
  assert.deepEqual((await db.query('select id,quantity,unit_price,final_price from order_items order by id')).rows,before);
  assert.equal(await count('order_payments'),0);assert.equal(await count('customers'),2);
  assert.equal(await count('item_history'),2);
  assert.equal(await result('select held as result from shopify_operational_state'),true);
  assert.equal(await result('select count(*)::integer as result from operational_orders where id=$1',[f.saved.orderId]),1);
  assert.equal(await result('select count(*)::integer as result from local_operational_orders where id=$1',[f.saved.orderId]),0);
  await observeReleased(f);assert.equal(await count('shopify_change_cases'),1);
  await rejected(()=>db.exec("update item_stage_instances set status='in_progress'"),/SHOPIFY_PRODUCTION_HELD/);
  await rejected(()=>db.exec("update order_items set item_status='in_production'"),/SHOPIFY_PRODUCTION_HELD/);
  await db.exec("update item_stage_instances set notes='Readable notes while held'");
}));
test('catalogue-only observation keeps production available; cancellation/refund holds need explicit current owner acknowledgement',isolated(async()=>{
  const f=await releaseSetup();await f.release();
  await observeReleased(f,'c'.repeat(64));assert.equal(await count('shopify_change_cases'),0);
  await db.exec("update item_stage_instances set status='in_progress'");
  const cancelled=await observeReleased(f,'d'.repeat(64),['SOURCE_CANCELLED','SOURCE_REFUND']);
  await rejected(()=>db.exec("update item_stage_instances set status='completed'"),/SHOPIFY_PRODUCTION_HELD/);
  await rejected(()=>decideChange(f,'keep_os_plus_continue','mapping-manager'),/SHOPIFY_ACCESS_DENIED/);
  await rejected(()=>decideChange(f,'apply_source_correction'),/SHOPIFY_COMMAND_INVALID/);
  const key=randomUUID(),reason='Owner knowingly continues despite cancellation and refund';
  const decision=await decideChange(f,'keep_os_plus_continue','mapping-owner',key,reason);
  assert.equal(decision.held,false);
  const originalAccepted=f.saved.sourceRevisionId;
  assert.deepEqual(await decideChange(f,'keep_os_plus_continue','mapping-owner',key,reason,{accepted:originalAccepted}),decision);
  await rejected(()=>decideChange(f,'keep_os_plus_continue','mapping-owner',key,'Different intent',{accepted:originalAccepted}),/SHOPIFY_IDEMPOTENCY_CONFLICT/);
  await db.exec("update item_stage_instances set status='completed'");
  await observeReleased(f,'d'.repeat(64),['SOURCE_CANCELLED','SOURCE_REFUND']);
  assert.equal(await result('select held as result from shopify_operational_state'),false);
  assert.equal(await count('shopify_change_cases'),1);
  await observeReleased(f,'e'.repeat(64),['SOURCE_CANCELLED']);
  assert.equal(await result('select held as result from shopify_operational_state'),true);
  await rejected(()=>decideChange(f,'keep_os_plus_continue','mapping-owner',randomUUID(),'Stale source',{observed:cancelled.saved.sourceRevisionId}),/SHOPIFY_STALE_REVISION/);
}));
test('partial post-release observations fail closed, forbid continue, recover exact receipt after disconnect and preserve immutable history',isolated(async()=>{
  const f=await releaseSetup();await f.release();
  const next=await payload();Object.assign(next,{sourceCreatedAt:f.input.sourceCreatedAt,completeness:'partial',meaningfulDigest:null,sourceCurrency:'XXX',lines:[],reasons:['INCOMPLETE_SOURCE'],
    customer:{proposedName:'Incomplete fictional source',generatedName:true,shopifyCustomerGid:null,verifiedPhoneE164:null,emailSuggestion:null,unverifiedPrimaryPhone:null,phoneCountryConflict:false}});
  const observed=await persist(next);assert.equal(observed.status,'observed');
  await rejected(()=>decideChange(f),/SHOPIFY_INCOMPLETE_SOURCE/);
  const decision=await decideChange(f,'keep_on_hold');assert.equal(decision.held,true);
  await rejected(()=>db.exec('delete from item_stage_instances'),/SHOPIFY_HISTORY_PROTECTED/);
  await rejected(()=>db.exec('delete from item_history'),/SHOPIFY_HISTORY_PROTECTED/);
  await db.exec("update shopify_connections set status='disconnected',intake_enabled=false,processing_enabled=false,draft_import_enabled=false,release_enabled=false");
  assert.deepEqual(await result('select recover_shopify_draft($1::jsonb) as result',[JSON.stringify(next)]),observed);
  await rejected(()=>db.exec("set local role service_role;update shopify_operational_state set held=false"),/permission denied/);
  await rejected(()=>db.exec("set local role authenticated;select * from operational_orders"),/permission denied/);
  await rejected(()=>db.exec("set local role service_role;select import_shopify_draft_v1('{}'::jsonb,false)"),/permission denied/);
}));
test('failed second materialization or immutable release receipt leaves no items/history/links and preserves draft',isolated(async()=>{
  const f=await releaseSetup();
  await db.exec("create function fail_release_test() returns trigger language plpgsql as $$ begin if new.name='Fictional trousers' then raise exception 'SYNTHETIC_RELEASE_FAILURE';end if;return new;end $$;create trigger fail_release_test before insert on order_items for each row execute function fail_release_test();");
  await rejected(()=>f.release(),/SYNTHETIC_RELEASE_FAILURE/);
  for(const table of ['order_items','item_workflow_instances','item_stage_instances','item_history','shopify_order_item_links','shopify_releases','shopify_release_capabilities']) assert.equal(await count(table),0,table);
  assert.equal(await result('select order_status as result from orders where id=$1',[f.saved.orderId]),'draft');
  await db.exec('drop trigger fail_release_test on order_items');
  await db.exec("create function fail_release_audit_test() returns trigger language plpgsql as $$ begin raise exception 'SYNTHETIC_RELEASE_AUDIT_FAILURE';end $$;create trigger fail_release_audit_test before insert on shopify_releases for each row execute function fail_release_audit_test();");
  await rejected(()=>f.release(),/SYNTHETIC_RELEASE_AUDIT_FAILURE/);
  assert.equal(await count('order_items'),0);assert.equal(await count('shopify_release_capabilities'),0);
}));
test('stage disappearance between validation and materialization cannot confirm a stage-less workflow',isolated(async()=>{
  const f=await releaseSetup();
  await db.exec("create function remove_release_stage_test() returns trigger language plpgsql as $$ begin if (select count(*) from item_workflow_instances)>0 then update workflow_stages set deleted_at=now();end if;return new;end $$;create trigger remove_release_stage_test before insert on item_workflow_instances for each row execute function remove_release_stage_test();");
  await rejected(()=>f.release(),/SHOPIFY_CONFIGURATION_INVALID/);
  assert.equal(await count('order_items'),0);assert.equal(await count('item_workflow_instances'),0);assert.equal(await count('item_stage_instances'),0);
  assert.equal(await result('select order_status as result from orders where id=$1',[f.saved.orderId]),'draft');
}));
test('review/release forbid managers, foreign tenants/customers/configuration and stale decisions or mappings',isolated(async()=>{
  const f=await releaseSetup();
  for(const actor of ['mapping-manager','foreign-owner','unknown']) {
    await rejected(()=>f.saveReview(f.decision,randomUUID(),1,actor),/SHOPIFY_ACCESS_DENIED/);
    await rejected(()=>f.release(f.releaseInput,randomUUID(),actor),/SHOPIFY_ACCESS_DENIED/);
  }
  await rejected(()=>f.release(f.releaseInput,randomUUID(),'mapping-owner',tenantB),/SHOPIFY_ACCESS_DENIED/);
  await rejected(()=>f.saveReview({...f.decision,customerId:randomUUID()},randomUUID(),1),/SHOPIFY_CUSTOMER_INVALID/);
  await rejected(()=>f.saveReview(),/SHOPIFY_STALE_REVISION/);
  await f.saveReview({...f.decision,reason:'Second explicit review'},randomUUID(),1);
  await rejected(()=>f.release(),/SHOPIFY_STALE_REVISION/);
  const next=await f.saveReview({...f.decision,reason:'Third review'},randomUUID(),2);
  await saveMapping({...f.config,mappingId:f.first.mappingId,expectedRevision:1,sku:'RENAMED'});
  await rejected(()=>f.release(f.releaseInput,randomUUID(),'mapping-owner',tenantA,next.reviewId),/SHOPIFY_MAPPING_INVALID/);
  assert.equal(await count('order_items'),0);
}));
test('release fails closed on paused/disabled/new source, unsupported money, changed quantity and inactive workflow',isolated(async()=>{
  const f=await releaseSetup();
  await db.exec('update shopify_connections set release_enabled=false');
  await rejected(()=>f.release(),/SHOPIFY_RELEASE_DISABLED/);await db.exec('update shopify_connections set release_enabled=true');
  // A fresh synthetic source proof must use the now-current connection after
  // this deliberate activation change; never weaken the production fence.
  f.releaseInput.connectionRevision=await result('select revision as result from shopify_connections');
  for(const patch of [{sourceDigest:'c'.repeat(64)},{verifiedAt:new Date(Date.now()-121000).toISOString()},
    {sourceCurrency:'USD'},{moneyValidation:'review'},{lines:f.releaseInput.lines.slice(0,1)},
    {lines:f.releaseInput.lines.map((line)=>({...line,quantity:3}))}]) await rejected(()=>f.release({...f.releaseInput,...patch}),/SHOPIFY_(STALE_REVISION|SOURCE_REVIEW|MAPPING_INVALID)/);
  await db.exec('update workflows set is_active=false');await rejected(()=>f.release(),/SHOPIFY_CONFIGURATION_INVALID/);
  await db.exec('update workflows set is_active=true');await receive();await rejected(()=>f.release(),/SHOPIFY_STALE_REVISION/);
  assert.equal(await count('order_items'),0);
}));
test('pause-resume connection revision fences a previously verified but uncommitted release',isolated(async()=>{
  const f=await releaseSetup();
  await db.exec("update shopify_connections set status='paused',processing_enabled=false,revision=revision+1;update shopify_connections set status='verified',processing_enabled=true,revision=revision+1");
  await rejected(()=>f.release(),/SHOPIFY_STALE_REVISION/);
  assert.equal(await count('order_items'),0);assert.equal(await count('shopify_releases'),0);
}));
test('release remains commercial-read-only and no role can forge private transaction capability or write immutable links',isolated(async()=>{
  const f=await releaseSetup();await f.release();
  await rejected(()=>db.exec("update order_items set quantity=quantity+1"),/SHOPIFY_ORDER_READ_ONLY/);
  await rejected(()=>db.exec("update orders set total_amount=1 where source='shopify'"),/SHOPIFY_ORDER_READ_ONLY/);
  await rejected(()=>db.exec("delete from shopify_order_item_links"),/SHOPIFY_AUDIT_IMMUTABLE/);
  await db.exec('set local role service_role');
  await rejected(()=>db.exec('insert into shopify_release_capabilities select pg_backend_pid(),txid_current(),tenant_id,id from orders'),/permission denied/);
  await rejected(()=>db.exec('delete from shopify_draft_reviews'),/permission denied/);
  await db.exec('reset role;set local role authenticated');await rejected(()=>f.release(),/permission denied/);await db.exec('reset role');
}));
test('committed release/review replay after disconnect recovers only exact intent; recovery misses and disabled owners write nothing',isolated(async()=>{
  const f=await releaseSetup(),key=randomUUID(),reviewKey=randomUUID();
  const review=await f.saveReview({...f.decision,reason:'Replay proof'},reviewKey,1);
  const released=await f.release(f.releaseInput,key,'mapping-owner',tenantA,review.reviewId);
  await db.exec("update shopify_connections set status='disconnected',intake_enabled=false,processing_enabled=false,draft_import_enabled=false,release_enabled=false");
  assert.deepEqual(await f.release(f.releaseInput,key,'mapping-owner',tenantA,review.reviewId),released);
  assert.deepEqual(await f.saveReview({...f.decision,reason:'Replay proof'},reviewKey,1),review);
  const recovery=(actor='mapping-owner',recoveryKey=key)=>result('select release_shopify_order($1,$2,$3,$4,$5,$6,$7::jsonb,true) as result',
    [tenantA,connectionA.id,actor,recoveryKey,f.sourceId,review.reviewId,JSON.stringify(f.releaseInput)]);
  assert.deepEqual(await recovery(),released);assert.equal(await recovery('mapping-owner',randomUUID()),null);
  await rejected(()=>recovery('mapping-manager'),/SHOPIFY_ACCESS_DENIED/);
  await db.exec("update tenant_users set status='disabled' where clerk_user_id='mapping-owner'");
  await rejected(()=>recovery(),/SHOPIFY_ACCESS_DENIED/);
  assert.equal(await count('shopify_releases'),1);assert.equal(await count('order_items'),2);
}));
test('mixed nonproduction exclusion is explicit and audited without counting excluded merchandise as operational value',isolated(async()=>{
  const f=await releaseSetup();
  const ignored=await saveMapping({...f.config,mappingId:f.first.mappingId,expectedRevision:1,classification:'nonproduction',itemTypeId:null,workflowId:null,standardSizeId:null});
  const decision={...f.decision,lines:f.decision.lines.map((line,index)=>index===0?{...line,mappingRevision:ignored.revision}:line)};
  const review=await f.saveReview(decision,randomUUID(),1);
  const released=await f.release(f.releaseInput,randomUUID(),'mapping-owner',tenantA,review.reviewId);
  assert.equal(released.itemCount,1);assert.equal(await count('shopify_order_item_links'),1);
  assert.equal(await result('select total_amount::text as result from orders where id=$1',[f.saved.orderId]),'3600.00');
}));
test('wholly nonproduction classification preserves source lines but cannot materialize or confirm an order',isolated(async()=>{
  const f=await releaseSetup();
  await saveMapping({...f.config,mappingId:f.first.mappingId,expectedRevision:1,classification:'nonproduction',itemTypeId:null,workflowId:null,standardSizeId:null});
  await saveMapping({...f.config,mappingId:f.second.mappingId,expectedRevision:1,variantGid:'gid://shopify/ProductVariant/22',sku:'SECOND',classification:'nonproduction',itemTypeId:null,workflowId:null,standardSizeId:null});
  const decision={...f.decision,lines:f.decision.lines.map(line=>({...line,mappingRevision:2}))};
  const review=await f.saveReview(decision,randomUUID(),1);
  await rejected(()=>f.release(f.releaseInput,randomUUID(),'mapping-owner',tenantA,review.reviewId),/SHOPIFY_SOURCE_REVIEW/);
  assert.equal(await count('order_items'),0);assert.equal(await count('shopify_releases'),0);assert.equal(await count('shopify_source_lines'),2);
  assert.equal(await result('select order_status as result from orders where id=$1',[f.saved.orderId]),'draft');
}));
test('three synthetic paid/partial/pending orders import and release through actual encryption/SQL, replay safely and expose only source payments',isolated(async()=>{
  const config=await mappingSetup();
  await db.exec('update shopify_connections set release_enabled=true');
  const mapped=await saveMapping({...config,sku:snapshot().lines[0].sku.trim()});
  const examples=[{status:'PAID',received:'118.00',outstanding:'0.00'},
    {status:'PARTIALLY_PAID',received:'40.00',outstanding:'78.00'},
    {status:'PENDING',received:'0.00',outstanding:'118.00'}];
  const releasedIds=new Set(), customerIds=new Set();
  for(const [index,example] of examples.entries()) {
  const exampleGid=`gid://shopify/Order/${90001+index}`;
  const input=await payload(exampleGid);
  const source=snapshot(),current=await fixtureTimestamp();
  Object.assign(source.order,{id:exampleGid,legacyResourceId:exampleGid.split('/').at(-1),name:`#SYNTHETIC-${index+1}`,
    createdAt:current,updatedAt:current,displayFinancialStatus:example.status,
    totalReceivedSet:bag(example.received),netPaymentSet:bag(example.received),totalOutstandingSet:bag(example.outstanding)});
  source.lines[0].id=`gid://shopify/LineItem/${91001+index}`;
  Object.assign(source,{observedAt:current,connectionRevision:input.connectionRevision,jobId:input.jobId,generation:input.generation});
  source.lines[0].variant={id:config.variantGid};
  const scopedContext={...context,revision:input.connectionRevision};
  const leased={jobId:input.jobId,tenantId:tenantA,connectionId:connectionA.id,orderGid:exampleGid,generation:input.generation,
    connectionRevision:input.connectionRevision,leaseToken:input.leaseToken,leaseExpiresAt:new Date(Date.now()+120000).toISOString()};
  const settings={...env,SHOPIFY_DRAFT_IMPORT_ENABLED:'true',SHOPIFY_SOURCE_KEY_ID:'synthetic',SHOPIFY_SOURCE_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')};
  const signal=new AbortController().signal;
  const draftStore=createShopifyDraftStore({rpc(name,args){assert.equal(name,'import_shopify_draft');return {abortSignal:async()=>({data:await persist(args.p_input),error:null})};}});
  const imported=await draftStore.importSnapshot(source,scopedContext,leased,signal,settings,Date.parse(current));
  assert.deepEqual(await draftStore.importSnapshot(source,scopedContext,leased,signal,settings,Date.parse(current)),imported);
  const sourceId=await result('select id as result from shopify_source_orders where tenant_id=$1 and order_id=$2',[tenantA,imported.orderId]);
  const raw=(await db.query('select * from shopify_source_revisions where tenant_id=$1 and source_order_id=$2',[tenantA,sourceId])).rows[0];
  const revision={id:raw.id,tenantId:tenantA,connectionId:connectionA.id,shopGid:context.shopGid,sourceOrderId:sourceId,
    sourceOrderGid:exampleGid,sourceDigest:raw.source_digest,sourceUpdatedAt:new Date(raw.source_updated_at).toISOString(),completeness:'complete',sealedSource:raw.sealed_source};
  const decision={customerId:imported.customerId,deliveryType:'store_pickup',reason:'Fictional complete workflow review',lines:[
    {lineGid:source.lines[0].id,mappingId:mapped.mappingId,mappingRevision:1,colourOverride:'Royal blue'}]};
  const adapter=createShopifyReleaseStore({rpc(name,args){return {abortSignal:async()=>{
    const data=name==='save_shopify_draft_review'?await result('select save_shopify_draft_review($1,$2,$3,$4,$5,$6,$7,$8::jsonb) as result',
      [args.p_tenant_id,args.p_connection_id,args.p_actor_id,args.p_request_key,args.p_source_order_id,args.p_source_revision_id,args.p_expected_version,JSON.stringify(args.p_decision)]):
      await result('select release_shopify_order($1,$2,$3,$4,$5,$6,$7::jsonb,$8) as result',
      [args.p_tenant_id,args.p_connection_id,args.p_actor_id,args.p_request_key,args.p_source_order_id,args.p_review_id,JSON.stringify(args.p_input),args.p_recovery_only]);
    return {data,error:null};
  }};}});
  const binding={tenantId:tenantA,connectionId:connectionA.id};
  const review=await adapter.saveReview(binding,'mapping-owner',randomUUID(),sourceId,raw.id,0,decision,signal);
  const verifiedAt=await fixtureTimestamp();
  const proof=await verifyShopifyReleaseSource(scopedContext,revision,'synthetic-token',signal,settings,async()=>new Response(JSON.stringify({data:{
    shop:{id:context.shopGid,myshopifyDomain:context.shopDomain},order:{id:exampleGid,updatedAt:current}}}),{headers:{'X-Shopify-API-Version':'2026-10'}}),()=>Date.parse(verifiedAt));
  const candidates=(await db.query('select id,tenant_id,connection_id,variant_gid,sku,classification,item_type_id,workflow_id,standard_size_id,is_active,revision from shopify_variant_mappings')).rows.map(row=>({...row,revision:Number(row.revision)}));
  const prepared=prepareShopifyRelease(revision,scopedContext,decision,candidates,proof,settings,Date.parse(verifiedAt));
  const key=randomUUID(),args=[binding,'mapping-owner',key,sourceId,review.reviewId,prepared,signal];
  const released=await adapter.release(...args);
  assert.equal(released.orderId,imported.orderId);assert.equal(await result('select color as result from order_items where tenant_id=$1 and order_id=$2',[tenantA,released.orderId]),'Royal blue');
  assert.equal(await result('select final_price::text as result from order_items where tenant_id=$1 and order_id=$2',[tenantA,released.orderId]),'100.00');
  assert.equal(await result('select discount_amount::text as result from order_items where tenant_id=$1 and order_id=$2',[tenantA,released.orderId]),'10.00');
  assert.deepEqual(await adapter.recoverCommittedRelease(...args),released);
  releasedIds.add(released.orderId);customerIds.add(imported.customerId);
  assert.equal(await count('item_stage_instances'),index+1);assert.equal(await count('order_payments'),0);
  const paymentRow=await result('select read_shopify_payment_source($1,$2,$3) as result',[tenantA,'mapping-owner',released.orderId]);
  const payment=decodeShopifySourcePayment(paymentRow,{tenantId:tenantA,orderId:released.orderId},settings);
  assert.equal(payment.status,example.status);assert.equal(payment.amounts.total,'118.00');assert.equal(payment.amounts.received,example.received);
  assert.equal(payment.amounts.refunded,'0.00');assert.equal(payment.amounts.outstanding,example.outstanding);assert.equal(payment.productionHeld,false);
  assert.equal(payment.validation,'source_consistent');assert.equal(Object.hasOwn(payment,'sourceSnapshot'),false);
  assert.equal(await count('order_payments'),0);
  const managerRow=await result('select read_shopify_payment_source($1,$2,$3) as result',[tenantA,'mapping-manager',released.orderId]);
  assert.deepEqual(decodeShopifySourcePayment(managerRow,{tenantId:tenantA,orderId:released.orderId},settings),payment);
  assert.equal(await result('select read_shopify_payment_source($1,$2,$3) as result',[tenantB,'foreign-owner',released.orderId]),null);
  assert.equal(await result('select count(*)::integer as result from local_operational_orders where tenant_id=$1 and id=$2',[tenantA,released.orderId]),0);
  }
  assert.equal(releasedIds.size,3);assert.equal(customerIds.size,3);
  assert.equal(await count('shopify_source_orders'),3);assert.equal(await count('shopify_source_revisions'),3);
  assert.equal(await count('order_items'),3);assert.equal(await count('item_stage_instances'),3);assert.equal(await count('order_payments'),0);
}));
test('owner mapping is audited/versioned/replayable; duplicates and stale saves cannot change it',isolated(async()=>{
  const input=await mappingSetup(), key=randomUUID();
  const first=await saveMapping(input,key);
  assert.equal(first.revision,1);
  assert.deepEqual(await saveMapping(input,key),first);
  await rejected(()=>saveMapping({...input,sku:'changed'},key),/SHOPIFY_IDEMPOTENCY_CONFLICT/);
  await rejected(()=>saveMapping(input),/duplicate key/);
  const second=await saveMapping({...input,mappingId:first.mappingId,expectedRevision:1,sku:'RENAMED'});
  assert.equal(second.revision,2);
  await rejected(()=>saveMapping({...input,mappingId:first.mappingId,expectedRevision:1}),/SHOPIFY_STALE_REVISION/);
  assert.equal(await count('shopify_mapping_audit'),2);
  await rejected(()=>db.exec('delete from shopify_mapping_audit'),/SHOPIFY_RECEIPT_IMMUTABLE/);
  assert.equal(await count('order_items'),0);
}));
test('mapping forbids managers, foreign/disabled members, suspended tenants and disabled Boutique',isolated(async()=>{
  const input=await mappingSetup();
  for(const actor of ['mapping-manager','foreign-owner','unknown']) await rejected(()=>saveMapping(input,randomUUID(),actor),/SHOPIFY_ACCESS_DENIED/);
  await db.exec("update tenant_users set status='disabled' where clerk_user_id='mapping-owner'");
  await rejected(()=>saveMapping(input),/SHOPIFY_ACCESS_DENIED/);
  await db.exec("update tenant_users set status='active'; update tenant_verticals set is_enabled=false");
  await rejected(()=>saveMapping(input),/SHOPIFY_ACCESS_DENIED/);
  await db.exec("update tenant_verticals set is_enabled=true; update tenants set status='suspended'");
  await rejected(()=>saveMapping(input),/SHOPIFY_ACCESS_DENIED/);
  assert.equal(await count('shopify_variant_mappings'),0);
}));
test('mapping rejects inactive/cross-tenant/incompatible type, workflow, stage, status and size',isolated(async()=>{
  const input=await mappingSetup();
  for(const field of ['itemTypeId','workflowId','standardSizeId']) await rejected(()=>saveMapping({...input,[field]:randomUUID()}),/SHOPIFY_CONFIGURATION_INVALID/);
  for(const table of ['item_types','workflows','stage_master','item_type_standard_sizes']) {
    await db.exec(`update ${table} set is_active=false`);
    await rejected(()=>saveMapping(input),/SHOPIFY_CONFIGURATION_INVALID/);
    await db.exec(`update ${table} set is_active=true`);
  }
  const foreign=randomUUID();
  await db.query("insert into customer_statuses(id,tenant_id,name) values($1,$2,'Foreign')",[foreign,tenantB]);
  await db.query('update workflow_stages set customer_status_id=$1',[foreign]);
  await rejected(()=>saveMapping(input),/SHOPIFY_CONFIGURATION_INVALID/);
  assert.equal(await count('shopify_mapping_audit'),0);
}));
test('mapping classification is explicit; disabling keeps audit; audit failure rolls back whole save',isolated(async()=>{
  const input=await mappingSetup();
  await rejected(()=>saveMapping({...input,variantGid:null,sku:'UNVERIFIED-SKU'}),/SHOPIFY_COMMAND_INVALID/);
  const ignored={...input,classification:'nonproduction',itemTypeId:null,workflowId:null,standardSizeId:null};
  const saved=await saveMapping(ignored);
  await rejected(()=>saveMapping({...input,mappingId:saved.mappingId,expectedRevision:1,variantGid:'gid://shopify/ProductVariant/22'}),/SHOPIFY_MAPPING_IDENTITY_IMMUTABLE/);
  await saveMapping({...ignored,mappingId:saved.mappingId,expectedRevision:1,isActive:false});
  assert.equal(await result('select is_active as result from shopify_variant_mappings'),false);
  await db.exec("create function fail_mapping_audit() returns trigger language plpgsql as $$ begin raise exception 'SYNTHETIC_MAPPING_FAILURE'; end $$; create trigger fail_mapping_audit before insert on shopify_mapping_audit for each row execute function fail_mapping_audit();");
  await rejected(()=>saveMapping({...input,variantGid:'gid://shopify/ProductVariant/22',sku:'OTHER'}),/SYNTHETIC_MAPPING_FAILURE/);
  assert.equal(await count('shopify_variant_mappings'),1);
  await db.exec('set local role service_role');
  await rejected(()=>db.exec('delete from shopify_variant_mappings'),/permission denied/);
  await db.exec('reset role; set local role authenticated');
  await rejected(()=>saveMapping(input),/permission denied/);
  await db.exec('reset role');
}));

test("partial envelopes create no customer/address/items and a later complete generation reuses the shell", isolated(async () => {
  const input = await payload();
  const beforeCustomers = await count('customers');
  const partial = { ...input, completeness: 'partial', sourceCurrency: 'XXX', lines: [], addresses: [],
    customer: { proposedName: 'Incomplete Shopify order', generatedName: true, shopifyCustomerGid: null,
      verifiedPhoneE164: null, emailSuggestion: null, unverifiedPrimaryPhone: null, phoneCountryConflict: false } };
  const shell = await persist(partial);
  assert.equal(shell.customerId, null);
  assert.ok(shell.reasons.includes('INCOMPLETE_SOURCE'));
  assert.equal(await count('customers'), beforeCustomers);
  assert.equal(await count('customer_addresses'), 0);
  assert.equal(await count('order_items'), 0);
  assert.equal(await count('shopify_source_lines'), 0);
  assert.equal(await result('select completeness as result from shopify_source_revisions'), 'partial');
  assert.equal(await result('select source_currency_code as result from orders where source=\'shopify\''), 'XXX');
  const next = await payload();
  const full = await persist(next);
  assert.equal(full.orderId, shell.orderId);
  assert.equal(full.customerResolution, 'created');
  assert.equal(await count('shopify_source_orders'), 1);
  assert.equal(await count('shopify_source_revisions'), 2);
  assert.equal(await result('select source_currency_code as result from orders where source=\'shopify\''), 'INR');
  await rejected(() => persist({ ...next, completeness: 'partial' }), /SHOPIFY_IDEMPOTENCY_CONFLICT/);
}));

test("addresses use existing dedupe/default rules, preserve profile and roll back with a failed source write", isolated(async () => {
  const input = await payload();
  const address = { address1: ' Fictional road ', address2: null, city: 'Fictional city', province: null, zip: '100001', countryCodeV2: 'IN' };
  input.addresses = [address, { ...address, address1: 'fictional ROAD' }];
  const saved = await persist(input);
  assert.equal(await count('customer_addresses'), 1);
  const first = (await db.query('select * from customer_addresses')).rows[0];
  assert.equal(first.is_default, true);
  const second = await payload('gid://shopify/Order/99');
  second.addresses = [{ ...address, address1: 'Another fictional road' }];
  await persist(second);
  assert.equal(await count('customer_addresses'), 2);
  assert.equal(await result('select count(*)::integer as result from customer_addresses where is_default'), 1);
  assert.equal(await result('select address as result from customers where id=$1', [saved.customerId]), null);
  const third = await payload('gid://shopify/Order/98');
  third.addresses = [{ ...address, countryCodeV2: 'INVALID' }];
  const revisions = await count('shopify_source_revisions');
  await rejected(() => persist(third), /SHOPIFY_COMMAND_INVALID/);
  assert.equal(await count('shopify_source_revisions'), revisions);
  assert.equal(await count('customer_addresses'), 2);
}));

function privacyPayload(topic = 'customers/redact', overrides = {}) {
  return { tenantId: tenantA, connectionId: connectionA.id, shopGid: 'gid://shopify/Shop/101',
    shopDomain: 'synthetic-intake.myshopify.com', appRef: 'synthetic-app', environment: 'production',
    topic, deliveryId: randomUUID(), bodySha256: 'c'.repeat(64), customerGid: 'gid://shopify/Customer/11',
    orderGids: [], sealedContact: {}, ...overrides };
}
const privacy = (input) => result('select receive_shopify_privacy($1::jsonb) as result', [JSON.stringify(input)]);
const redact = (requestId, key = randomUUID(), actor = 'synthetic-owner', tenant = tenantA) =>
  result('select redact_shopify_source($1,$2,$3,$4,$5,100) as result', [tenant, connectionA.id, actor, requestId, key]);

test("transient privacy contact TTL purge is bounded, tenant fenced and audited without completing requests", isolated(async () => {
  await privacy(privacyPayload('customers/data_request'));
  const oldId = randomUUID();
  await db.query(`insert into shopify_privacy_requests(id,tenant_id,connection_id,topic,delivery_id,body_sha256,customer_gid,order_gids,sealed_contact,received_at)
    values($1,$2,$3,'customers/data_request',$4,$5,'gid://shopify/Customer/11','[]','{"ciphertext":"synthetic"}',clock_timestamp()-interval '8 days')`,
    [oldId,tenantA,connectionA.id,randomUUID(),'d'.repeat(64)]);
  await rejected(() => result('select purge_shopify_privacy_contacts($1,$2,100) as result', [tenantB,connectionA.id]), /SHOPIFY_ACCESS_DENIED/);
  assert.equal(await result('select purge_shopify_privacy_contacts($1,$2,1) as result', [tenantA,connectionA.id]), 1);
  assert.deepEqual(await result('select sealed_contact as result from shopify_privacy_requests where id=$1', [oldId]), { contactPurged: true });
  assert.equal(await result('select purge_shopify_privacy_contacts($1,$2,100) as result', [tenantA,connectionA.id]), 0);
  assert.equal(await count('shopify_privacy_requests'), 2);
  assert.equal(await count('shopify_privacy_audit'), 1);
  assert.equal(await result('select processing_enabled as result from shopify_connections'), true);
}));

test("email-only privacy requests retain the sole subject locator until audited resolution exists", isolated(async () => {
  const oldId = randomUUID();
  await db.query(`insert into shopify_privacy_requests(id,tenant_id,connection_id,topic,delivery_id,body_sha256,customer_gid,order_gids,sealed_contact,received_at)
    values($1,$2,$3,'customers/data_request',$4,$5,null,'[]','{"ciphertext":"sole-email-locator"}',clock_timestamp()-interval '8 days')`,
    [oldId,tenantA,connectionA.id,randomUUID(),'e'.repeat(64)]);
  assert.equal(await result('select purge_shopify_privacy_contacts($1,$2,100) as result', [tenantA,connectionA.id]), 0);
  assert.equal((await result('select sealed_contact as result from shopify_privacy_requests where id=$1', [oldId])).ciphertext, 'sole-email-locator');
}));

test("one Shopify subject cannot redact another authoritative subject just because phones share a local profile", isolated(async () => {
  const first = await persist(await payload());
  const second = await persist(await payload('gid://shopify/Order/34', { shopifyCustomerGid: 'gid://shopify/Customer/12' }));
  assert.equal(first.customerId, second.customerId);
  await db.query("insert into tenant_users(tenant_id,clerk_user_id,role,status) values($1,'synthetic-owner','owner_admin','active')", [tenantA]);
  const request = await privacy(privacyPayload());
  assert.equal((await redact(request.requestId)).redactedCount, 1);
  assert.equal((await result('select sealed_source as result from shopify_source_revisions where id=$1', [second.sourceRevisionId])).ciphertext, 'a'.repeat(48));
}));

test("privacy intake is durable/idempotent after uninstall, pauses imports and rejects altered replay", isolated(async () => {
  const input = await payload();
  await db.exec("update shopify_connections set status='disconnected',processing_enabled=false,draft_import_enabled=false,intake_enabled=false");
  const request = privacyPayload();
  const received = await privacy(request);
  assert.deepEqual(await privacy(request), received);
  assert.equal(await count('shopify_privacy_requests'), 1);
  await rejected(() => privacy({ ...request, bodySha256: 'd'.repeat(64) }), /SHOPIFY_IDEMPOTENCY_CONFLICT/);
  await rejected(() => persist(input), /SHOPIFY_ACCESS_DENIED/);
  await rejected(() => db.exec("update shopify_connections set status='verified',intake_enabled=true,processing_enabled=true,draft_import_enabled=true"), /SHOPIFY_PRIVACY_REVIEW/);
  assert.equal(await count('shopify_privacy_tombstones'), 1);
  assert.equal(await count('shopify_source_orders'), 0);
}));

test("owner source redaction is bounded/idempotent, preserves business history and excludes unrelated subjects", isolated(async () => {
  const first = await persist(await payload());
  const unrelated = await persist(await payload('gid://shopify/Order/33', { shopifyCustomerGid: 'gid://shopify/Customer/33', verifiedPhoneE164: '+919000000003' }));
  await db.query("insert into tenant_users(tenant_id,clerk_user_id,role,status) values($1,'synthetic-owner','owner_admin','active'),($1,'synthetic-manager','manager','active')", [tenantA]);
  const request = await privacy(privacyPayload());
  await rejected(() => redact(request.requestId, randomUUID(), 'synthetic-manager'), /SHOPIFY_ACCESS_DENIED/);
  await rejected(() => redact(request.requestId, randomUUID(), 'synthetic-owner', tenantB), /SHOPIFY_ACCESS_DENIED/);
  const key = randomUUID();
  const redacted = await redact(request.requestId, key);
  assert.equal(redacted.redactedCount, 1);
  assert.equal(redacted.businessDispositionRequired, true);
  assert.deepEqual(await redact(request.requestId, key), redacted);
  const packet = await result('select sealed_source as result from shopify_source_revisions where id=$1', [first.sourceRevisionId]);
  assert.deepEqual(packet, { redactedByRequest: request.requestId });
  assert.equal((await result('select sealed_source as result from shopify_source_revisions where id=$1', [unrelated.sourceRevisionId])).ciphertext, 'a'.repeat(48));
  assert.equal(await count('shopify_source_lines'), 2);
  assert.equal(await count('shopify_draft_import_results'), 2);
  assert.equal(await count('customers'), 3);
  assert.equal(await count('orders'), 3);
  await rejected(() => db.query("update shopify_source_revisions set review_reasons='[]' where id=$1", [first.sourceRevisionId]), /SHOPIFY_AUDIT_IMMUTABLE/);
  await rejected(() => db.query('delete from shopify_privacy_requests where id=$1', [request.requestId]), /SHOPIFY_RECEIPT_IMMUTABLE/);
}));

test("data requests are not erasure; shop erase covers every source and service/ordinary roles cannot bypass commands", isolated(async () => {
  await persist(await payload());
  await db.query("insert into tenant_users(tenant_id,clerk_user_id,role,status) values($1,'synthetic-owner','owner_admin','active')", [tenantA]);
  const exported = await privacy(privacyPayload('customers/data_request'));
  assert.equal(await result('select processing_enabled as result from shopify_connections'), true);
  assert.equal(await count('shopify_privacy_tombstones'), 0);
  await rejected(() => redact(exported.requestId), /SHOPIFY_COMMAND_INVALID/);
  const shop = await privacy(privacyPayload('shop/redact', { customerGid: null }));
  assert.equal((await redact(shop.requestId)).redactedCount, 1);
  assert.equal(await result("select count(*)::integer as result from shopify_privacy_tombstones where identity_key='SHOP'"), 1);
  await db.exec('set local role service_role');
  await rejected(() => db.exec("update shopify_source_revisions set sealed_source='{}'"), /permission denied/);
  await db.exec('reset role; set local role authenticated');
  await rejected(() => privacy(privacyPayload()), /permission denied/);
  await db.exec('reset role');
}));

test(
  "complete import atomically creates customer, inert order, source lines, revision and completion",
  isolated(async () => {
    const input = await payload();
    const saved = await persist(input);
    assert.equal(saved.status, "draft");
    assert.equal(saved.customerResolution, "created");
    assert.equal(saved.releaseEligible, false);
    const order = (
      await db.query("select * from orders where id=$1", [saved.orderId])
    ).rows[0];
    assert.equal(order.order_status, "draft");
    assert.equal(order.source, "shopify");
    assert.equal(order.financial_management, "external_shopify");
    assert.equal(order.delivery_type, null);
    for (const field of [
      "total_amount",
      "amount_paid",
      "subtotal",
      "gst_amount",
      "taxable_amount",
      "discount_amount",
    ])
      assert.equal(Number(order[field]), 0);
    assert.equal(await count("order_items"), 0);
    assert.equal(await count("order_payments"), 0);
    assert.equal(await count("shopify_source_orders"), 1);
    assert.equal(await count("shopify_source_revisions"), 1);
    assert.equal(await count("shopify_source_lines"), 1);
    assert.equal(await count("shopify_draft_import_results"), 1);
    const job = (
      await db.query("select * from shopify_sync_jobs where id=$1", [
        input.jobId,
      ])
    ).rows[0];
    assert.equal(job.completed_generation, 1);
    assert.equal(job.lease_token, null);
    assert.equal(JSON.stringify(saved).includes("Fictional"), false);
    assert.equal(JSON.stringify(saved).includes("+919"), false);
  }),
);

test(
  "replay survives pause/expiry; changed intent conflicts and soft deletion never permits a duplicate",
  isolated(async () => {
    const input = await payload();
    const saved = await persist(input);
    await db.query(
      "update shopify_connections set status='paused',processing_enabled=false where id=$1",
      [connectionA.id],
    );
    assert.deepEqual(await persist(input), saved);
    await rejected(
      () => persist({ ...input, sourceDigest: "c".repeat(64) }),
      /SHOPIFY_IDEMPOTENCY_CONFLICT/,
    );
    await db.query("update orders set deleted_at=now() where id=$1", [
      saved.orderId,
    ]);
    assert.deepEqual(await persist(input), saved);
    assert.equal(await count("shopify_source_orders"), 1);
  }),
);

test(
  "SQL write failure rolls back customer, draft, source and completion, retaining received work",
  isolated(async () => {
    const input = await payload();
    await db.exec(`create function fail_import_test() returns trigger language plpgsql as $$ begin raise exception 'SYNTHETIC_WRITE_FAILURE'; end $$;
    create trigger fail_import_test before insert on shopify_source_lines for each row execute function fail_import_test();`);
    await rejected(() => persist(input), /SYNTHETIC_WRITE_FAILURE/);
    assert.equal(await count("customers"), 1);
    assert.equal(await count("orders"), 1);
    for (const table of [
      "shopify_source_orders",
      "shopify_source_revisions",
      "shopify_draft_import_results",
      "shopify_customer_bindings",
    ])
      assert.equal(await count(table), 0);
    const job = (
      await db.query("select * from shopify_sync_jobs where id=$1", [
        input.jobId,
      ])
    ).rows[0];
    assert.equal(job.completed_generation, 0);
    assert.equal(job.lease_token, input.leaseToken);
    assert.equal(await count("shopify_webhook_receipts"), 1);
  }),
);

test(
  "stale, foreign, paused, pre-cutoff and expired inputs cause zero domain writes",
  isolated(async () => {
    const input = await payload();
    for (const patch of [
      { tenantId: tenantB },
      { shopGid: "gid://shopify/Shop/999" },
      { appRef: "other" },
      { environment: "development" },
      { leaseToken: randomUUID() },
      { connectionRevision: 1 },
      { generation: 2 },
      { observedAt: "2026-10-08T00:00:00Z" },
      { sourceCreatedAt: "2026-10-07T00:00:00Z" },
    ]) {
      await rejected(
        () => persist({ ...input, ...patch }),
        /SHOPIFY_(ACCESS_DENIED|SOURCE_CHANGED|COMMAND_INVALID)/,
      );
    }
    await db.query(
      "update shopify_sync_jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=$1",
      [input.jobId],
    );
    await rejected(() => persist(input), /SHOPIFY_ACCESS_DENIED/);
    assert.equal(await count("orders"), 1);
    assert.equal(await count("customers"), 1);
  }),
);

test(
  "independent ID and phone disagreement holds an unlinked draft without changing either customer",
  isolated(async () => {
    const first = await persist(await payload());
    await db.query(
      "insert into customers(tenant_id,name,normalized_phone_e164) values($1,'Other buyer','+919000000002')",
      [tenantA],
    );
    const input = await payload("gid://shopify/Order/22", {
      verifiedPhoneE164: "+919000000002",
    });
    const saved = await persist(input);
    assert.equal(saved.customerId, null);
    assert.equal(saved.customerResolution, "review");
    assert.ok(saved.reasons.includes("CUSTOMER_ID_PHONE_CONFLICT"));
    assert.equal(await count("customers"), 3);
    assert.notEqual(first.customerId, null);
  }),
);

test(
  "multiple source identities reuse one tenant phone; deleted bindings never resurrect; guests are order scoped",
  isolated(async () => {
    const first = await persist(await payload());
    const second = await persist(
      await payload("gid://shopify/Order/22", {
        shopifyCustomerGid: "gid://shopify/Customer/12",
      }),
    );
    assert.equal(first.customerId, second.customerId);
    assert.equal(await count("shopify_customer_bindings"), 2);
    await db.query("update customers set deleted_at=now() where id=$1", [
      first.customerId,
    ]);
    const held = await persist(await payload("gid://shopify/Order/23"));
    assert.equal(held.customerId, null);
    assert.ok(held.reasons.includes("CUSTOMER_DELETED"));
    const guest = {
      shopifyCustomerGid: null,
      verifiedPhoneE164: null,
      generatedName: true,
      proposedName: "Shopify guest — synthetic",
    };
    const g1 = await persist(await payload("gid://shopify/Order/24", guest));
    const g2 = await persist(await payload("gid://shopify/Order/25", guest));
    assert.notEqual(g1.customerId, g2.customerId);
  }),
);

test(
  "email-only matches and legacy unscoped identities require review; profile phones/names are not overwritten",
  isolated(async () => {
    const first = await persist(await payload());
    await db.query(
      "update customers set email='synthetic@example.test' where id=$1",
      [first.customerId],
    );
    const email = await persist(
      await payload("gid://shopify/Order/22", {
        shopifyCustomerGid: null,
        verifiedPhoneE164: null,
        emailSuggestion: "synthetic@example.test",
      }),
    );
    assert.equal(email.customerId, null);
    assert.ok(email.reasons.includes("CUSTOMER_EMAIL_REVIEW"));
    const changed = await persist(
      await payload("gid://shopify/Order/23", {
        verifiedPhoneE164: "+919000000002",
        proposedName: "Do not replace",
      }),
    );
    assert.equal(changed.customerId, first.customerId);
    assert.ok(changed.reasons.includes("CUSTOMER_PHONE_CHANGED"));
    const customer = (
      await db.query("select * from customers where id=$1", [first.customerId])
    ).rows[0];
    assert.equal(customer.name, "Fictional buyer");
    assert.equal(customer.normalized_phone_e164, "+919876543210");
  }),
);

test(
  "new receipt during hydration is retained; newer revision reuses draft and keeps old revision immutable",
  isolated(async () => {
    const input = await payload();
    await receive();
    const first = await persist(input);
    let job = (
      await db.query("select * from shopify_sync_jobs where id=$1", [
        input.jobId,
      ])
    ).rows[0];
    assert.equal(job.requested_generation, 2);
    assert.equal(job.completed_generation, 1);
    const [lease] = await result(
      "select claim_shopify_jobs($1,$2,'production','synthetic-app',1) as result",
      [tenantA, connectionA.id],
    );
    const second = {
      ...input,
      generation: lease.generation,
      leaseToken: lease.leaseToken,
      sourceDigest: "c".repeat(64),
      observedAt: await fixtureTimestamp(),
    };
    const saved = await persist(second);
    assert.equal(first.orderId, saved.orderId);
    assert.equal(await count("shopify_source_revisions"), 2);
    assert.equal(await count("orders"), 2);
    await rejected(
      () =>
        db.exec(
          "update shopify_source_revisions set source_digest=repeat('a',64)",
        ),
      /SHOPIFY_AUDIT_IMMUTABLE/,
    );
  }),
);

test(
  "database denies commercial/payment/production changes and ordinary roles cannot access source or command",
  isolated(async () => {
    const saved = await persist(await payload());
    for (const sql of [
      "update orders set total_amount=100",
      "update orders set source='walk_in'",
      "update orders set order_status='confirmed'",
      "update orders set financial_management='local'",
    ]) {
      await rejected(
        () => db.query(`${sql} where id=$1`, [saved.orderId]),
        /SHOPIFY_DRAFT_LOCKED|check constraint/,
      );
    }
    await rejected(
      () =>
        db.query(
          "insert into order_payments(tenant_id,order_id,amount) values($1,$2,1)",
          [tenantA, saved.orderId],
        ),
      /SHOPIFY_ORDER_READ_ONLY/,
    );
    await rejected(
      () =>
        db.query(
          "insert into order_items(tenant_id,order_id,name,item_type_id,workflow_id) values($1,$2,'synthetic',$3,$3)",
          [tenantA, saved.orderId, randomUUID()],
        ),
      /SHOPIFY_ORDER_READ_ONLY/,
    );
    for (const role of ["anon", "authenticated"]) {
      assert.equal(
        await result(
          "select has_function_privilege($1,'import_shopify_draft(jsonb,boolean)','execute') as result",
          [role],
        ),
        false,
      );
      assert.equal(
        await result(
          "select has_function_privilege($1,'recover_shopify_draft(jsonb)','execute') as result",
          [role],
        ),
        false,
      );
      for (const table of [
        "shopify_source_orders",
        "shopify_source_revisions",
        "shopify_source_lines",
        "shopify_customer_bindings",
        "shopify_draft_import_results",
      ])
        assert.equal(
          await result("select has_table_privilege($1,$2,'select') as result", [
            role,
            table,
          ]),
          false,
        );
    }
    // Local operations still work after the additive upgrade.
    await db.exec(
      "insert into order_payments(tenant_id,order_id,amount) select tenant_id,id,10 from orders where tracking_token='legacy-token'",
    );
    assert.equal(await count("order_payments"), 1);
  }),
);

test(
  "real validated preparation + AES-GCM adapter persists encrypted source through actual SQL",
  isolated(async () => {
    const input = await payload();
    const value = snapshot();
    const observedAt = await fixtureTimestamp();
    Object.assign(value, {
      jobId: input.jobId,
      generation: input.generation,
      connectionRevision: input.connectionRevision,
      observedAt,
    });
    const jobLease = {
      jobId: input.jobId,
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      orderGid: input.sourceOrderGid,
      generation: input.generation,
      connectionRevision: input.connectionRevision,
      leaseToken: input.leaseToken,
      leaseExpiresAt: (
        await db.query(
          "select lease_expires_at from shopify_sync_jobs where id=$1",
          [input.jobId],
        )
      ).rows[0].lease_expires_at.toISOString(),
    };
    const store = createShopifyDraftStore({
      rpc(name, args) {
        assert.ok(
          ["import_shopify_draft", "recover_shopify_draft"].includes(name),
        );
        return {
          abortSignal: async () => ({
            data:
              name === "recover_shopify_draft"
                ? await result(
                    "select recover_shopify_draft($1::jsonb) as result",
                    [JSON.stringify(args.p_input)],
                  )
                : await persist(args.p_input),
            error: null,
          }),
        };
      },
    });
    const settings = {
      ...env,
      SHOPIFY_DRAFT_IMPORT_ENABLED: "true",
      SHOPIFY_SOURCE_KEY_ID: "synthetic-v1",
      SHOPIFY_SOURCE_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    };
    const saved = await store.importSnapshot(
      value,
      { ...context, revision: input.connectionRevision },
      jobLease,
      new AbortController().signal,
      settings,
      Date.parse(observedAt),
    );
    const revision = (
      await db.query("select * from shopify_source_revisions where id=$1", [
        saved.sourceRevisionId,
      ])
    ).rows[0];
    assert.equal(revision.sealed_source.version, 1);
    assert.equal(revision.sealed_source.keyId, "synthetic-v1");
    assert.equal(
      JSON.stringify(revision).includes("Synthetic blue shirt"),
      false,
    );
    assert.equal(saved.releaseEligible, false);
    assert.ok(saved.reasons.includes("MAPPING_REQUIRED"));
    assert.equal(await count("order_items"), 0);
    assert.equal(await count("order_payments"), 0);
    assert.deepEqual(
      await store.importSnapshot(
        value,
        { ...context, revision: input.connectionRevision },
        jobLease,
        new AbortController().signal,
        settings,
      ),
      saved,
    );
    await db.exec(
      "update shopify_connections set status='paused',processing_enabled=false",
    );
    assert.deepEqual(
      await store.recoverCommittedSnapshot(
        value,
        { ...context, revision: input.connectionRevision },
        jobLease,
        new AbortController().signal,
        settings,
        Date.parse(jobLease.leaseExpiresAt) + 1,
      ),
      saved,
    );
  }),
);

test(
  "shared operational view excludes draft counts, revenue, customer history and guessed tracking tokens",
  isolated(async () => {
    const saved = await persist(await payload());
    const rows = (
      await db.query(
        "select order_status,total_amount from local_operational_orders",
      )
    ).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].order_status, "confirmed");
    assert.equal(Number(rows[0].total_amount), 100);
    const token = (
      await db.query("select tracking_token from orders where id=$1", [
        saved.orderId,
      ])
    ).rows[0].tracking_token;
    assert.equal(
      (
        await db.query(
          "select id from local_operational_orders where tracking_token=$1",
          [token],
        )
      ).rows.length,
      0,
    );
    await db.exec(
      "grant select on orders to service_role; set local role service_role",
    );
    assert.equal(await count("local_operational_orders"), 1);
    await db.exec("reset role");
    for (const role of ["anon", "authenticated"])
      assert.equal(
        await result(
          "select has_table_privilege($1,'local_operational_orders','select') as result",
          [role],
        ),
        false,
      );
  }),
);

test(
  "database activation fences, tenant suspension, duplicate lines and malformed inputs are fail-closed",
  isolated(async () => {
    const input = await payload();
    await db.exec("savepoint activation");
    await db.exec("update shopify_connections set draft_import_enabled=false");
    await rejected(() => persist(input), /SHOPIFY_ACCESS_DENIED/);
    await db.exec("rollback to savepoint activation");
    await db.exec("savepoint activation");
    await db.query("update tenants set status='suspended' where id=$1", [
      tenantA,
    ]);
    await rejected(() => persist(input), /SHOPIFY_ACCESS_DENIED/);
    await db.exec("rollback to savepoint activation");
    for (const patch of [
      { lines: [...input.lines, ...input.lines] },
      { lines: [] },
      { reasons: ["private customer"] },
      { sealedSource: {} },
    ])
      await rejected(
        () => persist({ ...input, ...patch }),
        /SHOPIFY_COMMAND_INVALID/,
      );
    assert.equal(await count("orders"), 1);
    assert.equal(await count("customers"), 1);
    const missing = await result(
      "select recover_shopify_draft($1::jsonb) as result",
      [JSON.stringify(input)],
    );
    assert.equal(missing, null);
    assert.equal(await count("orders"), 1);
    assert.equal(await count("customers"), 1);
  }),
);

test(
  "legacy unscoped CSV identities remain untouched; a match without independent phone stays held",
  isolated(async () => {
    const customer = (
      await db.query("select id from customers where tenant_id=$1", [tenantA])
    ).rows[0].id;
    await db.query(
      "insert into customer_external_identities(tenant_id,customer_id,provider,external_customer_id) values($1,$2,'shopify','11')",
      [tenantA, customer],
    );
    const saved = await persist(
      await payload(orderGid, { verifiedPhoneE164: null }),
    );
    assert.equal(saved.customerId, null);
    assert.ok(saved.reasons.includes("LEGACY_IDENTITY_REVIEW"));
    assert.equal(await count("shopify_customer_bindings"), 0);
    assert.equal(await count("customers"), 1);
    assert.equal(
      (await db.query("select customer_id from customer_external_identities"))
        .rows[0].customer_id,
      customer,
    );
  }),
);

test(
  "unverified phone without authoritative customer ID stays unlinked; real phoneless guests still work",
  isolated(async () => {
    const saved = await persist(
      await payload(orderGid, {
        shopifyCustomerGid: null,
        verifiedPhoneE164: null,
        unverifiedPrimaryPhone: "1234567890",
        phoneCountryConflict: true,
      }),
    );
    assert.equal(saved.customerId, null);
    assert.equal(saved.customerResolution, "review");
    assert.ok(saved.reasons.includes("CUSTOMER_PHONE_REVIEW"));
    assert.equal(await count("customers"), 1);
    const withId = await persist(
      await payload("gid://shopify/Order/22", {
        verifiedPhoneE164: null,
        unverifiedPrimaryPhone: "1234567890",
      }),
    );
    assert.notEqual(withId.customerId, null);
    assert.equal(withId.customerResolution, "created");
    assert.equal(
      (
        await db.query("select phone from customers where id=$1", [
          withId.customerId,
        ])
      ).rows[0].phone,
      null,
    );
  }),
);

test(
  "ID reuse never replaces a populated unnormalized profile phone with a different source phone key",
  isolated(async () => {
    const first = await persist(await payload());
    await db.query(
      "update customers set normalized_phone_e164=null,phone='unverified historical phone' where id=$1",
      [first.customerId],
    );
    const second = await persist(
      await payload("gid://shopify/Order/22", {
        verifiedPhoneE164: "+919000000002",
      }),
    );
    assert.equal(second.customerId, first.customerId);
    const profile = (
      await db.query(
        "select phone,normalized_phone_e164 from customers where id=$1",
        [first.customerId],
      )
    ).rows[0];
    assert.equal(profile.phone, "unverified historical phone");
    assert.equal(profile.normalized_phone_e164, null);
    assert.ok(second.reasons.includes("CUSTOMER_PHONE_UNVERIFIED"));
  }),
);

test(
  "blank displayed phone is not filled with a source value that conflicts with a populated match key",
  isolated(async () => {
    const first = await persist(await payload());
    await db.query("update customers set phone=null where id=$1", [
      first.customerId,
    ]);
    const second = await persist(
      await payload("gid://shopify/Order/22", {
        verifiedPhoneE164: "+919000000002",
      }),
    );
    const profile = (
      await db.query(
        "select phone,normalized_phone_e164 from customers where id=$1",
        [first.customerId],
      )
    ).rows[0];
    assert.equal(profile.phone, null);
    assert.equal(profile.normalized_phone_e164, "+919876543210");
    assert.ok(second.reasons.includes("CUSTOMER_PHONE_CHANGED"));
  }),
);
