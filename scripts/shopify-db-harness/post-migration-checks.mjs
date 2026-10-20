// Read-only live checkpoints. Expected definitions come from a fictional local
// reference, never by applying candidates or invoking business RPCs on the source.
import assert from 'node:assert/strict';
import { catalogueSql,differences } from './schema-catalogue.mjs';
import { runtimeRpcNames } from './private-rehearsal.mjs';

const key=o=>`${o.kind}:${o.name}`;
// Additional explanatory comparison, never a replacement for the raw evidence.
// Normalize CRLF pairs only; do not trim/reformat SQL or hide grant differences.
export const catalogueLfSql=catalogueSql.replace('md5(definition) AS hash',
  "md5(replace(definition,chr(13)||chr(10),chr(10))) AS hash");
export function compareInstalledCandidates(baseline,proposed,live){
  const impact=differences(baseline,proposed),requiredKeys=new Set([...impact.extra,...impact.changed].map(key));
  const required=proposed.filter(o=>requiredKeys.has(key(o)));
  assert.ok(required.length>0,'EMPTY_CANDIDATE_COMPARISON');
  const diff=differences(required,live);
  const baselineKeys=new Set(baseline.map(key));
  // Catch additional Shopify overloads/policies/columns/objects too. Old unrelated
  // schema drift remains outside this candidate comparison and is not repaired.
  const unexpected=diff.extra.filter(o=>!baselineKeys.has(key(o))&&(o.name.includes('shopify')||
    o.name.startsWith('list_operational_orders(')||
    /^(local_operational_orders|operational_orders|operational_order_items)(\.|$)/.test(o.name)));
  return {expectedObjects:required.length,missing:diff.missing,changed:diff.changed,unexpected,
    passed:diff.missing.length===0&&diff.changed.length===0&&unexpected.length===0};
}

