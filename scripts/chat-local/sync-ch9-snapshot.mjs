import assert from "node:assert/strict";
import {readFile,writeFile,readdir,cp} from "node:fs/promises";
import {createHash} from "node:crypto";
import path from "node:path";
import {root,runtime,state,verifyContainer} from "./common.mjs";
const s=await state();await verifyContainer(s,"db");await verifyContainer(s,"rest");
const manifestPath=path.join(runtime,"snapshot-manifest.json");
const manifest=JSON.parse(await readFile(manifestPath,"utf8"));
assert.equal(manifest.source,root);
assert.equal(path.dirname(manifest.snapshot),runtime);
assert.match(path.basename(manifest.snapshot),/^app-[0-9]+$/);
for(const [file,expected] of Object.entries(manifest.hashes)){
 const resolved=path.resolve(manifest.snapshot,file);
 assert.ok(resolved.startsWith(path.resolve(manifest.snapshot,"src")+path.sep));
 assert.equal(createHash("sha256").update(await readFile(resolved)).digest("hex"),expected,"Unexpected snapshot edit: "+file);
}
await cp(path.join(root,"src"),path.join(manifest.snapshot,"src"),{recursive:true,force:true});
const hashes={};async function digest(folder,prefix="src"){
 for(const entry of await readdir(folder,{withFileTypes:true})){
  const absolute=path.join(folder,entry.name),relative=path.join(prefix,entry.name);
  if(entry.isDirectory())await digest(absolute,relative);
  else if(entry.isFile())hashes[relative]=createHash("sha256").update(await readFile(absolute)).digest("hex");
 }
}
await digest(path.join(manifest.snapshot,"src"));
await writeFile(manifestPath,JSON.stringify({...manifest,refreshedAt:new Date().toISOString(),hashes},null,2));
console.log(JSON.stringify({snapshot:path.basename(manifest.snapshot),sourceFiles:Object.keys(hashes).length,scope:"owned local source snapshot only; no env, credentials or service changes"}));
