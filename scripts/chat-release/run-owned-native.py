"""Receive a locally allowlisted synthetic tar.gz via exact scoped SSH stdin.

Not an installer. No live DB or app environment is used; no image is pulled.
An SSH stdin bootstrap reads this script first, followed by the source-only tar.gz.
"""
import datetime, hashlib, io, json, os, pathlib, re, secrets, shutil, subprocess, sys, tarfile, time


os.umask(0o077)
nonce=secrets.token_hex(12)
label="osplus.chat.native-release-qa"
network="osplus-release-qa-"+nonce
pg_name=network+"-db"
node_name=network+"-node"
base=pathlib.Path("/opt/os-plus-ops/release-qa").resolve()
workspace=base/nonce
report_path=pathlib.Path("/opt/os-plus-ops")/("release-qa-"+nonce+".json")
log_path=report_path.with_suffix(".log")
report={"utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),"nonce":nonce,
  "sharedWrites":False,"liveAI":False,"liveSTT":False,"spendUsd":0,"cleanup":False,
  "memorySamples":[],"testCommand":"npm run test:chat"}
created=[]

def run(args, data=None, check=True, timeout=30):
    p=subprocess.run(args,input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout)
    if check and p.returncode:
        safe=p.stderr.decode(errors="replace").replace(globals().get("password","__none__"),"<synthetic-password>")[:1000]
        report["commandFailure"]={"step":report.get("step"),"program":args[:2],"stderr":safe}
        raise RuntimeError("OWNED_QA_COMMAND_FAILED:"+args[0])
    return p

def state():
    ids=run(["docker","ps","-q","--filter","label=com.docker.compose.project=osplus-chat-private"]).stdout.split()
    objects=json.loads(run(["docker","inspect",*[i.decode() for i in ids]]).stdout)
    return {c["Config"]["Labels"]["com.docker.compose.service"]:{"id":c["Id"],
      "running":c["State"]["Running"],"oom":c["State"]["OOMKilled"],"restarts":c["RestartCount"]} for c in objects}

def available():
    return int(next(line.split()[1] for line in pathlib.Path("/proc/meminfo").read_text().splitlines()
      if line.startswith("MemAvailable:")))//1024

def verify(kind,name):
    field="{{index .Config.Labels \""+label+"\"}}" if kind=="container" else "{{index .Labels \""+label+"\"}}"
    got=run(["docker",kind,"inspect","--format",field,name]).stdout.decode().strip()
    if got!=nonce:raise RuntimeError("OWNED_QA_CLEANUP_REFUSED")

