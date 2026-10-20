// Explicit local-only fixture verification: never reads access files/env secrets.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp,rm,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { encryptStream,decryptStream,authenticateArchive } from './private-backup-crypto.mjs';
import { image,label,archiveHeader } from './private-backup-contract.mjs';
import { rolesSql,membershipSql,defaultsSql,schemaAclSql,membershipCommands,globalDefaultCommands,schemaAclCommands } from './private-backup-permissions.mjs';
import { rowsQuery,parseRows } from './private-backup-rows.mjs';
const nonce=randomBytes(16).toString('hex'),key=randomBytes(32),aad=archiveHeader(nonce);
const names=[`osplus-private-fixture-source-${nonce}`,`osplus-private-fixture-target-${nonce}`];
const bootstrap='fictional_bootstrap';
const root=fileURLToPath(new URL('../..',import.meta.url));
const dir=await mkdtemp(path.join(tmpdir(),'osplus-fictional-docker-backup-'));
let failed=false,phase='start';
function spawnDocker(args,input){
  const child=spawn('docker',['--config',root,...args],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe']});
  let out='',err='';child.stderr.on('data',v=>{err+=v;if(err.length>100000)child.kill();});
  const timer=setTimeout(()=>child.kill(),30000);
  const done=new Promise((resolve,reject)=>{child.once('error',()=>reject(new Error('FIXTURE_CHILD_FAILED')));child.once('close',c=>{clearTimeout(timer);c===0?resolve(out):reject(new Error('FIXTURE_CHILD_FAILED: '+err.slice(0,3000)));});});
  done.catch(()=>{});
  if(input!==undefined){child.stdout.on('data',v=>{out+=v;});child.stdin.end(input);}
  return {child,done};
}
async function docker(args,input=''){return spawnDocker(args,input).done;}
const sql=(name,text)=>docker(['exec','-i',name,'psql','-X','--no-password','--set','ON_ERROR_STOP=1','-At','-U',bootstrap,'-d','postgres'],text);
const rows=async(name,query)=>parseRows(await sql(name,rowsQuery(query)));
try{
  for(const name of names){
    await docker(['run','--rm','--pull','never','-d','--name',name,'--label',`${label}=${nonce}`,'--network','none',
      '--log-driver','none','--memory','512m','--tmpfs','/var/lib/postgresql/data:rw,size=268435456','--security-opt','no-new-privileges',
      '-e',`POSTGRES_USER=${bootstrap}`,'-e','POSTGRES_DB=postgres','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','PGDATA=/var/lib/postgresql/data/pgdata',image]);
    let ready=false;for(let n=0;n<40;n++){try{await docker(['exec',name,'pg_isready','-U',bootstrap,'-d','postgres']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,250));}}
    assert.ok(ready);
  }
  phase='fictional_schema';
  await sql(names[0],`CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    CREATE FUNCTION public.fixture_random() RETURNS int LANGUAGE plpgsql AS $$BEGIN RETURN octet_length(extensions.gen_random_bytes(2));END;$$;
    CREATE ROLE fictional_worker NOLOGIN; CREATE ROLE fictional_group NOLOGIN;
    GRANT fictional_group TO fictional_worker WITH INHERIT TRUE;
    ALTER DEFAULT PRIVILEGES FOR ROLE fictional_bootstrap IN SCHEMA public GRANT SELECT ON TABLES TO fictional_group;
    ALTER DEFAULT PRIVILEGES FOR ROLE fictional_bootstrap GRANT USAGE ON TYPES TO fictional_group;
    CREATE TYPE public.fixture_state AS ENUM('new','done');
    CREATE TABLE public.fixture(id int PRIMARY KEY,value text NOT NULL,state public.fixture_state NOT NULL DEFAULT 'new');
    INSERT INTO public.fixture VALUES(1,'FICTIONAL only','done'),(2,'No private data','new');
    ALTER TABLE public.fixture ENABLE ROW LEVEL SECURITY; GRANT SELECT ON public.fixture TO fictional_group; GRANT USAGE ON SCHEMA public TO fictional_group;
    CREATE POLICY fixture_policy ON public.fixture FOR SELECT TO fictional_group USING(id=1);
    CREATE FUNCTION public.fixture_count() RETURNS bigint LANGUAGE sql AS 'SELECT count(*) FROM public.fixture';`);
  phase='real_catalogue_query';
  const runner=await readFile(new URL('./private-backup.mjs',import.meta.url),'utf8');
  const catalogue=runner.match(/const catalogueSql=`([\s\S]*?)`;/)[1];
  const sourceCatalogue=await rows(names[0],catalogue);
  const sourceMemberships=await rows(names[0],membershipSql(170000));
  const sourceDefaults=await rows(names[0],defaultsSql);
  const sourceSchemaAcl=await rows(names[0],schemaAclSql);
  phase='export';
  const dump=spawnDocker(['exec',names[0],'pg_dump','--format=custom','--schema=public','--no-password','-U',bootstrap,'-d','postgres']);
  dump.child.stdin.end();
  const file=path.join(dir,'fictional.aesgcm');
  await Promise.all([encryptStream(dump.child.stdout,file,aad,key),dump.done]);
  assert.ok(await authenticateArchive(file,aad,key)>0);
  assert.ok(!(await readFile(file)).includes(Buffer.from('FICTIONAL only')));
  phase='restore';
  await sql(names[1],'CREATE ROLE fictional_worker NOLOGIN; CREATE ROLE fictional_group NOLOGIN; DROP SCHEMA public CASCADE;');
  await sql(names[1],'CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;');
  for(const membership of sourceMemberships)await sql(names[1],membershipCommands(membership));
  const restore=spawnDocker(['exec','-i',names[1],'pg_restore','--exit-on-error','--no-password','-U',bootstrap,'-d','postgres']);
  restore.child.stdout.resume();
  const decrypted=await decryptStream(file,aad,key);
  await Promise.all([pipeline(decrypted.input,decrypted.decipher,restore.child.stdin),restore.done]);
  phase='verify';
  await sql(names[1],globalDefaultCommands(sourceDefaults)+schemaAclCommands(sourceSchemaAcl,await rows(names[1],schemaAclSql)));
  assert.deepEqual(await rows(names[1],membershipSql(170000)),sourceMemberships);
  assert.deepEqual(await rows(names[1],defaultsSql),sourceDefaults);
  assert.deepEqual(await rows(names[1],schemaAclSql),sourceSchemaAcl);
  assert.deepEqual(await rows(names[1],catalogue),sourceCatalogue);
  assert.equal((await sql(names[1],'SELECT public.fixture_count();')).trim(),'2');
  assert.equal((await sql(names[1],'SELECT public.fixture_random();')).trim(),'2');
  for(const name of names)assert.equal((await docker(['inspect','--format','{{.HostConfig.LogConfig.Type}}',name])).trim(),'none');
  assert.match(await sql(names[1],'SET ROLE fictional_worker; SELECT count(*) FROM public.fixture;'),/\n1\s*$/);
  assert.equal((await sql(names[1],`SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='fixture';`)).trim(),'1');
  console.log('PASS actual custom dump -> authenticated encrypted file -> disconnected restore; rows/function/RLS/grants/membership/default privileges/catalogue verified with fictional fixtures');
}catch(error){failed=true;console.error(`FAIL isolated fictional backup verification (${phase}): ${error.message}`);}
finally{
  for(const name of names){try{
    if(!(await docker(['ps','-aq','--filter',`name=^/${name}$`])).trim())continue;
    assert.equal((await docker(['inspect','--format',`{{index .Config.Labels "${label}"}}`,name])).trim(),nonce);
    await docker(['stop','--time','5',name]);
    assert.equal((await docker(['ps','-aq','--filter',`name=^/${name}$`])).trim(),'');
  }catch{failed=true;console.error(`Cleanup unresolved: ${name}`);}}
  // This exact mkdtemp directory contains fictional ciphertext only.
  await rm(dir,{recursive:true,force:true});
  if(!failed)console.log('PASS owned fixture containers and fictional temporary archive removed');
  process.exitCode=failed?1:0;
}
