import path from "node:path";
import {readFile} from "node:fs/promises";
import {state,owned,runtime,compose} from "./common.mjs";
export async function localChatwootEnvironment(){
 await owned(await state());
 const services=JSON.parse(await compose("ps","--format","json").then(s=>"["+s.split("\n").filter(Boolean).join(",")+"]"));
 if(!services.some(s=>s.Service==="rails"&&s.State==="running"))throw new Error("Local Chatwoot is not running");
 const accounts=JSON.parse(await readFile(path.join(runtime,"accounts.private.json"),"utf8"));
 if(typeof accounts.platformToken!=="string"||!accounts.platformToken)throw new Error("Local platform token missing");
 await readFile(path.join(runtime,"ca.crt"),"utf8");
 return {
  CHATWOOT_BROWSER_ORIGIN:"http://localhost:4141",
  CHATWOOT_BASE_URL:"https://localhost:4444",
  CHAT_WEBHOOK_ORIGIN:"https://osplus-bridge",
  CHATWOOT_PLATFORM_TOKEN:accounts.platformToken,
  NODE_EXTRA_CA_CERTS:path.join(runtime,"ca.crt"),
  CHAT_ADMIN_LIVE_ENABLED:"true",
  CHAT_DRY_RUN:"false"
 };
}
