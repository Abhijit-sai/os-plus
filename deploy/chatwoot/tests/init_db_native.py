#!/usr/bin/env python3
"""Explicit native PostgreSQL first-boot check; uses only fresh labelled synthetic resources."""
import argparse,json,os,secrets,shutil,subprocess,tempfile,time,uuid
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument("--image",required=True)
p.add_argument("--script",required=True)
p.add_argument("--run",action="store_true")
a=p.parse_args()
assert a.run and "@sha256:" in a.image,"Explicit run and pinned image required"
nonce="osplus-init-"+uuid.uuid4().hex[:12]
root=Path(tempfile.mkdtemp(prefix=nonce+"-"))
container=nonce+"-db"; volume=nonce+"-data"; network=nonce+"-net"
def cmd(args,check=True):
 return subprocess.run(args,text=True,capture_output=True,check=check,timeout=40)
def owned(kind,name):
 q=cmd(["docker",kind,"inspect",name],False)
 if q.returncode!=0: return False
 item=json.loads(q.stdout)[0]
 labels=(item.get("Config",{}).get("Labels",{}) if kind=="container" else item.get("Labels",{})) or {}
 return labels.get("osplus.test")==nonce
try:
 assert cmd(["docker","container","inspect",container],False).returncode!=0
 assert cmd(["docker","volume","inspect",volume],False).returncode!=0
 source=root/"init.sh";shutil.copy2(a.script,source)
 env=root/"fixture.env"
 env.write_text("POSTGRES_DB=n8n\nPOSTGRES_USER=postgres\nPOSTGRES_PASSWORD="+secrets.token_hex(32)+"\nN8N_DB_PASSWORD="+secrets.token_hex(32)+"\n")
 env.chmod(0o600)
 cmd(["docker","network","create","--internal","--label","osplus.test="+nonce,network])
 cmd(["docker","volume","create","--label","osplus.test="+nonce,volume])
 cmd(["docker","run","-d","--name",container,"--label","osplus.test="+nonce,
      "--network",network,"--memory","192m","--memory-swap","192m","--cpus","0.5",
      "--env-file",str(env),"-v",str(source)+":/docker-entrypoint-initdb.d/10-n8n.sh:ro",
      "-v",volume+":/var/lib/postgresql/data",a.image])
 app_password=dict(line.split("=",1) for line in env.read_text().splitlines())["N8N_DB_PASSWORD"]
 def login(password):
  client=root/"client.env";client.write_text("PGPASSWORD="+password+"\n");client.chmod(0o600)
  return cmd(["docker","run","--rm","--label","osplus.test="+nonce,"--network",network,"--memory","64m","--memory-swap","64m","--env-file",str(client),a.image,"psql","-h",container,"-U","n8n","-d","n8n","-Atc","SELECT current_user, current_database()"],False)
 good=None
 for _ in range(25):
  q=login(app_password)
  if q.returncode==0 and q.stdout.strip()=="n8n|n8n":
   good=q;break
  state=json.loads(cmd(["docker","container","inspect",container]).stdout)[0]["State"]["Status"]
  if state=="exited": break
  time.sleep(1)
 assert good is not None,"Application role cannot authenticate after native fresh PostgreSQL initialization"
 flags=cmd(["docker","exec",container,"psql","-U","postgres","-d","n8n","-Atc","SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname='n8n'"]).stdout.strip()
 assert flags=="f|f|f","Application role must not be a database superuser/role creator"
 bad=login("wrong-synthetic-password")
 assert bad.returncode!=0,"Wrong application credential unexpectedly accepted"
 print("PASS native first boot: correct app credential; restricted role; wrong credential denied (3 checks)")
finally:
 if owned("container",container): cmd(["docker","rm","-f",container],False)
 if owned("volume",volume): cmd(["docker","volume","rm",volume],False)
 if owned("network",network): cmd(["docker","network","rm",network],False)
 assert root.parent==Path(tempfile.gettempdir()) and root.name.startswith(nonce+"-")
 shutil.rmtree(root)
