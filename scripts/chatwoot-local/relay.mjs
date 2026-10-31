import http from "node:http";
import {state,owned} from "./common.mjs";
const s=await state();await owned(s);
// Only Docker Desktop's host bridge needs IPv4; Next remains bound to ::1.
const server=http.createServer(async(req,res)=>{
 const controlPath=new URL(req.url,"http://localhost").pathname;
 if(controlPath.startsWith("/__local/")){
  if(req.headers["x-local-control"]!==s.nonce){res.writeHead(404).end();return;}
  if(controlPath==="/__local/health"&&req.method==="GET"){res.writeHead(200,{"Content-Type":"application/json"}).end(JSON.stringify({project:s.project,service:"relay"}));return;}
  if(controlPath==="/__local/stop"&&req.method==="POST"){res.writeHead(200).end();server.close(()=>process.exit(0));server.closeAllConnections();return;}
  res.writeHead(404).end();return;
 }
 if(req.method!=="POST"||!/^\/api\/chat\/webhooks\/chatwoot\/[A-Za-z0-9_-]{32,128}\/(events|agent)$/.test(new URL(req.url,"http://localhost").pathname)){res.writeHead(404).end();return;}
 try{
 let size=0;const chunks=[];
 for await(const chunk of req){size+=chunk.length;if(size>1048576){res.writeHead(413).end();return;}chunks.push(chunk);}
  const r=await fetch("http://[::1]:4131"+req.url,{method:"POST",headers:{"Content-Type":"application/json"},body:Buffer.concat(chunks),redirect:"manual",signal:AbortSignal.timeout(30000)});
  res.writeHead(r.status,{"Cache-Control":"no-store"}).end();
 }catch{res.writeHead(503).end();}
});
server.listen(4132,"127.0.0.1",()=>console.log("Local callback relay ready on loopback4132; request URLs/bodies are not logged."));
