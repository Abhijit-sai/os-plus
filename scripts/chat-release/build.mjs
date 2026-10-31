import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const sha = value => createHash("sha256").update(value).digest("hex");
const contractPath = new URL("../../deploy/chat-release/20261030/source-manifest.json", import.meta.url);
const qualify = /(?<![\w.])(digest|gen_random_bytes)\(/g;
const transaction = /^(?:begin|commit);\r?$/gmi;
// These two frozen files contain mixed endings. Restore their exact historical
// newline positions after a Git checkout; the original byte hashes still gate them.
const mixedCRLFLines={
  "20261021123000_chat_contacts_leads.sql":[255,256],
  "20261021140000_chat_crm_reads.sql":[202],
};

// Separately reviewed additions are never included in the already-installed35 bundle.
export const chatReleaseFollowups = Object.freeze(["20261031132000_chat_staff_link_commands.sql"]);

// Pure preparation. No database, credentials, network or application env access.
export function readChatRelease(root) {
  const contract = JSON.parse(readFileSync(contractPath,"utf8"));
  const folder = path.join(root,"supabase/migrations");
  const names = readdirSync(folder).filter(n=>n.endsWith(".sql")).sort();
  const frozenNames = names.filter(name => !chatReleaseFollowups.includes(name));
  if (contract.count !==106 || frozenNames.length!==106 ||
      frozenNames.some((name,i)=>name!==contract.files[i].file)) throw new Error("FROZEN_MIGRATION_INVENTORY_CHANGED");
  const files=[];
  for (const item of contract.files) {
    let raw=readFileSync(path.join(folder,item.file));
    const matches=value=>value.length===item.bytes && sha(value)===item.sha256;
    if(!matches(raw)) {
      // Git may change only LF/CRLF on checkout. Recover the exact frozen bytes;
      // neither arbitrary whitespace nor SQL changes bypass the original hash.
      const lf=Buffer.from(raw.toString("utf8").replace(/\r\n/g,"\n"));
      const crlf=Buffer.from(lf.toString("utf8").replace(/\n/g,"\r\n"));
      let newline=0;
      const mixed=Buffer.from(lf.toString("utf8").replace(/\n/g,()=>
        mixedCRLFLines[item.file]?.includes(newline++) ? "\r\n" : "\n"));
      const equivalent=[lf,crlf,mixed].find(matches);
      if(!equivalent) throw new Error("FROZEN_MIGRATION_BYTES_CHANGED: "+item.file);
      raw=equivalent;
    }
    if(!item.file.includes("_chat_")) continue;
    let digest=0,random=0,transactions=0;
    const sql=raw.toString("utf8").replace(qualify,(_,name)=>{
      if(name==="digest")digest++;else random++;
      return "extensions."+name+"(";
    }).replace(transaction,()=>{transactions++;return "";});
    if(digest!==item.qualifyDigest || random!==item.qualifyRandomBytes || transactions!==item.transactionLines)
      throw new Error("RELEASE_RECIPE_CHANGED: "+item.file);
    files.push({name:item.file,sourceSha256:item.sha256,sha256:sha(sql),sql,
      qualifiedDigestCalls:digest,qualifiedRandomCalls:random,removedTransactionLines:transactions});
  }
  if(files.length!==35) throw new Error("CHAT_MIGRATION_COUNT_CHANGED");
  const guard=`DO $release_guard$ BEGIN
    IF to_regprocedure('extensions.digest(text,text)') IS NULL OR to_regprocedure('extensions.gen_random_bytes(integer)') IS NULL THEN
      RAISE EXCEPTION 'CHAT_RELEASE_PGCRYPTO_LAYOUT_MISMATCH'; END IF;
    IF to_regclass('public.chat_workspaces') IS NOT NULL OR to_regclass('public.tenant_modules') IS NOT NULL THEN
      RAISE EXCEPTION 'CHAT_RELEASE_ALREADY_OR_PARTIALLY_APPLIED'; END IF;
  END $release_guard$;`;
  const sql="-- Candidate Chat deployment; approval and catalogue reconciliation required.\nBEGIN;\nSET LOCAL lock_timeout = '5s';\nSET LOCAL statement_timeout = '60s';\n"+
    guard+"\n"+files.map(f=>"-- Source: "+f.name+" SHA256 "+f.sourceSha256+"\n"+f.sql).join("\n")+"\nCOMMIT;\n";
  const manifest={version:1,release:"chat-20261030-candidate",productionApproved:false,
    canonicalCount:106,baselineCount:71,chatCount:35,
    canonicalManifestSha256:contract.manifestSha256,
    packageSha256:sha(sql),files:files.map(({sql:_,...f})=>f)};
  return {files,sql,manifest};
}

export function writeChatRelease(root,output) {
  // Must be a new directory; never overwrite a previously reviewed artifact.
  const release=readChatRelease(root);
  mkdirSync(output,{recursive:false});
  writeFileSync(path.join(output,"chat.sql"),release.sql,{flag:"wx"});
  writeFileSync(path.join(output,"manifest.json"),JSON.stringify(release.manifest,null,2)+"\n",{flag:"wx"});
  return release.manifest;
}

if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  if(process.argv.length!==3) throw new Error("Usage: node scripts/chat-release/build.mjs NEW_OUTPUT_DIRECTORY");
  const root=fileURLToPath(new URL("../../",import.meta.url));
  const manifest=writeChatRelease(root,path.resolve(process.argv[2]));
  console.log(JSON.stringify({release:manifest.release,chatCount:manifest.chatCount,packageSha256:manifest.packageSha256,productionApproved:false}));
}
