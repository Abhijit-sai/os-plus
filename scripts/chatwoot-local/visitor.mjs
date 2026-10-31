import http from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {state,owned,runtime} from "./common.mjs";
const s=await state();await owned(s);
const accounts=JSON.parse(await readFile(path.join(runtime,"accounts.private.json"),"utf8")).accounts;
const server=http.createServer((req,res)=>{
 const controlPath=new URL(req.url,"http://localhost").pathname;
 if(controlPath.startsWith("/__local/")){
  if(req.headers["x-local-control"]!==s.nonce){res.writeHead(404).end();return;}
  if(controlPath==="/__local/health"&&req.method==="GET"){res.writeHead(200,{"Content-Type":"application/json"}).end(JSON.stringify({project:s.project,service:"visitor"}));return;}
  if(controlPath==="/__local/stop"&&req.method==="POST"){res.writeHead(200).end();server.close(()=>process.exit(0));server.closeAllConnections();return;}
  res.writeHead(404).end();return;
 }
 const url=new URL(req.url,"http://localhost");
 const index=url.pathname==="/2"?1:0;
 if(!["/","/1","/2"].includes(url.pathname)){res.writeHead(404).end();return;}
 const token=JSON.stringify(accounts[index].websiteToken);
 res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
 res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chat Local ${index+1} — Test Visitor</title><style>body{font:18px system-ui;background:#f5f5f4;color:#222;margin:0;padding:40px;max-width:620px}a{color:#255ac6}nav{display:flex;gap:24px}h1{font-size:32px}p{line-height:1.6}</style></head><body><nav><a href="/1">Chat Local 1</a><a href="/2">Chat Local 2</a><a href="http://localhost:4141" target="_blank" rel="noopener">Staff inbox ↗</a></nav><h1>Chat Local ${index+1}</h1><p>This is the visitor side of the local test. Open the chat bubble and send a sample inquiry. Read and reply to it in the Chatwoot staff inbox.</p><p>Only synthetic messages. No WhatsApp, email or AI replies are connected.</p><script>window.chatwootSettings={position:'right',locale:'en',type:'standard'};(function(){var s=document.createElement('script');s.src='http://localhost:4141/packs/js/sdk.js';s.onload=function(){window.chatwootSDK.run({websiteToken:${token},baseUrl:'http://localhost:4141'})};document.head.appendChild(s)})();</script></body></html>`);
});
server.listen(4142,"127.0.0.1",()=>console.log("Visitor test pages: http://localhost:4142/1 and /2"));
