import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { readChatRelease } from "./chat-release/build.mjs";
const root=fileURLToPath(new URL("../",import.meta.url));
test("release contains only the35 frozen Chat additions and one atomic transaction",()=>{
  const release=readChatRelease(root);
  assert.equal(release.files.length,35);
  assert.ok(release.files.every(f=>f.name.includes("_chat_")));
  assert.equal(release.manifest.canonicalCount,106);
  assert.match(release.sql,/extensions\.digest\(/);
  assert.match(release.sql,/extensions\.gen_random_bytes\(/);
  assert.equal((release.sql.match(/^BEGIN;$/gm)??[]).length,1);
  assert.equal((release.sql.match(/^COMMIT;$/gm)??[]).length,1);
  assert.doesNotMatch(release.sql,/create table public\.shopify_connections/i);
});


// Exercise actual checkout bytes, including the builder's template literals.
import { readFileSync, readdirSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

function checkoutFixture(t, ending) {
  const prefix=path.join(os.tmpdir(),"chat-release-lines-");
  const folder=mkdtempSync(prefix);
  assert.ok(path.isAbsolute(folder) && folder.startsWith(prefix));
  t.after(()=>rmSync(folder,{recursive:true,force:false}));
  const migrations=path.join(folder,"supabase/migrations");
  const builder=path.join(folder,"scripts/chat-release/build.mjs");
  const contract=path.join(folder,"deploy/chat-release/20261030/source-manifest.json");
  for(const name of [migrations,path.dirname(builder),path.dirname(contract)]) mkdirSync(name,{recursive:true});
  const checkout=text=>text.replace(/\r\n/g,"\n").replace(/\n/g,ending);
  for(const name of readdirSync(path.join(root,"supabase/migrations"))) {
    if(name.endsWith(".sql")) writeFileSync(path.join(migrations,name),checkout(readFileSync(path.join(root,"supabase/migrations",name),"utf8")));
  }
  writeFileSync(builder,checkout(readFileSync(path.join(root,"scripts/chat-release/build.mjs"),"utf8")));
  writeFileSync(contract,readFileSync(path.join(root,"deploy/chat-release/20261030/source-manifest.json")));
  return {folder,migrations,builder};
}

test("Git LF and CRLF checkouts produce the identical reviewed SQL and manifest",async t=>{
  const expected=readChatRelease(root);
  assert.equal(expected.manifest.packageSha256,"3acfc26f7af98989d4957a6ab2d64ea2ceb871fca2235e5dc88dd336f61faab9");
  for(const ending of ["\n","\r\n"]) {
    const fixture=checkoutFixture(t,ending);
    const checkout=await import(pathToFileURL(fixture.builder).href);
    const actual=checkout.readChatRelease(fixture.folder);
    assert.equal(actual.sql,expected.sql);
    assert.deepEqual(actual.manifest,expected.manifest);
  }
});

test("checkout tolerance still rejects substantive baseline and Chat SQL mutations",t=>{
  const fixture=checkoutFixture(t,"\n");
  const names=readdirSync(fixture.migrations).sort();
  for(const name of [names.find(n=>!n.includes("_chat_")),names.find(n=>n.includes("_chat_"))]) {
    const filename=path.join(fixture.migrations,name);
    const original=readFileSync(filename);
    writeFileSync(filename,Buffer.concat([original,Buffer.from("\n-- unreviewed change\n")]));
    assert.throws(()=>readChatRelease(fixture.folder),error=>error.message==="FROZEN_MIGRATION_BYTES_CHANGED: "+name);
    writeFileSync(filename,original);
  }
});

test("separate staff-link migration never changes the frozen35 package, and unknown inventory is rejected", t => {
  const expected = readChatRelease(root);
  const fixture = checkoutFixture(t, "\n");
  writeFileSync(path.join(fixture.migrations, "20261031132000_chat_staff_link_commands.sql"), "begin;\nselect 1;\ncommit;\n");
  const actual = readChatRelease(fixture.folder);
  assert.equal(actual.sql, expected.sql);
  assert.deepEqual(actual.manifest, expected.manifest);
  assert.doesNotMatch(actual.sql, /chat_staff_link_configure/);
  writeFileSync(path.join(fixture.migrations, "20261031132100_unknown_followup.sql"), "select 1;\n");
  assert.throws(() => readChatRelease(fixture.folder), /FROZEN_MIGRATION_INVENTORY_CHANGED/);
});
