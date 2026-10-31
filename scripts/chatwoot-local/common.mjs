import {readFile,writeFile,mkdir} from "node:fs/promises";
import {randomBytes,createHash} from "node:crypto";
import path from "node:path";
import {root,command,exists} from "../chat-local/common.mjs";
export const runtime=path.join(root,"outputs","chatwoot-local");
export const project="osplus-chatwoot-local-"+createHash("sha256").update(root.toLowerCase()).digest("hex").slice(0,10);
export async function state(create=false){
 await mkdir(runtime,{recursive:true});
 const file=path.join(runtime,"private.json");
 if(!await exists(file)){
  if(!create)throw new Error("Prepare local Chatwoot first.");
  const value={project,root,nonce:randomBytes(24).toString("hex"),password:randomBytes(32).toString("hex"),redis:randomBytes(32).toString("hex"),secret:randomBytes(64).toString("hex"),encryption:randomBytes(32).toString("hex"),deterministic:randomBytes(32).toString("hex"),salt:randomBytes(32).toString("hex"),loginPassword:randomBytes(24).toString("base64url")+"aA1!"};
  await writeFile(file,JSON.stringify(value,null,2));
 }
 const s=JSON.parse(await readFile(file,"utf8"));
 if(s.root!==root||s.project!==project||!/^[a-f0-9]{48}$/.test(s.nonce))throw new Error("Local ownership mismatch");
 return s;
}
export async function compose(...args){return command("docker",["compose","-p",project,"--env-file",path.join(runtime,"compose.env"),"-f",path.join(root,"scripts/chatwoot-local/compose.yaml"),...args]);}
export async function owned(s,execute=command){
 const prospective=[["container",["ps","-a","--format","{{.Names}}"],["db","redis","bridge","rails","sidekiq"].map(x=>project+"-"+x+"-1"),".Config.Labels"],["volume",["volume","ls","-q"],["db","redis","storage","ca"].map(x=>project+"_"+x),".Labels"],["network",["network","ls","--format","{{.Name}}"],["private","callback_host"].map(x=>project+"_"+x),".Labels"]];
 for(const [kind,args,names,field] of prospective){
  const found=(await execute("docker",args)).split(/\s+/);
  for(const name of names)if(found.includes(name)){
   if(await execute("docker",[kind,"inspect","--format",'{{index '+field+' "osplus.chatwoot.local"}}',name])!==s.nonce)throw new Error("Foreign resource name collision");
  }
 }
 const ids=(await execute("docker",["ps","-aq","--filter","label=com.docker.compose.project="+project])).split(/\s+/).filter(Boolean);
 for(const id of ids){
  if(await execute("docker",["inspect","--format",'{{index .Config.Labels "osplus.chatwoot.local"}}',id])!==s.nonce)throw new Error("Foreign container in local project");
 }
 for(const kind of ["volume","network"]){
  const names=(await execute("docker",[kind,"ls","-q","--filter","label=com.docker.compose.project="+project])).split(/\s+/).filter(Boolean);
  for(const name of names)if(await execute("docker",[kind,"inspect","--format",'{{index .Labels "osplus.chatwoot.local"}}',name])!==s.nonce)throw new Error("Foreign local resource");
 }
}
export async function rails(source){
 const s=await state();await owned(s);
 return command("docker",["compose","-p",project,"--env-file",path.join(runtime,"compose.env"),"-f",path.join(root,"scripts/chatwoot-local/compose.yaml"),"exec","-T","rails","bundle","exec","rails","runner","-"],{input:source});
}
export {root,command};