try:
    if str(base)!="/opt/os-plus-ops/release-qa":raise RuntimeError("WORKSPACE_ROOT_REDIRECTED")
    if available()<1400:raise RuntimeError("INSUFFICIENT_HOST_HEADROOM")
    report["before"]=state()
    if len(report["before"])!=7 or not all(v["running"] for v in report["before"].values()):
        raise RuntimeError("LIVE_HOST_NOT_HEALTHY")
    manifest=json.loads(pathlib.Path("/opt/os-plus-ops/images-20261030.json").read_text())
    pins={v["variable"]:v["digest"] for v in manifest}
    pg_image="postgres@sha256:747d5ed1fdeeb124b880fbe3d7c6557d2c4064ae41d6b6297d417882effce4be"
    node_image=pins["N8N_IMAGE"]
    for image in [pg_image,node_image]:
        if "@sha256:" not in image:raise RuntimeError("IMAGE_NOT_PINNED")
        run(["docker","image","inspect",image])
    report["images"]={"postgres":pg_image,"nodeRuntime":node_image}
    archive=sys.stdin.buffer.read(64*1024*1024+1)
    if len(archive)>64*1024*1024:raise RuntimeError("SOURCE_BUNDLE_TOO_LARGE")
    report["sourceBundleSha256"]=hashlib.sha256(archive).hexdigest()
    base.mkdir(parents=True,exist_ok=True)
    workspace.mkdir(mode=0o755)
    with tarfile.open(fileobj=io.BytesIO(archive),mode="r:gz") as tar:
        members=tar.getmembers()
        if len(members)>30000 or sum(m.size for m in members)>300*1024*1024:
            raise RuntimeError("SOURCE_BUNDLE_LIMIT")
        for m in members:
            parts=pathlib.PurePosixPath(m.name).parts
            if not parts or pathlib.PurePosixPath(m.name).is_absolute() or ".." in parts or \
              not m.isfile() or any(p in [".git",".env",".env.local","outputs"] for p in parts) or \
              not str((workspace/m.name).resolve()).startswith(str(workspace)+"/"):
                raise RuntimeError("SOURCE_BUNDLE_PATH_REFUSED")
            target=workspace/m.name
            target.parent.mkdir(parents=True,exist_ok=True,mode=0o755)
            with target.open("xb") as f:f.write(tar.extractfile(m).read())
            target.chmod(0o644)
    workspace.chmod(0o755)
    for directory in workspace.rglob("*"):
        if directory.is_dir():directory.chmod(0o755)
    report["step"]="network_create"
    run(["docker","network","create","--internal","--label",label+"="+nonce,network])
    created.append(("network",network))
    password=secrets.token_hex(32)
    report["step"]="database_start"
    run(["docker","run","-d","--pull=never","--name",pg_name,"--label",label+"="+nonce,
      "--network",network,"--network-alias","osplus-chat-qa-db","--log-driver","none",
      "--memory","512m","--memory-swap","512m","--cpus","1","--pids-limit","128",
      "--tmpfs","/var/lib/postgresql/data:rw,size=536870912","--security-opt","no-new-privileges",
      "-e","POSTGRES_PASSWORD="+password,"-e","PGDATA=/var/lib/postgresql/data/pgdata",pg_image,
      "postgres","-c","osplus.test_nonce="+nonce,"-c","search_path=public,extensions"])
    created.append(("container",pg_name))
    report["step"]="database_ready"
    for _ in range(60):
        if run(["docker","exec",pg_name,"pg_isready","-h","127.0.0.1","-U","postgres"],check=False).returncode==0:break
        time.sleep(0.25)
    else:raise RuntimeError("OWNED_DATABASE_START_TIMEOUT")
    report["step"]="roles_setup"
    run(["docker","exec",pg_name,"psql","-X","-U","postgres","-v","ON_ERROR_STOP=1","-c",
      "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;"])
    report["step"]="database_isolation"
    check=json.loads(run(["docker","inspect",pg_name]).stdout)[0]
    if check["HostConfig"].get("PortBindings") or any(m["Type"]!="tmpfs" for m in check["Mounts"]):
        raise RuntimeError("OWNED_DATABASE_ISOLATION_FAILED")
    cmd=["docker","run","--pull=never","--name",node_name,"--label",label+"="+nonce,
      "--network",network,"--log-driver","none","--memory","512m","--memory-swap","512m",
      "--cpus","1","--pids-limit","128","--read-only","--cap-drop","ALL",
      "--security-opt","no-new-privileges","--tmpfs","/tmp:rw,nosuid,nodev,size=268435456",
      "--mount","type=bind,src="+str(workspace)+",dst=/qa,readonly","-w","/qa",
      "-e","CHAT_TEST_OWNED_DATABASE_NONCE="+nonce,"-e","CHAT_TEST_OWNED_DATABASE_PASSWORD="+password,
      "-e","CHAT_TEST_OWNED_DATABASE_MODE=isolated-internal-network","-e","NPM_CONFIG_CACHE=/tmp/npm",
      "-e","NEXT_TELEMETRY_DISABLED=1","--entrypoint","npm",node_image,
      "run","test:chat"]
    created.append(("container",node_name))
    print("Starting full Chat suite in nonce-owned512MiB Node +512MiB native PostgreSQL; no live data",flush=True)
    report["step"]="full_chat_suite"
    started=time.monotonic()
    with log_path.open("wb") as log:
        process=subprocess.Popen(cmd,stdout=log,stderr=subprocess.STDOUT)
        while process.poll() is None:
            report["memorySamples"].append({"elapsed":round(time.monotonic()-started,1),"availableMiB":available()})
            if time.monotonic()-started>900:
                verify("container",node_name)
                run(["docker","stop","--time","5",node_name],check=False)
                process.wait(timeout=20)
                raise RuntimeError("OWNED_SUITE_DEADLINE")
            time.sleep(3)
    report["exitCode"]=process.returncode
    report["elapsedSeconds"]=round(time.monotonic()-started,1)
    output=log_path.read_text(errors="replace")
    report["counts"]={key:int(value) for key,value in re.findall(r"^# (tests|pass|fail|cancelled|skipped|todo) (\d+)\s*$",output,re.M)}
    report["failureTail"]=output[-12000:] if process.returncode else ""
    report["after"]=state()
    report["liveServicesUnchanged"]=report["before"]==report["after"]
    report["status"]="PASS" if process.returncode==0 and report["liveServicesUnchanged"] and report["counts"].get("tests",0)>=311 and report["counts"].get("tests")==report["counts"].get("pass") and all(report["counts"].get(k)==0 for k in ["fail","cancelled","skipped","todo"]) else "FAIL"
except Exception as error:
    report["status"]="FAIL"
    report["error"]=str(error)[:120] if re.fullmatch(r"[A-Z_]+(?::[a-z]+)?",str(error)) else "OWNED_QA_EXCEPTION"
finally:
    errors=[]
    for kind,name in reversed(created):
        try:
            exists=run(["docker",kind,"inspect",name],check=False).returncode==0
            if exists:
                verify(kind,name)
                run(["docker",kind,"rm",*(["-f"] if kind=="container" else []),name])
        except Exception:errors.append(name)
    if workspace.exists():
        if workspace.resolve().parent!=base or workspace.name!=nonce:errors.append("workspace")
        else:shutil.rmtree(workspace)
    report["cleanup"]=not errors
    report["cleanupErrors"]=errors
    if errors:report["status"]="FAIL"
    report["reportPath"]=str(report_path)
    report["logPath"]=str(log_path)
    report_path.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2),flush=True)
raise SystemExit(0 if report["status"]=="PASS" else 1)
