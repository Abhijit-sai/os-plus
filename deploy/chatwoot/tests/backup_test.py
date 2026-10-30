#!/usr/bin/env python3
"""Offline subprocess tests of backup orchestration, not crypto/DB restore proof."""
import fcntl
import io
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import time
import unittest

KIT = Path(__file__).resolve().parents[1]
DOCKER_STUB = r'''#!/usr/bin/env python3
import io, os, sys, tarfile
from pathlib import Path
args=sys.argv[1:]
cmd=next(v for v in args if v in ("ps","stop","start","exec","run"))
with open(os.environ["FAKE_LOG"],"a") as log: log.write(" ".join(args)+"\\n")
if cmd=="ps":
 if os.environ.get("FAKE_FAIL")=="ps": sys.exit(1)
 print(os.environ.get("FAKE_RUNNING","rails\\nn8n"))
elif cmd=="start":
 if os.environ.get("FAKE_FAIL")=="restart": sys.exit(1)
elif cmd=="exec":
 if os.environ.get("FAKE_FAIL")=="dump" and "pg_dump" in args: sys.exit(1)
 sys.stdout.buffer.write(b"synthetic-db-or-redis-snapshot")
elif cmd=="run":
 out=io.BytesIO()
 with tarfile.open(fileobj=out,mode="w:gz") as archive:
  data=b"synthetic-file"
  item=tarfile.TarInfo("sample.txt");item.size=len(data)
  archive.addfile(item,io.BytesIO(data))
 sys.stdout.buffer.write(out.getvalue())
'''
AGE_STUB = r'''#!/usr/bin/env python3
# Deliberately a pass-through stub: these tests DO NOT verify cryptography.
import os, sys
from pathlib import Path
args=sys.argv[1:]
if os.environ.get("FAKE_FAIL")=="encrypt": sys.exit(1)
output=Path(args[args.index("--output")+1])
output.write_bytes(Path(args[-1]).read_bytes() if "--decrypt" in args else sys.stdin.buffer.read())
'''
class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix="os-plus-chat-test-")
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        self.kit=self.root/"kit"
        shutil.copytree(KIT,self.kit)
        (self.kit/".env").write_text("SYNTHETIC_FIXTURE=true\n")
        self.backups=self.root/"backups";self.backups.mkdir()
        self.bin=self.root/"bin";self.bin.mkdir()
        for name,source in (("docker",DOCKER_STUB),("age",AGE_STUB)):
            file=self.bin/name;file.write_text(source.replace("\\\\n","\\n"));file.chmod(0o700)
        self.recipient=self.root/"recipients";self.recipient.write_text("synthetic-recipient\n")
        self.log=self.root/"commands"
        self.env={**os.environ,"PATH":str(self.bin)+os.pathsep+os.environ["PATH"],
                  "BACKUP_DIR":str(self.backups),"BACKUP_RECIPIENT_FILE":str(self.recipient),
                  "FAKE_LOG":str(self.log),"FAKE_FAIL":"","FAKE_RUNNING":"rails\nn8n"}
    def run_script(self,name,*args):
        return subprocess.run(["bash",str(self.kit/"scripts"/name),*map(str,args)],
                              env=self.env,capture_output=True,text=True,timeout=20)
    def commands(self):
        return self.log.read_text().splitlines() if self.log.exists() else []
    def assert_clean(self):
        self.assertEqual(list(self.backups.glob(".partial.*")),[])
        self.assertEqual(list(self.backups.glob("*.age.partial")),[])
    def test_success_quiets_writers_and_resumes_only_previously_running_apps(self):
        result=self.run_script("backup.sh");self.assertEqual(result.returncode,0,result.stderr)
        commands=self.commands()
        stop=next(i for i,c in enumerate(commands) if " stop " in c)
        dump=next(i for i,c in enumerate(commands) if "pg_dump" in c)
        self.assertLess(stop,dump)
        self.assertTrue(any(c.endswith("start rails n8n") for c in commands))
        self.assertFalse(any(c.endswith("start rails sidekiq n8n") for c in commands))
        self.assertTrue((self.backups/"last-success").exists());self.assert_clean()
        archive=next(self.backups.glob("*.tar.age"))
        with tarfile.open(archive,"r:gz") as bundle:
            self.assertEqual(bundle.getmember("scripts/init-n8n-db.sh").mode & 0o777,0o644)
        verified=self.run_script("verify-backup.sh",archive,self.recipient)
        self.assertEqual(verified.returncode,0,verified.stderr)
    def test_dump_failure_resumes_apps_without_advancing_success_or_retention(self):
        old=self.backups/"os-plus-chat-old.tar.age";old.write_bytes(b"old")
        os.utime(old,(0,0))
        self.env["FAKE_FAIL"]="dump"
        result=self.run_script("backup.sh");self.assertNotEqual(result.returncode,0)
        self.assertTrue(any(c.endswith("start rails n8n") for c in self.commands()))
        self.assertFalse((self.backups/"last-success").exists())
        self.assertTrue(old.exists());self.assert_clean()
    def test_encryption_failure_removes_partial_plaintext_and_resumes_apps(self):
        self.env["FAKE_FAIL"]="encrypt"
        result=self.run_script("backup.sh");self.assertNotEqual(result.returncode,0)
        self.assertTrue(any(" start " in c for c in self.commands()))
        self.assertFalse((self.backups/"last-success").exists());self.assert_clean()
    def test_restart_failure_cannot_report_backup_success(self):
        self.env["FAKE_FAIL"]="restart"
        result=self.run_script("backup.sh");self.assertNotEqual(result.returncode,0)
        self.assertFalse((self.backups/"last-success").exists());self.assert_clean()
    def test_inventory_failure_cannot_silently_skip_quiescing(self):
        self.env["FAKE_FAIL"]="ps"
        result=self.run_script("backup.sh");self.assertNotEqual(result.returncode,0)
        self.assertFalse(any("pg_dump" in c for c in self.commands()));self.assert_clean()
    def test_missing_recipient_fails_before_any_docker_action(self):
        self.recipient.unlink()
        self.assertNotEqual(self.run_script("backup.sh").returncode,0)
        self.assertEqual(self.commands(),[])
    def test_stopped_apps_are_not_started_by_backup(self):
        self.env["FAKE_RUNNING"]=""
        result=self.run_script("backup.sh");self.assertEqual(result.returncode,0,result.stderr)
        self.assertFalse(any(" start " in c or " stop " in c for c in self.commands()))
        self.assert_clean()
    def test_concurrent_backup_is_rejected_without_docker_actions(self):
        with open(self.backups/".backup.lock","w") as lock:
            fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            self.assertNotEqual(self.run_script("backup.sh").returncode,0)
        self.assertEqual(self.commands(),[])
    def test_checksum_corruption_is_rejected(self):
        result=self.run_script("backup.sh");self.assertEqual(result.returncode,0,result.stderr)
        archive=next(self.backups.glob("*.tar.age"))
        with tarfile.open(archive,"r:gz") as incoming:
            entries=[(item,incoming.extractfile(item).read()) for item in incoming.getmembers()]
        with tarfile.open(archive,"w:gz") as outgoing:
            for item,data in entries:
                if item.name=="chatwoot.dump": data=b"tampered";item.size=len(data)
                outgoing.addfile(item,io.BytesIO(data))
        self.assertNotEqual(self.run_script("verify-backup.sh",archive,self.recipient).returncode,0)
    def test_backup_freshness_requires_marker(self):
        self.assertNotEqual(self.run_script("check-backup.sh").returncode,0)
    def test_old_or_future_backup_marker_fails(self):
        for value in (int(time.time())-27*3600,int(time.time())+3600):
            (self.backups/"last-success").write_text(str(value)+"\n")
            self.assertNotEqual(self.run_script("check-backup.sh").returncode,0)
    def test_fresh_backup_marker_passes(self):
        (self.backups/"last-success").write_text(str(int(time.time()))+"\n")
        self.assertEqual(self.run_script("check-backup.sh").returncode,0)

    def test_real_age_roundtrip_and_tamper_rejection(self):
        age_bin=os.environ.get("REAL_AGE_BIN")
        if not age_bin:
            self.skipTest("Set REAL_AGE_BIN for real encryption evidence.")
        real_age=Path(age_bin)
        keygen=real_age.parent/"age-keygen"
        (self.bin/"age").unlink()
        (self.bin/"age").symlink_to(real_age)
        identity=self.root/"identity.txt"
        key=subprocess.run([str(keygen),"-o",str(identity)],capture_output=True,text=True)
        self.assertEqual(key.returncode,0,"Synthetic key generation failed.")
        public=subprocess.run([str(keygen),"-y",str(identity)],capture_output=True,text=True)
        self.assertEqual(public.returncode,0,"Synthetic recipient extraction failed.")
        self.recipient.write_text(public.stdout)
        result=self.run_script("backup.sh");self.assertEqual(result.returncode,0,result.stderr)
        archive=next(self.backups.glob("*.tar.age"))
        self.assertTrue(archive.read_bytes().startswith(b"age-encryption.org/v1"))
        verified=self.run_script("verify-backup.sh",archive,identity)
        self.assertEqual(verified.returncode,0,verified.stderr)
        tampered=bytearray(archive.read_bytes());tampered[-1]^=1;archive.write_bytes(tampered)
        self.assertNotEqual(self.run_script("verify-backup.sh",archive,identity).returncode,0)
        self.assert_clean()

if __name__=="__main__":
    unittest.main(verbosity=2)
