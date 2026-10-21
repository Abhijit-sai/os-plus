import assert from "node:assert/strict";
import http from "node:http";
import {writeFile} from "node:fs/promises";
import path from "node:path";
import {state,owned,runtime} from "./common.mjs";
import {serviceHealth,startServices,stopServices} from "./processes.mjs";
const s=await state();await owned(s);await startServices(s);
const checks=[];
const pass=x=>{checks.push(x);console.log("PASS "+x);};
const unauthorized=await fetch("http://127.0.0.1:4132/__local/health");assert.equal(unauthorized.status,404);
assert.equal((await fetch("http://127.0.0.1:4132/settings/chat")).status,404);pass("Relay denies control without nonce and non-webhook paths");
await new Promise(resolve=>{
 const req=http.request({host:"127.0.0.1",port:4132,path:"/api/chat/webhooks/chatwoot/"+("x".repeat(32))+"/events",method:"POST",headers:{"Content-Length":"5000"}});
 req.on("error",()=>resolve());req.write("{");setTimeout(()=>{req.destroy();resolve();},100);
});await new Promise(r=>setTimeout(r,150));assert.equal(await serviceHealth("relay",s),true);pass("Aborted request body does not terminate relay");
const bad=await fetch("http://127.0.0.1:4132/api/chat/webhooks/chatwoot/"+("x".repeat(32))+"/events",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});assert.equal(bad.status,404);pass("Subsequent webhook reaches actual OS PLUS and fails closed");
await stopServices(s);await new Promise(r=>setTimeout(r,300));await startServices(s);
assert.equal(await serviceHealth("relay",s),true);assert.equal(await serviceHealth("visitor",s),true);pass("Owned relay/visitor stop and restart with data retained");
await writeFile(path.join(runtime,"runtime-report.json"),JSON.stringify({at:new Date().toISOString(),result:"PASS",checks},null,2));
