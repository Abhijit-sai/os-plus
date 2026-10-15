// No network/credentials/private-file reader. Caller supplies only an already
// verified, disconnected clone transport. Business tests use new fictional IDs.
import { randomUUID,createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { identifier } from './private-backup-contract.mjs';
import { catalogueSql,canonicalRowsQuery,differences } from './schema-catalogue.mjs';
import { parseRows } from './private-backup-rows.mjs';
import { rolesSql,membershipSql,defaultsSql,schemaAclSql } from './private-backup-permissions.mjs';
export const runtimeRpcNames=['initialize_work_unit_workflow','start_work_unit_stage','complete_work_unit_stage',
  'create_work_unit_runtime','create_task_command','assign_task_command','start_task_command','complete_task_command','cancel_task_command',
  'start_work_unit_stage_command','complete_work_unit_stage_command','assert_laundry_vertical_enabled','generate_laundry_human_code',
  'generate_qr_identity_token','create_laundry_pickup_request_command','create_laundry_container_asset_command',
  'complete_laundry_pickup_request_command','create_laundry_service_lot_command'];
export function expectedPermissionRepair(o){
  return o.kind==='function_access'&&runtimeRpcNames.includes(o.name.split('(')[0])&&/\.(anon|authenticated)$/.test(o.name)
    &&o.actualHash===createHash('md5').update('false').digest('hex');
}

export function validateOwnershipEvidence(bytes){
  if(createHash('sha256').update(bytes).digest('hex')!=='5bd249847bcef0f62907f020b46a7e6cbac77cb2d98e889f7876c53eedc0f2d4')throw new Error('REHEARSAL_OWNERSHIP_EVIDENCE_INVALID');
  const evidence=JSON.parse(bytes.toString('utf8')),o=evidence.ownership;
  if(evidence.status!=='ownership_checked_readonly'||evidence.check!=='approved-database-ownership-only'||evidence.productionWrites!==false
    ||evidence.projectRef!=='dxiyihrdfismbuqdmhit'||o?.database!=='postgres'||o.actor!=='postgres'||o.owner!=='postgres'
    ||o.readOnly!==true||o.migrationActorCanCreate!==true||o.migrationActorDatabaseCreate!==true)throw new Error('REHEARSAL_OWNERSHIP_EVIDENCE_INVALID');
  return o;
}
// Only the caller's verified network-none clone transport is accepted. No source
// connection or credential is available here. The old archive is not rewritten.
export async function alignVerifiedCloneOwner({exec,rows}){
  const evidence=validateOwnershipEvidence(await readFile(new URL('../../docs/shopify-ownership-check-41d468410f65cd0f95f464fdc11cba7c.json',import.meta.url)));
  const query=`SELECT r.rolname::text AS owner,has_schema_privilege('postgres','public','CREATE') AS can_create,
    has_database_privilege('postgres',current_database(),'CREATE') AS database_create FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba
    WHERE d.datname=current_database() AND d.datname='postgres'`;
  const before=(await rows(query))[0];if(!before)throw new Error('REHEARSAL_OWNERSHIP_EVIDENCE_INVALID');
  await exec('ALTER DATABASE postgres OWNER TO postgres;');
  const after=(await rows(query))[0];
  if(after?.owner!=='postgres'||after.can_create!==true||after.database_create!==true)throw new Error('REHEARSAL_OWNERSHIP_EVIDENCE_INVALID');
  return {cloneOnly:true,archiveDatabaseOwnerCaptured:false,attestationTime:evidence.checkedAt,
    evidenceSha256:'5bd249847bcef0f62907f020b46a7e6cbac77cb2d98e889f7876c53eedc0f2d4',before,after};
}

export function rejectionMatches(probe,expected){
  if(probe?.rejected!==true||!expected)return false;
  return expected==='42501'?probe.sqlstate==='42501':expected.split('|').includes(probe.code);
}

export function literal(value){
  if(typeof value!=='string'||value.includes('\0'))throw new Error('REHEARSAL_LITERAL_INVALID');
  return "'"+value.replaceAll("'","''")+"'";
}
export function parseScenario(text){
  const lines=text.split(/\r?\n/).filter(line=>line.startsWith('OSPLUS_REHEARSAL_RESULT:'));
  if(lines.length!==1)throw new Error('REHEARSAL_RESULT_INVALID');
  const result=JSON.parse(lines[0].slice('OSPLUS_REHEARSAL_RESULT:'.length));
  if(typeof result.passed!=='boolean')throw new Error('REHEARSAL_RESULT_INVALID');
  return result;
}
export function projectedDigest(table,columns){
  if(!Array.isArray(columns)||!columns.length)throw new Error('REHEARSAL_COLUMNS_INVALID');
  return `SELECT count(*)::text AS rows,md5(coalesce(string_agg(d,' ' ORDER BY d),'')) AS digest FROM
    (SELECT md5(row_to_json(t)::text) AS d FROM (SELECT ${columns.map(identifier).join(',')} FROM public.${identifier(table)}) t) q`;
}

export function fixtureSql(ids){
  const {tenant,foreign,connection,itemType,workflow,stage}=ids;
  return `
CREATE FUNCTION pg_temp.try_command(p_sql text) RETURNS jsonb LANGUAGE plpgsql AS $probe$
DECLARE state text;msg text;BEGIN
  EXECUTE p_sql;RETURN jsonb_build_object('rejected',false,'code','EXECUTED');
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS state=RETURNED_SQLSTATE,msg=MESSAGE_TEXT;
  RETURN jsonb_build_object('rejected',true,'sqlstate',state,'code',CASE WHEN msg ~ '^(SHOPIFY_[A-Z_]+|REHEARSAL_INJECTED_FAILURE)$' THEN msg ELSE 'REDACTED_DATABASE_ERROR' END);
END $probe$;
CREATE FUNCTION pg_temp.fixture(p_release boolean DEFAULT false,p_partial boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql AS $fixture$
DECLARE ta uuid:=${literal(tenant)};tb uuid:=${literal(foreign)};cid uuid:=${literal(connection)};
  it uuid:=${literal(itemType)};wf uuid:=${literal(workflow)};st uuid:=${literal(stage)};
  domain text:='synthetic-rehearsal.myshopify.com';shop text:='gid://shopify/Shop/99991014';
  ordergid text:='gid://shopify/Order/9999101401';rev bigint;lease jsonb;input jsonb;saved jsonb;
  map1 jsonb;map2 jsonb;decision jsonb;review jsonb;proof jsonb;released jsonb;sid uuid;stamp timestamptz;
BEGIN
  IF EXISTS(SELECT 1 FROM public.tenants WHERE id IN(ta,tb)) THEN RAISE EXCEPTION 'REHEARSAL_TENANT_COLLISION';END IF;
  INSERT INTO public.tenants(id,name,slug,store_name) VALUES(ta,'Fictional rehearsal','rehearsal-'||ta,'Fictional rehearsal'),(tb,'Fictional foreign','rehearsal-'||tb,'Fictional foreign');
  INSERT INTO public.tenant_users(tenant_id,clerk_user_id,role,status) VALUES
    (ta,'rehearsal-owner','owner_admin','active'),(ta,'rehearsal-manager','manager','active'),(ta,'rehearsal-finance','finance','active'),(tb,'rehearsal-foreign-owner','owner_admin','active');
  INSERT INTO public.tenant_verticals(tenant_id,vertical_definition_id,is_enabled,enabled_at)
    SELECT ta,id,true,now() FROM public.vertical_definitions WHERE key='boutique';
  -- Privileged FICTIONAL readiness only; never evidence of installed Shopify or actual protected access.
  INSERT INTO public.shopify_connections(id,tenant_id,shop_gid,canonical_domain,app_ref,environment,status,verified_at,
    intake_enabled,processing_enabled,draft_import_enabled,release_enabled,scopes_verified_at,protected_customer_fields_verified_at,source_copy_authorized_at,import_created_at_cutoff)
    VALUES(cid,ta,shop,domain,'synthetic-rehearsal','production','verified',now(),true,true,true,true,now(),now(),now(),now()-interval '1 day');
  SELECT revision INTO rev FROM public.shopify_connections WHERE id=cid;
  PERFORM public.receive_shopify_event(ta,cid,domain,'synthetic-rehearsal','production',rev,'orders/create',gen_random_uuid(),NULL,'2026-10',ordergid,repeat('a',64),NULL);
  lease:=public.claim_shopify_jobs(ta,cid,'production','synthetic-rehearsal',1)->0;stamp:=clock_timestamp();
  input:=jsonb_build_object('tenantId',ta,'connectionId',cid,'environment','production','appRef','synthetic-rehearsal','shopGid',shop,'shopDomain',domain,'apiVersion','2026-10',
    'jobId',lease->'jobId','generation',lease->'generation','leaseToken',lease->'leaseToken','connectionRevision',lease->'connectionRevision',
    'sourceOrderGid',ordergid,'sourceCreatedAt',stamp,'sourceUpdatedAt',stamp,'observedAt',stamp,'sourceCurrency','INR','sourceDigest',repeat('b',64),'meaningfulDigest',repeat('c',64),
    'customer',jsonb_build_object('proposedName','Fictional buyer','generatedName',false,'shopifyCustomerGid','gid://shopify/Customer/99991014','verifiedPhoneE164','+919000000011',
      'emailSuggestion',NULL,'unverifiedPrimaryPhone',NULL,'phoneCountryConflict',false),
    'reasons',jsonb_build_array('MAPPING_REQUIRED','DELIVERY_REVIEW_REQUIRED'),
    'sealedSource',jsonb_build_object('version',1,'keyId','synthetic-envelope','iv',repeat('a',16),'tag',repeat('a',24),'ciphertext',repeat('a',48)),
    'lines',jsonb_build_array(jsonb_build_object('lineGid','gid://shopify/LineItem/1','quantity',1,'currentQuantity',1),jsonb_build_object('lineGid','gid://shopify/LineItem/2','quantity',2,'currentQuantity',2)));
  IF p_partial THEN input:=input||jsonb_build_object('completeness','partial','sourceCurrency','XXX','meaningfulDigest',NULL,'lines','[]'::jsonb,'reasons',jsonb_build_array('INCOMPLETE_SOURCE'),
    'customer',jsonb_build_object('proposedName','Incomplete fictional source','generatedName',true,'shopifyCustomerGid',NULL,'verifiedPhoneE164',NULL,'emailSuggestion',NULL,'unverifiedPrimaryPhone',NULL,'phoneCountryConflict',false));END IF;
  saved:=public.import_shopify_draft(input);sid:=(SELECT id FROM public.shopify_source_orders WHERE tenant_id=ta AND order_id=(saved->>'orderId')::uuid);
  IF NOT p_partial THEN
    INSERT INTO public.item_types(id,tenant_id,name) VALUES(it,ta,'Fictional shirt');
    INSERT INTO public.stage_master(id,tenant_id,name,effort_tracking_mode) VALUES(st,ta,'Fictional stitching','units');
    INSERT INTO public.workflows(id,tenant_id,name,item_type_id) VALUES(wf,ta,'Fictional workflow',it);
    INSERT INTO public.workflow_stages(tenant_id,workflow_id,stage_master_id,sequence_number) VALUES(ta,wf,st,1);
    map1:=public.save_shopify_mapping(ta,cid,'rehearsal-owner',gen_random_uuid(),jsonb_build_object('mappingId',NULL,'expectedRevision',0,'variantGid','gid://shopify/ProductVariant/21','sku','EXACT',
      'classification','production','itemTypeId',it,'workflowId',wf,'standardSizeId',NULL,'isActive',true,'reason','Fictional owner choice'));
    map2:=public.save_shopify_mapping(ta,cid,'rehearsal-owner',gen_random_uuid(),jsonb_build_object('mappingId',NULL,'expectedRevision',0,'variantGid','gid://shopify/ProductVariant/22','sku','SECOND',
      'classification','production','itemTypeId',it,'workflowId',wf,'standardSizeId',NULL,'isActive',true,'reason','Fictional owner choice'));
    decision:=jsonb_build_object('customerId',saved->'customerId','deliveryType','store_pickup','reason','Fictional source reviewed','lines',
      jsonb_build_array(jsonb_build_object('lineGid','gid://shopify/LineItem/1','mappingId',map1->'mappingId','mappingRevision',1),
        jsonb_build_object('lineGid','gid://shopify/LineItem/2','mappingId',map2->'mappingId','mappingRevision',1)));
    review:=public.save_shopify_draft_review(ta,cid,'rehearsal-owner',gen_random_uuid(),sid,(saved->>'sourceRevisionId')::uuid,0,decision);
    proof:=jsonb_build_object('connectionRevision',rev,'sourceDigest',input->'sourceDigest','sourceUpdatedAt',input->'sourceUpdatedAt','verifiedAt',clock_timestamp(),
      'sourceCurrency','INR','moneyValidation','restricted_reconciliation_passed','lines',jsonb_build_array(
        jsonb_build_object('lineGid','gid://shopify/LineItem/1','variantGid','gid://shopify/ProductVariant/21','quantity',1,'name','Fictional shirt','originalUnitMinorUnits','100000','netMinorUnits','90000','productionAllowed',true),
        jsonb_build_object('lineGid','gid://shopify/LineItem/2','variantGid','gid://shopify/ProductVariant/22','quantity',2,'name','Fictional trousers','originalUnitMinorUnits','200000','netMinorUnits','360000','productionAllowed',true)));
    IF p_release THEN released:=public.release_shopify_order(ta,cid,'rehearsal-owner',gen_random_uuid(),sid,(review->>'reviewId')::uuid,proof);END IF;
  END IF;
  RETURN jsonb_build_object('tenant',ta,'foreign',tb,'connection',cid,'input',input,'saved',saved,'source',sid,'decision',decision,'review',review,'proof',proof,'released',released,'mapping1',map1,'workflow',wf,'stage',st);
END $fixture$;
CREATE FUNCTION pg_temp.observe(f jsonb,p_partial boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql AS $observe$
DECLARE lease jsonb;input jsonb;stamp timestamptz;BEGIN
  PERFORM public.receive_shopify_event((f->>'tenant')::uuid,(f->>'connection')::uuid,'synthetic-rehearsal.myshopify.com','synthetic-rehearsal','production',
    (f->'input'->>'connectionRevision')::bigint,'orders/updated',gen_random_uuid(),NULL,'2026-10',f->'input'->>'sourceOrderGid',repeat('d',64),NULL);
  lease:=public.claim_shopify_jobs((f->>'tenant')::uuid,(f->>'connection')::uuid,'production','synthetic-rehearsal',1)->0;stamp:=clock_timestamp();
  input:=f->'input'||jsonb_build_object('jobId',lease->'jobId','generation',lease->'generation','leaseToken',lease->'leaseToken','connectionRevision',lease->'connectionRevision',
    'sourceUpdatedAt',stamp,'observedAt',stamp,'sourceDigest',repeat('d',64),'meaningfulDigest',repeat('e',64),'reasons',jsonb_build_array('SOURCE_CANCELLED','SOURCE_REFUND'));
  IF p_partial THEN input:=input||jsonb_build_object('completeness','partial','sourceCurrency','XXX','meaningfulDigest',NULL,'lines','[]'::jsonb,'reasons',jsonb_build_array('INCOMPLETE_SOURCE'));END IF;
  RETURN public.import_shopify_draft(input);
END $observe$;`;
}

export async function rehearseShopify({exec,rows,metadata,signal}){
  const result={scope:'disconnected_verified_backup',productionConnection:false,syntheticShopifyReadiness:true,
    sourceEncryptionTestedHere:false,sharedFlagsChanged:false,migrations:[],scenarios:[],blockers:[],legacyTablesPreserved:0};
  const manifest=JSON.parse(await readFile(new URL('../../docs/shopify-hosted-test-package.json',import.meta.url),'utf8'));
  if(manifest.mayApply!==false||manifest.mayDeploy!==false||manifest.mayActivate!==false||manifest.localBlockerRepairsApproved!==true
    ||manifest.localApplicationWiringApproved!==true||manifest.migrations.length!==12)throw new Error('REHEARSAL_MANIFEST_INVALID');
  const files=[];
  for(const entry of manifest.migrations){
    if(!/^\d{14}_shopify_[a-z_]+\.sql$/.test(entry.file))throw new Error('REHEARSAL_MANIFEST_INVALID');
    const bytes=await readFile(new URL('../../supabase/migrations/'+entry.file,import.meta.url));
    if(bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw new Error('REHEARSAL_MANIFEST_INVALID');
    files.push({entry,text:bytes.toString('utf8')});
  }
  const columnSets=[];
  const beforeCatalogue=parseRows(await exec(canonicalRowsQuery(catalogueSql)));
  const permissionQueries=[rolesSql,membershipSql(170000),defaultsSql,schemaAclSql];
  const beforePermissions=[];for(const query of permissionQueries)beforePermissions.push(await rows(query));
  for(const table of metadata.tables){
    const columns=(await rows(`SELECT a.attname::text AS name FROM pg_attribute a WHERE a.attrelid=${literal('public.'+table.name)}::regclass AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`)).map(c=>c.name);
    columnSets.push({name:table.name,columns});
  }
  for(const {entry,text} of files){
    signal?.throwIfAborted();const started=Date.now();
    try{
      await exec(`BEGIN;SET LOCAL ROLE postgres;SET LOCAL search_path=public,pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';\n${text}\nCOMMIT;`);
      result.migrations.push({file:entry.file,sha256:entry.sha256,status:'committed_locally',milliseconds:Date.now()-started});
    }catch{
      // A failed client acknowledgment could follow COMMIT; never assert rollback.
      result.migrations.push({file:entry.file,sha256:entry.sha256,status:'outcome_unknown_stopped',milliseconds:Date.now()-started});
      result.blockers.push('CANDIDATE_MIGRATION_FAILED');break;
    }
  }
  const schemaDiff=differences(beforeCatalogue,parseRows(await exec(canonicalRowsQuery(catalogueSql))));
  const allowedChanges=new Set(['column:orders.customer_id','column:orders.delivery_type','enum:order_source','enum:order_status']);
  const unexpected=schemaDiff.changed.filter(o=>!allowedChanges.has(`${o.kind}:${o.name}`)&&!expectedPermissionRepair(o));
  result.expectedPermissionRepairs=schemaDiff.changed.filter(expectedPermissionRepair).map(o=>o.name);
  result.legacySchema={missing:schemaDiff.missing.map(o=>`${o.kind}:${o.name}`),unexpectedChanges:unexpected.map(o=>`${o.kind}:${o.name}`),
    expectedChanges:schemaDiff.changed.filter(o=>allowedChanges.has(`${o.kind}:${o.name}`)).map(o=>`${o.kind}:${o.name}`)};
  result.legacySecurityPreserved=true;
  for(let i=0;i<permissionQueries.length;i++)if(JSON.stringify(await rows(permissionQueries[i]))!==JSON.stringify(beforePermissions[i]))result.legacySecurityPreserved=false;
  if(schemaDiff.missing.length||unexpected.length||!result.legacySecurityPreserved)result.blockers.push('UNEXPECTED_LEGACY_SCHEMA_OR_SECURITY_CHANGE');
  for(const table of columnSets){
    const digest=(await rows(projectedDigest(table.name,table.columns)))[0];
    const expected=metadata.integrity.find(t=>t.name===table.name);
    if(!expected||digest.rows!==expected.rows||digest.digest!==expected.digest)throw new Error('REHEARSAL_LEGACY_DATA_CHANGED');
    result.legacyTablesPreserved++;
  }
  if(result.blockers.length)return result;
  const ids=Object.fromEntries(['tenant','foreign','connection','itemType','workflow','stage'].map(k=>[k,randomUUID()]));
  const common=fixtureSql(ids)+`\nCREATE FUNCTION pg_temp.approve_pilot(f jsonb) RETURNS jsonb LANGUAGE sql AS $approve$
    SELECT public.command_shopify_application((f->>'tenant')::uuid,(f->>'connection')::uuid,'rehearsal-owner',gen_random_uuid(),'authorize_copy',
      jsonb_build_object('orderGid',f->'input'->>'sourceOrderGid','expectedRevision',(SELECT revision FROM public.shopify_connections WHERE id=(f->>'connection')::uuid),
        'retentionDays',1,'reason','Fictional one-order Test approval','consent',true,'shopGid',f->'input'->>'shopGid','domain',f->'input'->>'shopDomain',
        'keyId','fictional-key','verifiedAt',clock_timestamp(),'sourceCreatedAt',f->'input'->>'sourceCreatedAt','enableRelease',true));$approve$;`;
  async function scenario(id,category,body){
    signal?.throwIfAborted();
    const started=Date.now();
    const sql=`BEGIN;SET LOCAL ROLE postgres;SET LOCAL search_path=public,pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='20s';
      ${common}
      CREATE FUNCTION pg_temp.run_case() RETURNS jsonb LANGUAGE plpgsql AS $case$
        DECLARE f jsonb;probe jsonb;other jsonb;v_id uuid;k uuid:=gen_random_uuid();n integer;BEGIN ${body} END $case$;
      SELECT 'OSPLUS_REHEARSAL_RESULT:'||pg_temp.run_case()::text;ROLLBACK;`;
    try{const observation=parseScenario(await exec(sql));result.scenarios.push({id,category,...observation,milliseconds:Date.now()-started});
      if(!observation.passed)result.blockers.push(id);
    }catch{result.scenarios.push({id,category,passed:false,reason:'SCENARIO_SETUP_OR_EXECUTION_FAILED',milliseconds:Date.now()-started});result.blockers.push(id);}
  }
  const order=`(f->'saved'->>'orderId')::uuid`,ta=`(f->>'tenant')::uuid`,cid=`(f->>'connection')::uuid`,sid=`(f->>'source')::uuid`;
  const release=`public.release_shopify_order(${ta},${cid},'rehearsal-owner',k,${sid},(f->'review'->>'reviewId')::uuid,f->'proof')`;
  const rejection=(expression,code)=>{
    if(!code)throw new Error('REHEARSAL_EXACT_REJECTION_REQUIRED');
    return `probe:=pg_temp.try_command(${expression});RETURN jsonb_build_object('passed',coalesce((probe->>'rejected')::boolean AND ${code==='42501'?"probe->>'sqlstate'='42501'":`probe->>'code'=ANY(string_to_array(${literal(code)},'|'))`},false),'observation',probe);`;
  };
  const rejectQuery=(sql,code)=>rejection(`format(${literal(sql)},${order},${ta})`,code);
  await scenario('DRAFT_NOT_IN_PRODUCTION','draft',`f:=pg_temp.fixture();RETURN jsonb_build_object('passed',
    (SELECT order_status='draft' AND total_amount=0 AND amount_paid=0 AND financial_management='external_shopify' FROM public.orders WHERE id=${order})
    AND NOT EXISTS(SELECT 1 FROM public.order_items WHERE order_id=${order}) AND NOT EXISTS(SELECT 1 FROM public.operational_orders WHERE id=${order})
    AND NOT EXISTS(SELECT 1 FROM public.order_payments WHERE order_id=${order}),'state','draft','items',0,'localPayments',0);`);
  await scenario('PARTIAL_SOURCE_HAS_NO_CUSTOMER_OR_ITEMS','draft',`f:=pg_temp.fixture(false,true);RETURN jsonb_build_object('passed',
    (SELECT customer_id IS NULL AND delivery_type IS NULL AND order_status='draft' FROM public.orders WHERE id=${order})
    AND NOT EXISTS(SELECT 1 FROM public.customers WHERE tenant_id=${ta}) AND NOT EXISTS(SELECT 1 FROM public.order_items WHERE tenant_id=${ta}),'state','incomplete review');`);
  await scenario('IMPORT_IDENTICAL_RETRY_NO_DUPLICATES','retry',`f:=pg_temp.fixture();other:=public.import_shopify_draft(f->'input');RETURN jsonb_build_object('passed',other=f->'saved'
    AND (SELECT count(*)=1 FROM public.orders WHERE tenant_id=${ta}) AND (SELECT count(*)=1 FROM public.customers WHERE tenant_id=${ta})
    AND (SELECT count(*)=1 FROM public.shopify_source_revisions WHERE tenant_id=${ta}),'orders',1,'customers',1,'sourceRevisions',1);`);
  await scenario('RELEASE_TWO_LINES_QUANTITIES_AND_MONEY','release',`f:=pg_temp.fixture(true);RETURN jsonb_build_object('passed',
    (SELECT count(*)=2 AND sum(quantity)=3 AND sum(final_price)=4500 FROM public.order_items WHERE order_id=${order})
    AND (SELECT total_amount=4500 AND amount_paid=0 AND financial_management='external_shopify' AND order_status='confirmed' FROM public.orders WHERE id=${order})
    AND (SELECT count(*)=2 FROM public.item_history WHERE tenant_id=${ta}) AND (SELECT count(*)=2 FROM public.item_stage_instances WHERE tenant_id=${ta} AND status='ready_to_start')
    AND NOT EXISTS(SELECT 1 FROM public.local_operational_orders WHERE id=${order}) AND NOT EXISTS(SELECT 1 FROM public.order_payments WHERE tenant_id=${ta}),
    'state','confirmed; ready, not started','items',2,'pieces',3,'syntheticOperationalValue',4500,'localPayments',0);`);
  await scenario('RELEASE_RETRY_ONE_MATERIALIZATION','retry',`f:=pg_temp.fixture();other:=${release};probe:=${release};RETURN jsonb_build_object('passed',other=probe
    AND (SELECT count(*)=1 FROM public.shopify_releases WHERE tenant_id=${ta}) AND (SELECT count(*)=2 FROM public.order_items WHERE tenant_id=${ta})
    AND NOT EXISTS(SELECT 1 FROM public.shopify_release_capabilities WHERE tenant_id=${ta}),'releaseReceipts',1,'items',2);`);
  for(const actor of ['rehearsal-manager','rehearsal-finance','rehearsal-foreign-owner','unknown']){
    await scenario('DENY_RELEASE_'+actor.toUpperCase().replaceAll('-','_'),'permission',`f:=pg_temp.fixture();${rejection(`format('SELECT public.release_shopify_order(%L,%L,%L,%L,%L,%L,%L::jsonb)',${ta},${cid},${literal(actor)},k,${sid},f->'review'->>'reviewId',f->'proof')`,'SHOPIFY_ACCESS_DENIED')}`);
  }
  await scenario('DENY_CROSS_TENANT_RELEASE','tenant',`f:=pg_temp.fixture();${rejection(`format('SELECT public.release_shopify_order(%L,%L,%L,%L,%L,%L,%L::jsonb)',f->>'foreign',${cid},'rehearsal-owner',k,${sid},f->'review'->>'reviewId',f->'proof')`,'SHOPIFY_ACCESS_DENIED')}`);
  for(const role of ['anon','authenticated']){
    await scenario('DENY_'+role.toUpperCase()+'_SOURCE_TABLE_READ','permission',`f:=pg_temp.fixture();EXECUTE 'SET LOCAL ROLE ${role}';${rejection(`'SELECT * FROM public.shopify_source_revisions'`,'42501')} `);
    await scenario('DENY_'+role.toUpperCase()+'_IMPORT_RPC','permission',`f:=pg_temp.fixture();EXECUTE 'SET LOCAL ROLE ${role}';${rejection(`format('SELECT public.import_shopify_draft(%L::jsonb)',f->'input')`,'42501')} `);
  }
  await scenario('SERVICE_CANNOT_FORGE_RELEASE_CAPABILITY','permission',`f:=pg_temp.fixture();EXECUTE 'SET LOCAL ROLE service_role';${rejection(`format('INSERT INTO public.shopify_release_capabilities VALUES(pg_backend_pid(),txid_current(),%L,%L)',${ta},${order})`,'42501')} `);
  await scenario('MANAGER_CAN_READ_ORDER_PAYMENTS_NOT_CONTRIBUTIONS','payment',`f:=pg_temp.fixture(true);other:=public.read_shopify_payment_source(${ta},'rehearsal-manager',${order});RETURN jsonb_build_object('passed',other IS NOT NULL AND NOT(other?'contributionRate') AND NOT(other?'contributionAmount'),'expected','order payments allowed; not worker contribution amounts');`);
  for(const actor of ['rehearsal-finance','rehearsal-foreign-owner','unknown'])await scenario('DENY_SOURCE_PAYMENT_'+actor.toUpperCase().replaceAll('-','_'),'payment',`f:=pg_temp.fixture(true);RETURN jsonb_build_object('passed',public.read_shopify_payment_source(${ta},${literal(actor)},${order}) IS NULL);`);
  await scenario('DENY_FOREIGN_SOURCE_PAYMENT','tenant',`f:=pg_temp.fixture(true);RETURN jsonb_build_object('passed',public.read_shopify_payment_source((f->>'foreign')::uuid,'rehearsal-foreign-owner',${order}) IS NULL);`);
  await scenario('LOCAL_PAYMENT_POSTING_BLOCKED','payment',`f:=pg_temp.fixture(true);${rejectQuery('INSERT INTO public.order_payments(tenant_id,order_id,amount,payment_date) VALUES(%2$L,%1$L,100,current_date)','SHOPIFY_ORDER_READ_ONLY')}`);
  await scenario('COMMERCIAL_AMOUNT_EDIT_BLOCKED','payment',`f:=pg_temp.fixture(true);${rejectQuery('UPDATE public.orders SET total_amount=1 WHERE id=%1$L AND tenant_id=%2$L','SHOPIFY_ORDER_READ_ONLY')}`);
  await scenario('ITEM_QUANTITY_EDIT_BLOCKED','release',`f:=pg_temp.fixture(true);${rejectQuery('UPDATE public.order_items SET quantity=quantity+1 WHERE order_id=%1$L AND tenant_id=%2$L','SHOPIFY_ORDER_READ_ONLY')}`);
  await scenario('SOURCE_CHANGE_HOLDS_PRODUCTION','source-change',`f:=pg_temp.fixture(true);other:=pg_temp.observe(f);${rejectQuery('UPDATE public.item_stage_instances SET status=\'in_progress\' WHERE tenant_id=%2$L','SHOPIFY_PRODUCTION_HELD')}`);
  await scenario('HELD_ORDER_NOTES_STILL_EDITABLE','source-change',`f:=pg_temp.fixture(true);other:=pg_temp.observe(f);UPDATE public.item_stage_instances SET notes='Fictional note while held' WHERE tenant_id=${ta};RETURN jsonb_build_object('passed',
    (SELECT held FROM public.shopify_operational_state WHERE tenant_id=${ta}) AND (SELECT count(*)=2 FROM public.item_stage_instances WHERE tenant_id=${ta} AND notes='Fictional note while held'));`);
  await scenario('PARTIAL_POST_RELEASE_CANNOT_CONTINUE','source-change',`f:=pg_temp.fixture(true);other:=pg_temp.observe(f,true);${rejection(`format('SELECT public.review_shopify_change(%L,%L,%L,%L,%L,%L,%L,%L,%L,%L)',${ta},${cid},'rehearsal-owner',k,${sid},(SELECT latest_case_id FROM public.shopify_operational_state WHERE tenant_id=${ta}),other->>'sourceRevisionId',f->'saved'->>'sourceRevisionId','keep_os_plus_continue','Fictional owner acknowledgement')`,'SHOPIFY_INCOMPLETE_SOURCE')}`);
  await scenario('IMMUTABLE_SOURCE_HISTORY','history',`f:=pg_temp.fixture();${rejectQuery('DELETE FROM public.shopify_source_revisions WHERE tenant_id=%2$L','SHOPIFY_AUDIT_IMMUTABLE')}`);
  await scenario('RELEASE_AUDIT_FAILURE_ROLLS_BACK','rollback',`f:=pg_temp.fixture();
    EXECUTE 'CREATE FUNCTION pg_temp.fail_release() RETURNS trigger LANGUAGE plpgsql AS ''BEGIN RAISE EXCEPTION ''''REHEARSAL_INJECTED_FAILURE'''';END;''';
    EXECUTE 'CREATE TRIGGER rehearsal_fail_release BEFORE INSERT ON public.shopify_releases FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_release()';
    probe:=pg_temp.try_command(format('SELECT public.release_shopify_order(%L,%L,%L,%L,%L,%L,%L::jsonb)',${ta},${cid},'rehearsal-owner',k,${sid},f->'review'->>'reviewId',f->'proof'));
    RETURN jsonb_build_object('passed',probe->>'code'='REHEARSAL_INJECTED_FAILURE' AND NOT EXISTS(SELECT 1 FROM public.order_items WHERE tenant_id=${ta})
      AND NOT EXISTS(SELECT 1 FROM public.item_history WHERE tenant_id=${ta}) AND NOT EXISTS(SELECT 1 FROM public.shopify_releases WHERE tenant_id=${ta})
      AND NOT EXISTS(SELECT 1 FROM public.shopify_release_capabilities WHERE tenant_id=${ta}) AND (SELECT order_status='draft' FROM public.orders WHERE id=${order}),'observation',probe);`);
  await scenario('FOREIGN_MAPPING_REJECTED','mapping',`f:=pg_temp.fixture();${rejection(`format('SELECT public.save_shopify_mapping(%L,%L,%L,%L,%L::jsonb)',f->>'foreign',${cid},'rehearsal-foreign-owner',k,jsonb_build_object('mappingId',NULL,'expectedRevision',0,'variantGid','gid://shopify/ProductVariant/91','classification','production','itemTypeId',${literal(ids.itemType)},'workflowId',f->>'workflow','isActive',true,'reason','Fictional foreign mapping'))`,'SHOPIFY_ACCESS_DENIED')}`);
  await scenario('STALE_SOURCE_PROOF_REJECTED','release',`f:=pg_temp.fixture();f:=jsonb_set(f,'{proof,verifiedAt}',to_jsonb(clock_timestamp()-interval '121 seconds'));${rejection(`format('SELECT public.release_shopify_order(%L,%L,%L,%L,%L,%L,%L::jsonb)',${ta},${cid},'rehearsal-owner',k,${sid},f->'review'->>'reviewId',f->'proof')`,'SHOPIFY_STALE_REVISION')}`);
  await scenario('FOREIGN_CURRENCY_REVIEW_ONLY','payment',`f:=pg_temp.fixture();f:=jsonb_set(f,'{proof,sourceCurrency}','"USD"'::jsonb);${rejection(`format('SELECT public.release_shopify_order(%L,%L,%L,%L,%L,%L,%L::jsonb)',${ta},${cid},'rehearsal-owner',k,${sid},f->'review'->>'reviewId',f->'proof')`,'SHOPIFY_SOURCE_REVIEW')}`);
  await scenario('RELEASE_FLAG_OFF_REJECTED','activation',`f:=pg_temp.fixture();UPDATE public.shopify_connections SET release_enabled=false WHERE id=${cid};${rejection(`format('SELECT public.release_shopify_order(%L,%L,%L,%L,%L,%L,%L::jsonb)',${ta},${cid},'rehearsal-owner',k,${sid},f->'review'->>'reviewId',f->'proof')`,'SHOPIFY_RELEASE_DISABLED')}`);
  await scenario('PAUSE_BLOCKS_NEW_PROCESSING','activation',`f:=pg_temp.fixture();UPDATE public.shopify_connections SET status='paused',processing_enabled=false,intake_enabled=false WHERE id=${cid};${rejection(`format('SELECT public.release_shopify_order(%L,%L,%L,%L,%L,%L,%L::jsonb)',${ta},${cid},'rehearsal-owner',k,${sid},f->'review'->>'reviewId',f->'proof')`,'SHOPIFY_RELEASE_DISABLED|SHOPIFY_ACCESS_DENIED')}`);
  await scenario('RECOVERY_AFTER_PAUSE_IS_READ_ONLY','retry',`f:=pg_temp.fixture();UPDATE public.shopify_connections SET status='paused',processing_enabled=false,intake_enabled=false WHERE id=${cid};other:=public.recover_shopify_draft(f->'input');RETURN jsonb_build_object('passed',other=f->'saved' AND (SELECT count(*)=1 FROM public.orders WHERE tenant_id=${ta}));`);
  // Concrete live-extra module interaction tests. Missing tables are not skipped.
  const handoverInsert="INSERT INTO public.order_handovers(tenant_id,order_id,handover_number,handover_type,handed_over_at,balance_acknowledged,recipient_name) VALUES(%2$L,%1$L,'FICTIONAL-1','store_pickup',now(),true,'Fictional recipient')";
  await scenario('HANDOVER_RELEASED_UNHELD_VALID_CONTROL','handover',`f:=pg_temp.fixture(true);EXECUTE 'SET LOCAL ROLE service_role';EXECUTE format(${literal(handoverInsert)},${order},${ta});RETURN jsonb_build_object('passed',(SELECT count(*)=1 FROM public.order_handovers WHERE tenant_id=${ta}),'actor','service_role');`);
  for(const held of [false,true]){
    await scenario(held?'HANDOVER_HELD_ORDER_BLOCKED':'HANDOVER_DRAFT_ORDER_BLOCKED','handover',`f:=pg_temp.fixture(${held});${held?'other:=pg_temp.observe(f);':''}EXECUTE 'SET LOCAL ROLE service_role';
      ${rejectQuery(handoverInsert,'SHOPIFY_DRAFT_LOCKED|SHOPIFY_ORDER_READ_ONLY|SHOPIFY_PRODUCTION_HELD')}`);
  }
  const handoverChild=`INSERT INTO public.order_handover_items(tenant_id,order_id,handover_id,order_item_id,quantity,pre_handover_item_status)
    SELECT %2$L,%1$L,%3$L,i.id,1,i.item_status FROM public.order_items i WHERE i.tenant_id=%2$L AND i.order_id=%1$L ORDER BY i.id LIMIT 1`;
  const createHeader=`EXECUTE format(${literal(handoverInsert+' RETURNING id')},${order},${ta}) INTO v_id;`;
  const createChild=`EXECUTE format(${literal(handoverChild)},${order},${ta},v_id);`;
  await scenario('HANDOVER_ITEM_RELEASED_UNHELD_VALID_CONTROL','handover',`f:=pg_temp.fixture(true);EXECUTE 'SET LOCAL ROLE service_role';${createHeader}${createChild}
    RETURN jsonb_build_object('passed',(SELECT count(*)=1 FROM public.order_handover_items WHERE handover_id=v_id),'actor','service_role');`);
  for(const operation of ['insert','update','delete']){
    const command=operation==='insert'?`format(${literal(handoverChild)},${order},${ta},v_id)`:
      `format(${literal(operation==='update'?'UPDATE public.order_handover_items SET quantity=quantity+1 WHERE handover_id=%L':'DELETE FROM public.order_handover_items WHERE handover_id=%L')},v_id)`;
    await scenario('HANDOVER_HELD_ITEM_'+operation.toUpperCase()+'_BLOCKED','handover',`f:=pg_temp.fixture(true);${createHeader}${operation==='insert'?'':createChild}other:=pg_temp.observe(f);
      EXECUTE 'SET LOCAL ROLE service_role';${rejection(command,'SHOPIFY_PRODUCTION_HELD|SHOPIFY_HISTORY_PROTECTED')}`);
  }
  // Permission drift checks do not invoke unrelated real-tenant commands.
  await scenario('ORDINARY_V2_MUTATION_RPC_EXECUTE_REVOKED','permission',`RETURN jsonb_build_object('passed',
    NOT has_function_privilege('anon','public.create_work_unit_runtime(uuid,uuid,text,uuid,text,text,text,text,numeric,text,numeric,numeric,public.gst_treatment,numeric,uuid,text,uuid,text)','EXECUTE')
    AND NOT has_function_privilege('authenticated','public.create_work_unit_runtime(uuid,uuid,text,uuid,text,text,text,text,numeric,text,numeric,numeric,public.gst_treatment,numeric,uuid,text,uuid,text)','EXECUTE'),
    'expected','ordinary roles denied');`);
  // Positive control first: prove the exact fictional V2 input can create work,
  // then repeat as ordinary roles with no trusted Clerk identity/JWT. All three
  // transactions roll back; no original tenant/order is referenced.
  for(const role of ['postgres','anon','authenticated']){
    const control=role==='postgres';
    await scenario(control?'V2_WORK_UNIT_VALID_CONTROL':role.toUpperCase()+'_CANNOT_CREATE_V2_WORK','permission',`f:=pg_temp.fixture();
      INSERT INTO public.orders(id,tenant_id,customer_id,order_number,source,delivery_type,runtime_model,vertical_key,tracking_token)
        VALUES(k,${ta},(f->'saved'->>'customerId')::uuid,'FICTIONAL-V2','walk_in','store_pickup','work_unit_v2','boutique',gen_random_uuid()::text);
      EXECUTE 'SET LOCAL ROLE ${role}';
      probe:=pg_temp.try_command(format('SELECT public.create_work_unit_runtime(p_tenant_id=>%L,p_order_id=>%L,p_vertical_key=>%L,p_workflow_id=>%L,p_display_code=>%L,p_line_name=>%L,p_actor=>%L)',
        ${ta},k,'boutique',f->>'workflow','FICTIONAL-UNIT','Fictional untrusted work','untrusted-fictional-actor'));
      EXECUTE 'SET LOCAL ROLE postgres';SELECT count(*) INTO n FROM public.work_units WHERE tenant_id=${ta} AND order_id=k;
      RETURN jsonb_build_object('passed',${control?"probe->>'code'='EXECUTED' AND n=1":"probe->>'sqlstate'='42501' AND n=0"},
        'actor','${role}','observation',probe,'newFictionalWorkUnits',n);`);
  }
  await scenario('APPLICATION_OWNER_READ_AND_ONE_ORDER_APPROVAL','application',`f:=pg_temp.fixture();other:=pg_temp.approve_pilot(f);
    probe:=public.read_shopify_application(${ta},'rehearsal-owner','synthetic-rehearsal.myshopify.com','synthetic-rehearsal');
    RETURN jsonb_build_object('passed',other->>'status'='authorized' AND probe->'policy'->>'order_gid'=f->'input'->>'sourceOrderGid' AND jsonb_array_length(probe->'sources')=1);`);
  for(const actor of ['rehearsal-manager','rehearsal-finance','rehearsal-foreign-owner'])await scenario('APPLICATION_DENY_'+actor.toUpperCase().replaceAll('-','_'),'application',`f:=pg_temp.fixture();
    ${rejection(`format('SELECT public.read_shopify_application(%L,%L,%L,%L)',${ta},${literal(actor)},'synthetic-rehearsal.myshopify.com','synthetic-rehearsal')`,'SHOPIFY_ACCESS_DENIED')}`);
  await scenario('APPLICATION_OTHER_ORDER_WEBHOOK_IGNORED','application',`f:=pg_temp.fixture();other:=pg_temp.approve_pilot(f);
    probe:=public.receive_shopify_pilot_event(${ta},${cid},jsonb_build_object('deliveryId',k,'topic','orders/create','bodySha256',repeat('e',64),'orderGid','gid://shopify/Order/7777777'));
    RETURN jsonb_build_object('passed',probe->>'status'='ignored' AND (SELECT count(*)=1 FROM public.shopify_sync_jobs WHERE tenant_id=${ta}));`);
  await scenario('APPLICATION_COPY_QUEUE_RETRY_ONE_GENERATION','application',`f:=pg_temp.fixture();other:=pg_temp.approve_pilot(f);
    other:=public.command_shopify_application(${ta},${cid},'rehearsal-owner',k,'queue_order','{}');probe:=public.command_shopify_application(${ta},${cid},'rehearsal-owner',k,'queue_order','{}');
    RETURN jsonb_build_object('passed',other=probe AND (SELECT requested_generation=2 FROM public.shopify_sync_jobs WHERE tenant_id=${ta}));`);
  await scenario('APPLICATION_EXPIRED_SOURCE_PURGE_PRESERVES_BUSINESS','application',`f:=pg_temp.fixture();
    INSERT INTO public.shopify_pilot_policies(tenant_id,connection_id,order_gid,authorized_by,reason,authorized_at,expires_at,key_id)
      VALUES(${ta},${cid},f->'input'->>'sourceOrderGid','rehearsal-owner','Fictional expired copy',now()-interval '2 days',now()-interval '1 day','fictional-key');
    EXECUTE 'SET LOCAL ROLE service_role';probe:=public.purge_expired_shopify_pilot(${ta},${cid},null,1);
    RETURN jsonb_build_object('passed',probe->>'redactedCount'='1' AND probe->>'businessDispositionRequired'='true'
      AND (SELECT count(*)=1 FROM public.orders WHERE tenant_id=${ta}) AND NOT EXISTS(SELECT 1 FROM public.shopify_source_revisions WHERE tenant_id=${ta} AND sealed_source ? 'ciphertext'));`);
  for(const table of columnSets){
    const digest=(await rows(projectedDigest(table.name,table.columns)))[0];
    const expected=metadata.integrity.find(t=>t.name===table.name);
    if(digest.rows!==expected.rows||digest.digest!==expected.digest)throw new Error('REHEARSAL_LEGACY_DATA_CHANGED');
  }
  result.legacyDataPreservedAfterScenarios=true;
  result.passed=result.scenarios.filter(s=>s.passed).length;result.failed=result.scenarios.length-result.passed;
  return result;
}
