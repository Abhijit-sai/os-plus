"""Exact candidate atomic-failure and pre/post restore rehearsal. Fresh owned PG only."""
import base64,datetime,gzip,hashlib,json,pathlib,secrets,subprocess,time
PAYLOAD="__ATOMIC_PAYLOAD__"
data=json.loads(gzip.decompress(base64.b64decode(PAYLOAD)))
nonce=secrets.token_hex(12)
name="osplus-atomic-qa-"+nonce
label="osplus.chat.atomic-release-qa"
image="postgres@sha256:747d5ed1fdeeb124b880fbe3d7c6557d2c4064ae41d6b6297d417882effce4be"
report={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sharedWrites':False,'resource':name,'image':image,'checks':[],'cleanup':False,'status':'FAIL'}
created=False
def command(args,raw=None,check=True):
 p=subprocess.run(args,input=raw,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=60)
 if check and p.returncode:raise RuntimeError(next((x for x in p.stderr.decode(errors='replace').splitlines() if 'ERROR:' in x),'ATOMIC_COMMAND_FAILED')[:220])
 return p
def sql(text,database='qa',check=True):
 return command(['docker','exec','-i',name,'psql','-X','-U','postgres','-d',database,'-Atq','-v','ON_ERROR_STOP=1'],text.encode(),check)
def inventory(database):
 q="""SELECT json_build_object(
 'relations',(SELECT json_agg(x ORDER BY name) FROM (SELECT c.relname name,c.relkind,c.relrowsecurity,c.relforcerowsecurity,(SELECT array_agg(a::text ORDER BY a::text) FROM unnest(coalesce(c.relacl,acldefault((CASE WHEN c.relkind='S' THEN 'S' ELSE 'r' END)::"char",c.relowner))) a) acl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public') x),
 'constraints',(SELECT json_agg(x ORDER BY name,definition) FROM (SELECT conname name,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE connamespace='public'::regnamespace) x),
 'policies',(SELECT json_agg(x ORDER BY relation,name) FROM (SELECT c.relname relation,p.polname name,p.polcmd command,p.polpermissive permissive,p.polroles::regrole[]::text roles,pg_get_expr(p.polqual,p.polrelid) using_expression,pg_get_expr(p.polwithcheck,p.polrelid) check_expression FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace) x),
 'functions',(SELECT json_agg(x ORDER BY name,args) FROM (SELECT p.proname name,pg_get_function_identity_arguments(p.oid) args,p.prosrc body,p.proconfig config,p.prosecdef definer,(SELECT array_agg(a::text ORDER BY a::text) FROM unnest(coalesce(p.proacl,acldefault('f',p.proowner))) a) acl FROM pg_proc p WHERE p.pronamespace='public'::regnamespace) x),
 'tenantFixture',(SELECT json_agg(json_build_object('id',id,'name',name,'slug',slug)) FROM tenants WHERE slug='atomic-release-fixture'))::text;"""
 result=json.loads(sql(q,database).stdout)
 # Reparse each CHECK using PostgreSQL itself, just as logical restore does.
 # BETWEEN followed by AND otherwise changes harmless BoolExpr grouping on dump/restore.
 checks=json.loads(sql("SELECT coalesce(json_agg(json_build_object('name',c.conname,'table',r.relname,'definition',pg_get_constraintdef(c.oid))),'[]'::json) FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid WHERE c.connamespace='public'::regnamespace AND c.contype='c';",database).stdout)
 batch=[]
 for item in checks:
  table=item['table'];constraint=item['name']
  if not all(__import__('re').fullmatch('[a-z_][a-z0-9_]*',x) for x in [table,constraint]):raise RuntimeError('CHECK_IDENTIFIER_REFUSED')
  batch.append('CREATE TEMP TABLE qa_check_shape (LIKE public."'+table+'"); ALTER TABLE qa_check_shape ADD CONSTRAINT qa_check '+item['definition']+"; SELECT json_build_object('name','"+constraint+"','definition',pg_get_constraintdef(oid))::text FROM pg_constraint WHERE conrelid='pg_temp.qa_check_shape'::regclass AND conname='qa_check'; DROP TABLE qa_check_shape;")
 normalized=[json.loads(line) for line in sql('\n'.join(batch),database).stdout.decode().splitlines() if line.startswith('{')]
 if len({x['name'] for x in checks})!=len(checks):raise RuntimeError('CHECK_NAME_AMBIGUOUS')
 definitions={x['name']:x['definition'] for x in normalized}
 for item in result['constraints']:
  if item['name'] in definitions:item['definition']=definitions[item['name']]
 return result
def restore(raw,target):
 command(['docker','exec',name,'createdb','-U','postgres',target])
 command(['docker','exec','-i',name,'pg_restore','--exit-on-error','--no-owner','-U','postgres','-d',target],raw)
def passed(name):report['checks'].append(name)
try:
 available=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))//1024
 if available<1200:raise RuntimeError('INSUFFICIENT_HEADROOM')
 assert '@sha256:' in image and len(data['baseline'])==71
 candidate=base64.b64decode(data['candidate'])
 assert hashlib.sha256(candidate).hexdigest()==data['packageSha256']
 report['packageSha256']=data['packageSha256']
 assert candidate.count(b'\nBEGIN;\n')==1 and candidate.count(b'\nCOMMIT;\n')==1
 command(['docker','run','-d','--pull=never','--name',name,'--label',label+'='+nonce,'--network','none','--log-driver','none','--memory','512m','--memory-swap','512m','--cpus','1','--tmpfs','/var/lib/postgresql/data:rw,size=536870912','--security-opt','no-new-privileges','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','PGDATA=/var/lib/postgresql/data/pgdata',image])
 created=True
 for _ in range(60):
  if command(['docker','exec',name,'pg_isready','-h','127.0.0.1','-U','postgres'],check=False).returncode==0:break
  time.sleep(.25)
 else:raise RuntimeError('DATABASE_START_TIMEOUT')
 command(['docker','exec',name,'createdb','-U','postgres','qa'])
 sql("""CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;
 GRANT USAGE ON SCHEMA public,extensions TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon,authenticated,service_role;
 CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text primary key,name text not null,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);""")
 for item in data['baseline']:
  raw=base64.b64decode(item['sql']);assert hashlib.sha256(raw).hexdigest()==item['sha256']
  if item['name']=='20261014131000_shopify_handover_guards.sql':sql("""CREATE TABLE order_handovers(id uuid primary key default gen_random_uuid(),
                  tenant_id uuid not null references tenants(id),order_id uuid not null references orders(id),
                  handover_number text not null,handover_type delivery_type not null,handed_over_at timestamptz not null,
                  balance_acknowledged boolean not null,recipient_name text,status text not null default 'active',
                  internal_notes text,deleted_at timestamptz);
                  CREATE TABLE order_handover_items(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,
                    order_id uuid not null,handover_id uuid not null references order_handovers(id),
                    order_item_id uuid not null references order_items(id),quantity numeric not null default 1,
                    pre_handover_item_status item_status,deleted_at timestamptz);
                  ALTER TABLE order_handovers ENABLE ROW LEVEL SECURITY;
                  ALTER TABLE order_handover_items ENABLE ROW LEVEL SECURITY;
                  GRANT ALL ON order_handovers,order_handover_items TO service_role;""")
  sql(raw.decode())
 sql("INSERT INTO tenants(id,name,store_name,slug) VALUES('90000000-0000-4000-8000-000000000001','Atomic synthetic','Atomic synthetic','atomic-release-fixture');")
 before=inventory('qa');passed('Frozen71 baseline constructed with extensions pgcrypto and synthetic tenant')
 dump=command(['docker','exec',name,'pg_dump','-U','postgres','-d','qa','-Fc']).stdout
 restore(dump,'qa_before');restored=inventory('qa_before')
 if restored!=before:
  report['relationAclDifference']=[{'name':x['name'],'before':x.get('acl'),'restored':[y.get('acl') for y in restored['relations'] if y['name']==x['name']]} for x in before['relations'] if x not in restored['relations']][:4]
  report['constraintTextDifference']=[{'name':x['name'],'before':x['definition'],'restored':[y['definition'] for y in restored['constraints'] if y['name']==x['name']]} for x in before['constraints'] if x not in restored['constraints']][:4]
  report['restoreDifference']={key:{'beforeCount':len(before[key] or []),'restoredCount':len(restored[key] or []),
    'beforeOnly':[(x.get('name'),x.get('args'),[k for k in x if not any(y.get(k)==x[k] and y.get('name')==x.get('name') for y in (restored[key] or []))]) for x in (before[key] or []) if x not in (restored[key] or [])][:4],
    'restoredOnlyNames':[x.get('name') for x in (restored[key] or []) if x not in (before[key] or [])][:4]}
    for key in before if before[key]!=restored[key]}
  raise RuntimeError('BASELINE_CATALOGUE_RESTORE_MISMATCH')
 passed('Pre-upgrade dump restored into fresh database with exact catalogue/tenant fixture')
 injected=candidate.decode().rsplit('COMMIT;',1)[0]+'SELECT 1/0;\nCOMMIT;\n'
 failure=sql(injected,check=False);assert failure.returncode!=0 and b'division by zero' in failure.stderr
 assert inventory('qa')==before;passed('Failure after all35 additions rolls back every schema change and preserves baseline fixture')
 sql(candidate.decode());after=inventory('qa')
 assert after['tenantFixture']==before['tenantFixture'];passed('Exact candidate applied once and pre-existing synthetic tenant preserved')
 assert len(after['relations'])>len(before['relations']);passed('Chat relations constructed in candidate upgrade')
 duplicate=sql(candidate.decode(),check=False);assert duplicate.returncode!=0 and b'CHAT_RELEASE_ALREADY_OR_PARTIALLY_APPLIED' in duplicate.stderr
 assert inventory('qa')==after;passed('Repeat application refuses before mutation and leaves upgraded catalogue unchanged')
 dump=command(['docker','exec',name,'pg_dump','-U','postgres','-d','qa','-Fc']).stdout
 restore(dump,'qa_after');assert inventory('qa_after')==after;passed('Post-upgrade dump restored into fresh database with exact catalogue/tenant fixture')
 report['status']='PASS'
except Exception as error:
 report['error']=str(error)[:220]
finally:
 if created:
  owner=command(['docker','inspect','--format','{{index .Config.Labels "'+label+'"}}',name]).stdout.decode().strip()
  if owner!=nonce:raise RuntimeError('CLEANUP_OWNERSHIP_REFUSED')
  command(['docker','rm','-f',name]);report['cleanup']=True
 print(json.dumps(report,indent=2))
raise SystemExit(0 if report['status']=='PASS' and report['cleanup'] else 1)
