import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { differences,catalogueSql,cleanupReference,canonicalRowsQuery } from './schema-catalogue.mjs';
import { PGlite } from '@electric-sql/pglite';
const object=(kind,name,hash='a'.repeat(32))=>({kind,name,hash});
test('catalogue differences distinguish missing, changed, extra and unchanged',()=>{
  const expected=[object('column','orders.total_amount'),object('function','set_updated_at()'),object('enum','order_source')];
  const actual=[object('column','orders.total_amount','b'.repeat(32)),object('enum','order_source'),object('trigger','orders.extra')];
  const d=differences(expected,actual);
  assert.deepEqual(d.missing,[expected[1]]);assert.equal(d.changed[0].actualHash,'b'.repeat(32));assert.deepEqual(d.extra,[actual[2]]);
  assert.deepEqual(differences(expected,expected),{missing:[],changed:[],extra:[]});
});
test('duplicate catalogue identities fail rather than hide an overload/object',()=>{
  const a=object('function','check(uuid)');assert.throws(()=>differences([a,a],[a]),/DUPLICATE/);
  assert.throws(()=>differences([a],[a,a]),/DUPLICATE/);
  assert.equal(differences([a],[object('function','check(text)')]).missing.length,1);
});
test('system-only query hashes definitions and includes precision, RLS, security and effective privileges',()=>{
  // PostgreSQL UNION can retain its first NAME type, truncating compound keys
  // to 63 bytes and collapsing distinct constraint/RPC identities.
  assert.match(catalogueSql,/c\.relname::text AS name/);
  assert.match(catalogueSql,/md5\(definition\)/);assert.match(catalogueSql,/format_type\(a.atttypid,a.atttypmod\)/);
  for(const property of ['convalidated','indisvalid','indisready','relrowsecurity','relforcerowsecurity','relation_owner','attacl','pg_get_functiondef','proisstrict','proleakproof','proparallel','prosecdef','proconfig','polwithcheck','has_function_privilege','has_table_privilege'])assert.ok(catalogueSql.includes(property));
  assert.ok(!/FROM public\./i.test(catalogueSql));assert.ok(!/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s+(TABLE|FUNCTION|SCHEMA|ROLE|INTO|FROM)\b/i.test(catalogueSql));
});
test('protected runner isolates reference and forces read-only source before catalogue/safety queries',async()=>{
  const runner=await readFile(new URL('./schema-compatibility.mjs',import.meta.url),'utf8');
  const source=runner.slice(runner.indexOf("report.step='readonly_source'"),runner.indexOf('}catch(error)'));
  assert.match(source,/default_transaction_read_only=on/);assert.match(source,/BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/);
  assert.match(source,/identity.readonly!=='on'/);assert.match(source,/if\(identity.history\)/);
  assert.ok(!/source\.query\([^\n]*(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)/.test(source));
  assert.match(source,/ROLLBACK/);assert.match(runner,/--reference-only/);assert.match(runner,/--network','none','--log-driver','none'/);
  assert.match(runner,/parseRows\(await sql\(canonicalRowsQuery\(query\)\)\)/);
  assert.match(source,/SET LOCAL search_path=pg_catalog/);
  assert.match(runner,/candidateChecksumsVerified:true/);assert.match(runner,/cleanupReference\(\{docker,name,label,nonce\}\)/);
  assert.match(runner,/perFileTransaction:true/);assert.equal((runner.match(/await sql\('BEGIN;\\n'\+content.get\(file\)\+'\\nCOMMIT;'\)/g)??[]).length,2);
  assert.ok(!runner.includes('console.error'));assert.match(runner,/customer_indexes\.map/);
});
test('PowerShell CheckSchema uses the existing private pipe without creating an archive key',async()=>{
  const ps=await readFile(new URL('../run-shopify-private-backup.ps1',import.meta.url),'utf8');
  assert.match(ps,/if\(\$Mode -in @\('CheckSchema','CheckPostMigration'\)\).*schema-compatibility.mjs/);
  assert.match(ps,/if\(\$Mode -eq 'BackupAndVerify'\)/);assert.match(ps,/CreateNoWindow=\$true/);
  assert.match(ps,/StandardInput.Write/);assert.match(ps,/if\(\$Mode -in @\('BackupAndVerify','VerifyExisting'\)/);
});
test('lost Docker creation acknowledgement still cleans exact owned resource, never foreign resource',async()=>{
  const calls=[];let exists=true;
  const docker=async args=>{calls.push(args);if(args[0]==='ps')return exists?'id':'';
    if(args[0]==='inspect')return 'owner';if(args[0]==='stop'){exists=false;return '';}throw new Error('UNEXPECTED');};
  assert.equal(await cleanupReference({docker,name:'exact-reference',label:'owner.label',nonce:'owner'}),true);
  assert.ok(calls.some(a=>a[0]==='stop'));assert.equal(exists,false);
  const foreignCalls=[];
  const foreign=async args=>{foreignCalls.push(args);return args[0]==='ps'?'id':'foreign';};
  assert.equal(await cleanupReference({docker:foreign,name:'exact-reference',label:'owner.label',nonce:'owner'}),false);
  assert.ok(!foreignCalls.some(a=>a[0]==='stop'));
  assert.equal(await cleanupReference({docker:async()=>'',name:'absent',label:'owner.label',nonce:'owner'}),true);
  assert.equal(await cleanupReference({docker:async()=>{throw new Error('Unavailable');},name:'unknown',label:'owner.label',nonce:'owner'}),false);
});
test('catalogue deparsing is stable across caller search paths with a shadowed UUID function',async()=>{
  const db=new PGlite();try{
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
      CREATE FUNCTION public.gen_random_uuid() RETURNS uuid LANGUAGE sql AS 'SELECT pg_catalog.gen_random_uuid()';
      CREATE TABLE public.fixture(id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),amount numeric(12,2));`);
    const read=async path=>{const results=await db.exec(`SET search_path=${path};`+canonicalRowsQuery(catalogueSql));return JSON.parse(results.at(-1).rows[0].result);};
    assert.deepEqual(await read('public,pg_catalog'),await read('pg_catalog,public'));
    assert.equal(differences(await read('public,pg_catalog'),await read('pg_catalog,public')).changed.length,0);
    const raw=async path=>{await db.exec(`SET search_path=${path}`);return (await db.query(catalogueSql)).rows.find(o=>o.kind==='column'&&o.name==='fixture.id').hash;};
    assert.notEqual(await raw('public,pg_catalog'),await raw('pg_catalog,public'));
  }finally{await db.close();}
});