export function candidateTableNames(contents){
  const names=contents.flatMap(text=>[...text.matchAll(/^create table public\.(shopify_[a-z0-9_]+)\s*\(/gmi)].map(m=>m[1]));
  assert.equal(names.length,26);assert.equal(new Set(names).size,26);
  return names.sort();
}

export async function inspectInstalledState(source,names){
  assert.equal(names.length,26);assert.equal(new Set(names).size,26);
  assert.ok(names.every(n=>/^shopify_[a-z0-9_]+$/.test(n)));
  const identity=(await source.query(`SELECT current_database() AS database,current_user AS actor,
    current_setting('transaction_read_only') AS readonly`)).rows[0];
  assert.deepEqual(identity,{database:'postgres',actor:'postgres',readonly:'on'});
  const relations=(await source.query(`SELECT c.relname AS name,c.relrowsecurity AS rls,
    c.relkind::text AS kind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=ANY($1::text[]) ORDER BY c.relname`,[names])).rows;
  const existing=relations.filter(r=>r.kind==='r').map(r=>r.name);
  const counts=existing.length?(await source.query(existing.map(n=>
    `SELECT '${n}'::text AS name,count(*)::int AS rows FROM public."${n}"`).join(' UNION ALL ')+' ORDER BY name')).rows:[];
  const access=(await source.query(`SELECT c.relname AS name,r.rolname AS role,
    has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') AS allowed
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r
    WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND r.rolname IN ('anon','authenticated')
    ORDER BY c.relname,r.rolname`,[[...names,'local_operational_orders','operational_orders','operational_order_items','shopify_operational_summaries']])).rows;
  const runtime=(await source.query(`SELECT p.proname AS name,oidvectortypes(p.proargtypes) AS arguments,
    r.rolname AS role,has_function_privilege(r.oid,p.oid,'EXECUTE') AS allowed
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN pg_roles r
    WHERE n.nspname='public' AND p.proname=ANY($1::text[]) AND r.rolname IN ('anon','authenticated','service_role')
    ORDER BY p.proname,arguments,r.rolname`,[runtimeRpcNames])).rows;
  const sourceRoutineExposure=(await source.query(`SELECT p.proname AS name,r.rolname AS role,
    p.prorettype='trigger'::regtype AS trigger_only,p.prosecdef AS security_definer
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN pg_roles r
    WHERE n.nspname='public' AND (strpos(p.proname,'shopify')>0 OR p.proname='list_operational_orders')
    AND r.rolname IN ('anon','authenticated') AND has_function_privilege(r.oid,p.oid,'EXECUTE')
    ORDER BY p.proname,r.rolname`)).rows;
  const flagDefaults=(await source.query(`SELECT a.attname AS name,a.attnotnull AS not_null,
    pg_get_expr(d.adbin,d.adrelid)='false' AS default_false
    FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid=to_regclass('public.shopify_connections') AND a.attname=ANY($1::text[]) ORDER BY a.attname`,
    [['intake_enabled','processing_enabled','draft_import_enabled','release_enabled']])).rows;
  const handoverGuards=(await source.query(`SELECT c.relname AS name,t.tgenabled::text AS enabled,
    p.proname AS function_name,pn.nspname AS function_schema
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace
    WHERE n.nspname='public' AND c.relname IN ('order_handovers','order_handover_items')
    AND t.tgname='aaa_shopify_handover_guard' ORDER BY c.relname`)).rows;
  const orderDefaults=(await source.query(`SELECT count(*) FILTER(WHERE financial_management<>'local')::int AS nonlocal,
    count(*) FILTER(WHERE source_currency_code<>'INR')::int AS nondefault_currency
    FROM public.orders`)).rows[0];
  const routineMetadata=(await source.query(`SELECT p.proname||'('||oidvectortypes(p.proargtypes)||')' AS signature,
    p.prorettype='trigger'::regtype AS trigger_only,p.prosecdef AS security_definer,
    strpos(p.prosrc,chr(13)||chr(10))>0 AS contains_crlf
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND (strpos(p.proname,'shopify')>0 OR p.proname='list_operational_orders') ORDER BY signature`)).rows;
  const functionDefaults=(await source.query(`SELECT owner_role.rolname AS owner,coalesce(n.nspname,'GLOBAL') AS schema,
    coalesce(grantee.rolname,'PUBLIC') AS grantee,x.privilege_type
    FROM pg_default_acl d JOIN pg_roles owner_role ON owner_role.oid=d.defaclrole
    LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace CROSS JOIN LATERAL aclexplode(d.defaclacl) x
    LEFT JOIN pg_roles grantee ON grantee.oid=x.grantee WHERE d.defaclobjtype='f'
    ORDER BY owner_role.rolname,n.nspname,grantee.rolname,x.privilege_type`)).rows;
  // Metadata counts only, no query text/client identities. This cannot establish
  // that no writer ran during the owner's earlier migration window.
  const concurrentActivity=(await source.query(`SELECT count(*)::int AS other_active_sessions,
    count(*) FILTER(WHERE xact_start IS NOT NULL)::int AS active_transactions
    FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND state='active'`)).rows[0];
  const checks={allTablesPresent:existing.length===26,allTablesRls:relations.length===26&&relations.every(r=>r.kind==='r'&&r.rls===true),
    allTablesEmpty:counts.length===26&&counts.every(r=>r.rows===0),
    ordinaryRelationAccessDenied:access.length===60&&access.every(r=>r.allowed===false),
    runtimeCommandsServiceOnly:new Set(runtime.map(r=>r.name)).size===18&&runtime.length>=54&&runtime.every(r=>r.allowed===(r.role==='service_role')),
    ordinaryShopifyRpcAccessDenied:sourceRoutineExposure.filter(r=>!r.trigger_only).length===0,
    flagsDefaultOff:flagDefaults.length===4&&flagDefaults.every(r=>r.not_null===true&&r.default_false===true),
    bothHandoverGuardsEnabled:handoverGuards.length===2&&handoverGuards.every(r=>r.enabled==='O'&&r.function_name==='guard_shopify_handover'&&r.function_schema==='public'),
    existingOrdersLocal:orderDefaults.nonlocal===0&&orderDefaults.nondefault_currency===0};
  return {checks,passed:Object.values(checks).every(Boolean),tableCounts:counts,ordinaryRelationGrants:access.filter(r=>r.allowed),
    runtimeCommandsChecked:new Set(runtime.map(r=>r.name)).size,runtimePermissionFailures:runtime.filter(r=>r.allowed!==(r.role==='service_role')),
    sourceRpcExposure:sourceRoutineExposure.filter(r=>!r.trigger_only),
    triggerGrantFindings:sourceRoutineExposure.filter(r=>r.trigger_only),flagDefaults,handoverGuards,orderDefaults,concurrentActivity,
    routineMetadata,functionDefaults,
    limitations:['Current aggregates do not prove legacy row preservation or a historical writer pause.',
      'No private backup decrypted, business RPC executed, source order read, import activated or deployed configuration inspected.']};
}
