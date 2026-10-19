import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {canonicalBackupCatalogue,equivalentDefinitions} from './shopify-db-harness/backup-catalogue-equivalence.mjs';
const md5=v=>createHash('md5').update(v).digest('hex');
test('exact observed constraint and owner-only ACL representations are equivalent',()=>{
  const rawA=equivalentDefinitions.map(x=>({kind:x.kind,name:x.name,hash:md5(x.variants[0])}));
  const rawB=equivalentDefinitions.map(x=>({kind:x.kind,name:x.name,hash:md5(x.variants[1])}));
  assert.notDeepEqual(rawA,rawB);assert.deepEqual(canonicalBackupCatalogue(rawA),canonicalBackupCatalogue(rawB));
  assert.deepEqual(rawA.map(x=>x.hash),['5ae7ecbb641b727586453158c9984781','04968b908074a64abc952fcc9c3efe6e','5c7161029ce2539ef52a0dea9b5debf1']);
  assert.deepEqual(rawB.map(x=>x.hash),['33ef2491ade7d42614bec680a4e7b6b6','97328ca4c7549d382acc2ba0156aa792','3e8e091366e4ec60e8db98ff0a685859']);
});
test('SQL three-valued AND associativity preserves CHECK success and failure',()=>{
  const and=(a,b)=>a===false||b===false?false:a===null||b===null?null:true;
  for(const a of [true,false,null])for(const b of [true,false,null])for(const c of [true,false,null])assert.equal(and(and(a,b),c),and(a,and(b,c)));
});
test('different rights, owner, RLS, limits, OR, or object name are not excused',()=>{
  for(const x of equivalentDefinitions){
    for(const text of [x.variants[0]+' ',x.variants[0].replaceAll('AND','OR'),x.variants[0].replaceAll('256','255'),
      't|f|postgres|{postgres=arwdDxtm/postgres,anon=r/postgres}','f|f|postgres','t|f|foreign']){
      if(x.variants.includes(text))continue;
      const row={kind:x.kind,name:x.name,hash:md5(text)};assert.deepEqual(canonicalBackupCatalogue([row]),[row]);
    }
    const row={kind:x.kind,name:'another_object',hash:md5(x.variants[1])};assert.deepEqual(canonicalBackupCatalogue([row]),[row]);
  }
});
