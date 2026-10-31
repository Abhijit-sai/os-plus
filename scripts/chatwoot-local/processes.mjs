import {spawn} from "node:child_process";
import {open} from "node:fs/promises";
import path from "node:path";
import {root,runtime} from "./common.mjs";
import {cleanEnvironment} from "../chat-local/common.mjs";
const services={relay:4132,visitor:4142};
export async function serviceHealth(name,s){
 try{
  const r=await fetch("http://127.0.0.1:"+services[name]+"/__local/health",{headers:{"x-local-control":s.nonce},signal:AbortSignal.timeout(1500)});
  if(!r.ok)return false;
  const body=await r.json();return body.project===s.project&&body.service===name;
 }catch{return false;}
}
export async function startServices(s){
 for(const [name,port] of Object.entries(services)){
  if(await serviceHealth(name,s))continue;
  try{const response=await fetch("http://127.0.0.1:"+port+"/__local/health",{signal:AbortSignal.timeout(1000)});await response.body?.cancel();throw new Error("Refuse occupied local service port "+port);}catch(e){if(e.message.startsWith("Refuse"))throw e;}
  const log=await open(path.join(runtime,name+".log"),"a");
  const child=spawn(process.execPath,[path.join(root,"scripts/chatwoot-local/"+name+".mjs")],{cwd:root,env:cleanEnvironment(),detached:true,windowsHide:true,stdio:["ignore",log.fd,log.fd]});child.unref();await log.close();
  let ready=false;for(let n=0;n<30;n++){if(await serviceHealth(name,s)){ready=true;break;}await new Promise(r=>setTimeout(r,300));}
  if(!ready)throw new Error("Local "+name+" did not start; inspect private log");
 }
}
export async function stopServices(s){
 for(const [name,port] of Object.entries(services))if(await serviceHealth(name,s)){
  const r=await fetch("http://127.0.0.1:"+port+"/__local/stop",{method:"POST",headers:{"x-local-control":s.nonce},signal:AbortSignal.timeout(2000)});
  if(!r.ok)throw new Error("Local service stop failed");
 }
}
