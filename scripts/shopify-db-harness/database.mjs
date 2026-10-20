import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

// Default remains memory-only. Real PostgreSQL can only be selected by the
// owned Docker orchestrator, on loopback, with a matching random DB comment.
export async function testDatabase(suffix) {
  if (!process.env.OSPLUS_SHOPIFY_DISPOSABLE_NONCE) return new PGlite();
  const { Client, types } = await import('pg');
  const nonce=process.env.OSPLUS_SHOPIFY_DISPOSABLE_NONCE;
  assert.match(nonce,/^[a-f0-9]{24}$/);
  assert.ok(['intake','worker','draft'].includes(suffix));
  const database=`shopify_${suffix}_${nonce}`;
  const port=Number(process.env.OSPLUS_SHOPIFY_DISPOSABLE_PORT);
  assert.ok(Number.isInteger(port)&&port>=1024&&port<=65535);
  assert.match(process.env.OSPLUS_SHOPIFY_DISPOSABLE_PASSWORD??'',/^[a-f0-9]{48}$/);
  const client=new Client({host:'127.0.0.1',port,user:'postgres',password:process.env.OSPLUS_SHOPIFY_DISPOSABLE_PASSWORD,
    database,ssl:false,connectionTimeoutMillis:5000,statement_timeout:10000,lock_timeout:3000,
    types:{getTypeParser(oid,format){if(oid===20)return value=>{const n=Number(value);assert.ok(Number.isSafeInteger(n));return n;};return types.getTypeParser(oid,format);}}});
  await client.connect();
  const marker=await client.query("select shobj_description(oid,'pg_database') as marker from pg_database where datname=current_database()");
  assert.equal(marker.rows[0]?.marker,`osplus-shopify-disposable:${nonce}`);
  const roles=await client.query("select rolname,rolsuper,rolbypassrls from pg_roles where rolname in ('anon','authenticated','service_role') order by rolname");
  assert.deepEqual(roles.rows.map(row=>[row.rolname,row.rolsuper,row.rolbypassrls]),[['anon',false,false],['authenticated',false,false],['service_role',false,true]]);
  // These historical suites intentionally use one session. Explicitly queue
  // their calls rather than relying on pg's deprecated concurrent-query queue.
  let pending=Promise.resolve();
  function query(...args){const result=pending.then(()=>client.query(...args));pending=result.catch(()=>{});return result;}
  return {query,async exec(sql){
    // Shared cluster roles were created by the owned orchestrator. Do not
    // rewrite migrations or SQL assertions; only skip this exact fixture setup.
    if(sql==='create role anon; create role authenticated; create role service_role bypassrls;')return;
    return query(sql);
  },async close(){await pending;await client.end();}};
}
