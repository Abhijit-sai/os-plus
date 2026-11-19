import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {normalizeCustomerPhone} from '../src/features/customers/phone.ts';
const require=createRequire(import.meta.url),ts=require('typescript');
const source=readFileSync(new URL('../src/features/customers/actions.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const target={id:'existing-customer',tenant_id:'tenant-a',name:'Existing buyer',phone:'+919876543210',normalized_phone_e164:'+919876543210',deleted_at:null};
function actions({rows=[],race=false,role='manager'}={}){
  let writes=0,reads=0;
  const client={from(table){assert.equal(table,'customers');let filters=[],insert=false;
    const q={select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},is(k,v){filters.push(r=>r[k]===v);return q;},
      not(k,op,v){filters.push(r=>r[k]!==v);return q;},insert(){writes++;insert=true;return q;},
      async single(){if(insert&&race){rows.push(target);return {data:null,error:{code:'23505',message:'duplicate'}};}throw Error('unexpected insert');},
      async maybeSingle(){reads++;return {data:rows.filter(r=>filters.every(f=>f(r)))[0]??null,error:null};},
      then(resolve,reject){reads++;return Promise.resolve({data:rows.filter(r=>filters.every(f=>f(r))).slice(0,1000),error:null}).then(resolve,reject);}};return q;}};
  const mod={exports:{}};
  vm.runInNewContext(code,{module:mod,exports:mod.exports,FormData,
    require(id){
      if(id==='next/cache')return {revalidatePath(){}};
      if(id==='next/navigation')return {redirect(){throw Error('unexpected redirect');}};
      if(id==='zod')return require('zod');
      if(id.endsWith('/roles'))return {assertPermission(value){if(!['owner_admin','manager'].includes(value))throw Error('ACCESS_DENIED');}};
      if(id.endsWith('/server'))return {createSupabaseServiceRoleClient:()=>client};
      if(id.endsWith('/context'))return {requireTenantContext:async()=>({tenant:{id:'tenant-a'},membership:{role,clerk_user_id:'staff'}})};
      if(id.endsWith('/phone'))return {normalizeCustomerPhone};
      throw Error(`Unexpected import ${id}`);
    }});
  const form=new FormData();for(const [k,v] of Object.entries({name:'Buyer',phone:'9876543210',email:'',gender:'',address:'',notes:''}))form.set(k,v);
  return {run:()=>mod.exports.createCustomerInlineAction(form),stats:()=>({reads,writes})};
}
test('canonical customer lookup reaches a match beyond the directory API row cap',async()=>{
  const rows=Array.from({length:1100},(_,i)=>({...target,id:`other-${i}`,normalized_phone_e164:`+91900000${String(i).padStart(4,'0')}`,phone:null}));
  rows.push(target);const a=actions({rows});const result=await a.run();
  assert.equal(result.customer.id,target.id);assert.equal(result.wasExisting,true);assert.equal(a.stats().writes,0);
});
test('concurrent customer creation recovers the unique-phone winner',async()=>{
  const a=actions({race:true});const result=await a.run();
  assert.equal(result.customer.id,target.id);assert.equal(result.wasExisting,true);assert.equal(a.stats().writes,1);
});
test('foreign and archived customer matches are never reused',async()=>{
  for(const row of [{...target,tenant_id:'tenant-b'},{...target,deleted_at:'2026-01-01'}]){
    const a=actions({rows:[row]});await assert.rejects(a.run(),/unexpected insert/);assert.equal(a.stats().writes,1);
  }
});
test('a non-managing role is rejected before customer reads or writes',async()=>{
  const a=actions({role:'viewer'});await assert.rejects(a.run(),/ACCESS_DENIED/);assert.deepEqual(a.stats(),{reads:0,writes:0});
});
