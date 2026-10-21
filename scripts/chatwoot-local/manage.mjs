import {writeFile,readFile} from "node:fs/promises";
import path from "node:path";
import {state,runtime,owned,compose,command,project} from "./common.mjs";
import {startServices,stopServices} from "./processes.mjs";
const operation=process.argv[2],s=await state(operation==="up");
await owned(s);
if(operation==="up"){
 const images={CW_IMAGE:"chatwoot/chatwoot:v4.18.0-ce",PG_IMAGE:"pgvector/pgvector:pg17",REDIS_IMAGE:"redis:7",CADDY_IMAGE:"caddy:2-alpine"};
 const env={LOCAL_NONCE:s.nonce,CW_PASSWORD:s.password,CW_REDIS:s.redis,CW_SECRET:s.secret,CW_ENCRYPTION:s.encryption,CW_DETERMINISTIC:s.deterministic,CW_SALT:s.salt};
 let pinned=null;try{pinned=JSON.parse(await readFile(path.join(runtime,"images.json"),"utf8"));}catch(e){if(e.code!=="ENOENT")throw e;}
 for(const [key,tag] of Object.entries(images)){env[key]=await command("docker",["image","inspect","--format","{{.Id}}",pinned?.[key]?.id??tag]);if(!/^sha256:[a-f0-9]{64}$/.test(env[key]))throw new Error("Missing official image");}
 await writeFile(path.join(runtime,"compose.env"),Object.entries(env).map(([k,v])=>k+"="+v).join("\n")+"\n");
 await writeFile(path.join(runtime,"images.json"),JSON.stringify(Object.fromEntries(Object.keys(images).map(k=>[k,{tag:images[k],id:env[k]}])),null,2));
 await compose("config","--quiet");
 await compose("up","-d","--wait","db","redis","bridge");
 console.log("Private local database, Redis and TLS bridge ready.");
 const prepare=await compose("run","--rm","rails","bundle","exec","rails","db:chatwoot_prepare");
 await writeFile(path.join(runtime,"prepare.log"),prepare);
 console.log("Isolated Chatwoot database prepared.");
 await compose("up","-d","rails","sidekiq");
 const ca=await compose("exec","-T","bridge","cat","/data/caddy/pki/authorities/local/root.crt");
 if(!ca.includes("BEGIN CERTIFICATE"))throw new Error("Local CA unavailable");
 await writeFile(path.join(runtime,"ca.crt"),ca+"\n");
 let ready=false;for(let n=0;n<60;n++){try{if((await fetch("http://127.0.0.1:4141/api",{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}
 if(!ready)throw new Error("Chatwoot did not become ready");
 // Visitor page requires one-time seeding; relay can start after both fixtures exist.
 try{await readFile(path.join(runtime,"accounts.private.json"));await startServices(s);}catch(e){if(e.code!=="ENOENT")throw e;}
 console.log("Local Chatwoot starting at http://localhost:4141");
}else if(operation==="status"){console.log(await compose("ps","--format","table"));}
else if(operation==="stop"){await stopServices(s);await compose("stop");console.log("Only owned Chatwoot services stopped; data retained.");}
else throw new Error("Usage: manage.mjs up|status|stop");
