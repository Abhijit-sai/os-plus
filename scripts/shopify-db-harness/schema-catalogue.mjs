// System catalogue only. Definitions are hashed in PostgreSQL, never returned.
export function canonicalRowsQuery(query){
  return `SET search_path=pg_catalog;SELECT coalesce(json_agg(q),'[]'::json)::text AS result FROM (${query}) q;`;
}
export const catalogueSql=`WITH objects AS (
 SELECT 'relation' AS kind,c.relname::text AS name,concat_ws('|',c.relkind::text,c.relrowsecurity,c.relforcerowsecurity,c.reloptions::text) AS definition
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','v','m','p','f')
 UNION ALL SELECT 'relation_owner',c.relname,r.rolname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner
 WHERE n.nspname='public' AND c.relkind IN ('r','v','m','p','f')
 UNION ALL SELECT 'column',c.relname||'.'||a.attname,concat_ws('|',format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid),a.attidentity,a.attgenerated,a.attacl::text)
 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped
 UNION ALL SELECT 'constraint',c.relname||'.'||x.conname,pg_get_constraintdef(x.oid)||'|'||x.convalidated::text
 FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 UNION ALL SELECT 'index',c.relname,pg_get_indexdef(c.oid)||'|'||i.indisvalid::text||'|'||i.indisready::text
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_index i ON i.indexrelid=c.oid WHERE n.nspname='public'
 UNION ALL SELECT 'enum',t.typname,string_agg(e.enumlabel,'|' ORDER BY e.enumsortorder)
 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public' GROUP BY t.typname
 UNION ALL SELECT 'function',p.proname||'('||oidvectortypes(p.proargtypes)||')',concat_ws('|',pg_get_functiondef(p.oid),p.prosecdef,p.proconfig::text,p.proisstrict,p.proleakproof,p.proparallel,p.procost,p.prorows,l.lanname)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
 WHERE n.nspname='public' AND p.prokind IN ('f','p') AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
 UNION ALL SELECT 'function_owner',p.proname||'('||oidvectortypes(p.proargtypes)||')',r.rolname
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
 WHERE n.nspname='public' AND p.prokind IN ('f','p') AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
 UNION ALL SELECT 'trigger',c.relname||'.'||t.tgname,pg_get_triggerdef(t.oid)||'|'||t.tgenabled::text
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
 UNION ALL SELECT 'policy',c.relname||'.'||p.polname,concat_ws('|',p.polcmd,p.polpermissive,
 (SELECT string_agg(coalesce(r.rolname,'PUBLIC'),',' ORDER BY coalesce(r.rolname,'PUBLIC')) FROM unnest(p.polroles) o LEFT JOIN pg_roles r ON r.oid=o),pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid))
 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 UNION ALL SELECT 'view',c.relname,pg_get_viewdef(c.oid,true) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('v','m')
 UNION ALL SELECT 'table_access',c.relname||'.'||r.rolname,concat_ws('|',has_schema_privilege(r.oid,n.oid,'USAGE'),
 has_table_privilege(r.oid,c.oid,'SELECT'),has_table_privilege(r.oid,c.oid,'INSERT'),has_table_privilege(r.oid,c.oid,'UPDATE'),has_table_privilege(r.oid,c.oid,'DELETE'),has_table_privilege(r.oid,c.oid,'TRUNCATE'),has_table_privilege(r.oid,c.oid,'REFERENCES'),has_table_privilege(r.oid,c.oid,'TRIGGER'))
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r WHERE n.nspname='public' AND c.relkind IN ('r','v') AND r.rolname IN ('anon','authenticated','service_role')
 UNION ALL SELECT 'function_access',p.proname||'('||oidvectortypes(p.proargtypes)||').' ||r.rolname,has_function_privilege(r.oid,p.oid,'EXECUTE')::text
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN pg_roles r WHERE n.nspname='public' AND r.rolname IN ('anon','authenticated','service_role')
 AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
) SELECT kind,name,md5(definition) AS hash FROM objects ORDER BY kind,name`;

export function differences(expected,actual){
  const key=o=>`${o.kind}:${o.name}`;
  const a=new Map(actual.map(o=>[key(o),o])),e=new Map(expected.map(o=>[key(o),o]));
  if(a.size!==actual.length||e.size!==expected.length)throw new Error('DUPLICATE_CATALOGUE_KEY');
  return {missing:expected.filter(o=>!a.has(key(o))),changed:expected.filter(o=>a.has(key(o))&&a.get(key(o)).hash!==o.hash)
    .map(o=>({...o,actualHash:a.get(key(o)).hash})),extra:actual.filter(o=>!e.has(key(o)))};
}

// A failed Docker acknowledgment may still have created the container. Always
// inspect its exact random name; never stop an unowned target or prune the host.
export async function cleanupReference({docker,name,label,nonce}){
  try{
    if(!await docker(['ps','-aq','--filter',`name=^/${name}$`]))return true;
    if(await docker(['inspect','--format',`{{index .Config.Labels "${label}"}}`,name])!==nonce)return false;
    await docker(['stop','--time','5',name]);
    return !await docker(['ps','-aq','--filter',`name=^/${name}$`]);
  }catch{return false;}
}
