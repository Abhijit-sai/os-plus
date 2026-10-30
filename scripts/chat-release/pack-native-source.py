from pathlib import Path
import hashlib,io,json,tarfile,sys
r=Path(__file__).resolve().parents[2]
if len(sys.argv)!=2:raise SystemExit('Usage: pack-native-source.py NEW_OUTPUT_DIRECTORY')
out=Path(sys.argv[1]).resolve()
out.mkdir(parents=True,exist_ok=False)
files={}
def addtree(folder):
    for p in folder.rglob('*'):
        rel=p.relative_to(r)
        if not p.is_file() or any(x in ['.git','.next','outputs','__pycache__'] for x in rel.parts):continue
        if 'node_modules' in rel.parts and folder in [r/'scripts',r/'src']:continue
        if any(x.startswith('.env') for x in rel.parts):continue
        files[rel.as_posix()]=p
for folder in ['src','scripts','supabase/migrations','deploy','docs_chat']:
    addtree(r/folder)
for name in ['package.json','package-lock.json','tsconfig.json']:
    files[name]=r/name
for p in (r/'public/chatwoot').rglob('*.js'):files[p.relative_to(r).as_posix()]=p
needed=['server-only','zod','typescript','react','react-dom','next','@supabase/supabase-js','libphonenumber-js']
seen=set()
def dependency(name,parent):
    choices=[parent/'node_modules'/name,r/'node_modules'/name]
    target=next((p for p in choices if (p/'package.json').is_file()),None)
    if target is None:raise RuntimeError('MISSING_INSTALLED_DEPENDENCY:'+name)
    if target in seen:return
    seen.add(target)
    addtree(target)
    spec=json.loads((target/'package.json').read_text(encoding='utf8'))
    for child in spec.get('dependencies',{}):dependency(child,target)
for name in needed:dependency(name,r)
addtree(r/'scripts/shopify-db-harness/node_modules')
stream=io.BytesIO()
with tarfile.open(fileobj=stream,mode='w:gz') as tar:
    for name,p in sorted(files.items()):
        raw=p.read_bytes()
        item=tarfile.TarInfo(name);item.size=len(raw);item.mode=0o644
        tar.addfile(item,io.BytesIO(raw))
packed=stream.getvalue()
assert len(packed)<64*1024*1024
(out/'native-source.tar.gz').write_bytes(packed)
(out/'native-source-manifest.json').write_text(json.dumps({'files':len(files),'compressedBytes':len(packed),
    'sourceBundleSha256':hashlib.sha256(packed).hexdigest(),
    'contents':[{'path':name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for name,p in sorted(files.items())]},indent=2)+'\n')
print(json.dumps({'files':len(files),'compressedMiB':round(len(packed)/1024**2,1),'nodePackages':len(seen),
    'sourceBundleSha256':hashlib.sha256(packed).hexdigest(),'secretsIncluded':False}))
