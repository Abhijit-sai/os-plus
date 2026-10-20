// Compile/exercise the rehearsal with fictional-only data before private access.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile,readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { rehearseShopify,projectedDigest } from './private-rehearsal.mjs';
import { rowsQuery,parseRows } from './private-backup-rows.mjs';
import { image } from './private-backup-contract.mjs';
import { cleanupReference } from './schema-catalogue.mjs';
const root=fileURLToPath(new URL('../..',import.meta.url)),nonce=randomBytes(16).toString('hex');
const name=`osplus-rehearsal-fictional-${nonce}`,label='osplus.rehearsal.fictional',bootstrap='fictional_bootstrap';
if(process.argv.slice(2).some(a=>a!=='--scenarios-only'))throw new Error('FICTIONAL_ARGUMENT_INVALID');
let attempted=false,failed=false;
function docker(args,input=''){
  return new Promise((resolve,reject)=>{
    const child=spawn('C:/Program Files/Docker/Docker/resources/bin/docker.exe',['--config',root,...args],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe']});
    let out='',err='';const timer=setTimeout(()=>child.kill(),60000);
    child.stdout.on('data',c=>{out+=c;if(out.length>2000000)child.kill();});child.stderr.on('data',c=>{err+=c;if(err.length>262144)child.kill();});
    child.stdin.on('error',()=>{});child.stdin.end(input);child.once('error',()=>reject(new Error('FICTIONAL_COMMAND_FAILED')));
    child.once('close',code=>{clearTimeout(timer);code===0?resolve(out.trim()):reject(new Error('FICTIONAL_COMMAND_FAILED: '+err.slice(0,1500)));});
  });
}
const exec=text=>docker(['exec','-i',name,'psql','-X','-v','ON_ERROR_STOP=1','-At','-U',bootstrap,'-d','postgres'],text);
const rows=async query=>parseRows(await exec(rowsQuery(query)));
try{
  attempted=true;
  await docker(['run','--rm','--pull','never','-d','--name',name,'--label',`${label}=${nonce}`,'--network','none','--log-driver','none',
    '--memory','1g','--tmpfs','/var/lib/postgresql/data:rw,size=536870912','--security-opt','no-new-privileges','-e',`POSTGRES_USER=${bootstrap}`,'-e','POSTGRES_DB=postgres','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','PGDATA=/var/lib/postgresql/data/pgdata',image]);
  let ready=false;for(let i=0;i<40;i++){try{await docker(['exec',name,'bash','-ec',`test "$(cat /proc/1/comm)" = postgres && pg_isready -U ${bootstrap} -d postgres`]);ready=true;break;}catch{await new Promise(r=>setTimeout(r,250));}}
  if(!ready)throw new Error('FICTIONAL_NOT_READY');
  await exec(`CREATE ROLE postgres NOSUPERUSER CREATEDB CREATEROLE BYPASSRLS;ALTER DATABASE postgres OWNER TO postgres;
    CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
    GRANT USAGE ON SCHEMA storage TO postgres;GRANT ALL ON storage.buckets TO postgres;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
    GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;`);
  const folder=new URL('../../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(folder)).filter(f=>f.endsWith('.sql')&&!f.includes('_shopify_')).sort())await exec('BEGIN;SET LOCAL ROLE postgres;\n'+await readFile(new URL(file,folder),'utf8')+'\nCOMMIT;');
  // Deliberately unguarded fictional extra module, not copied production code.
  await exec(`CREATE TABLE public.order_handovers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES public.tenants(id),order_id uuid NOT NULL REFERENCES public.orders(id),
    handover_number text NOT NULL,handover_type public.delivery_type NOT NULL,handed_over_at timestamptz NOT NULL,balance_acknowledged boolean NOT NULL,recipient_name text);
    ALTER TABLE public.order_handovers OWNER TO postgres;
    ALTER TABLE public.order_handovers ENABLE ROW LEVEL SECURITY;GRANT ALL ON public.order_handovers TO service_role;
    CREATE TABLE public.order_handover_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,order_id uuid NOT NULL,
      handover_id uuid NOT NULL REFERENCES public.order_handovers(id),order_item_id uuid NOT NULL REFERENCES public.order_items(id),quantity numeric NOT NULL,pre_handover_item_status public.item_status);
    ALTER TABLE public.order_handover_items OWNER TO postgres;
    ALTER TABLE public.order_handover_items ENABLE ROW LEVEL SECURITY;GRANT ALL ON public.order_handover_items TO service_role;`);
  const tables=await rows("SELECT c.relname::text AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname");
  const integrity=[];for(const table of tables){const columns=(await rows(`SELECT attname::text AS name FROM pg_attribute WHERE attrelid='public.${table.name}'::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum`)).map(c=>c.name);
    integrity.push({name:table.name,...(await rows(projectedDigest(table.name,columns)))[0]});}
  if(!process.argv.includes('--scenarios-only')){
  await exec(`ALTER DATABASE postgres OWNER TO ${bootstrap};`);
  const wrongOwner=await rehearseShopify({exec,rows,metadata:{tables,integrity},signal:AbortSignal.timeout(300000)});
  if(wrongOwner.migrations.length!==1||wrongOwner.migrations[0].status!=='outcome_unknown_stopped'||wrongOwner.legacyTablesPreserved!==tables.length)throw new Error('FICTIONAL_OWNERSHIP_REGRESSION_NOT_REPRODUCED');
  if((await rows("SELECT to_regclass('public.shopify_connections') IS NULL AS absent"))[0].absent!==true)throw new Error('FICTIONAL_FIRST_FILE_NOT_ROLLED_BACK');
  console.log('PASS fictional non-bootstrap migration actor: wrong clone database owner reproduces first-file failure with all legacy data unchanged');
  await exec('ALTER DATABASE postgres OWNER TO postgres;');
  }
  const result=await rehearseShopify({exec,rows,metadata:{tables,integrity},signal:AbortSignal.timeout(300000)});
  console.log(JSON.stringify({fictionalOnly:true,...result},null,2));
  const expectedBlockers=[];
  if(result.migrations.length!==12||result.scenarios.length!==52||result.passed!==52||result.failed!==0
    ||JSON.stringify([...result.blockers].sort())!==JSON.stringify(expectedBlockers)
    ||!result.legacyDataPreservedAfterScenarios||!result.legacySecurityPreserved
    ||result.legacySchema.missing.length||result.legacySchema.unexpectedChanges.length
    ||result.scenarios.some(s=>s.reason==='SCENARIO_SETUP_OR_EXECUTION_FAILED'))failed=true;
}catch(error){failed=true;console.error(error.message);}
finally{
  const clean=!attempted||await cleanupReference({docker,name,label,nonce});if(!clean)failed=true;
  console.log(JSON.stringify({fictionalCleanupComplete:clean}));if(failed)process.exitCode=1;
}
