import {createServer} from "node:http";
import {createHash} from "node:crypto";
import {appendFile} from "node:fs/promises";
import path from "node:path";
import {z} from "zod";
import {runtime,ports} from "./common.mjs";
const digest=value=>createHash("sha256").update(value).digest("hex");
export function localNotificationEnvironment(s,enabled){
 const off={CHAT_NOTIFICATIONS_ENABLED:"false",CHAT_NOTIFICATIONS_CRON_ENABLED:"false",CHAT_TELEGRAM_MOCK_ENABLED:"false",CHAT_TELEGRAM_LIVE_ENABLED:"false",CHAT_PLATFORM_ALERTS_ENABLED:"false",TELEGRAM_BOT_TOKEN:"",TELEGRAM_PLATFORM_ALERT_CHAT_ID:""};
 if(!enabled)return off;
 return {...off,CHAT_NOTIFICATIONS_ENABLED:"true",CHAT_TELEGRAM_MOCK_ENABLED:"true",
  CHAT_TELEGRAM_MOCK_ORIGIN:"http://127.0.0.1:4143",CHAT_DRY_RUN:"false",
  TELEGRAM_BOT_TOKEN:"12345:"+digest(s.nonce+"notification-mock"),
  TELEGRAM_WEBHOOK_SECRET:digest(s.nonce+"notification-webhook"),
  CHAT_NOTIFICATIONS_CRON_SECRET:digest(s.nonce+"notification-cron"),
  CHAT_APP_ORIGIN:"http://localhost:"+ports.app};
}
export async function startLocalNotificationMock(environment){
 const token=environment.TELEGRAM_BOT_TOKEN;
 if(environment.CHAT_TELEGRAM_MOCK_ENABLED!=="true"||!token)throw new Error("Mock notification launch not authorized.");
 let sequence=1000;
 const inputSchema=z.object({chat_id:z.string().regex(/^-?[1-9][0-9]{0,15}$/).refine(v=>Math.abs(Number(v))<2**52),text:z.string().min(1).refine(v=>Array.from(v).length<=4096),link_preview_options:z.object({is_disabled:z.literal(true)}).strict()}).strict();
 const server=createServer(async(req,res)=>{
  req.setTimeout(5000,()=>req.destroy());
  if(req.method!=="POST"||req.url!=="/bot"+token+"/sendMessage"){res.writeHead(404);res.end();return;}
  try{
   let size=0;const chunks=[];for await(const part of req){size+=part.length;if(size>65536)throw new Error("Too large");chunks.push(part);}
   const input=inputSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8"))),id=++sequence;
   // Only hashes/receipts, never bot URLs, recipients or report text, enter local mock logs.
   await appendFile(path.join(runtime,"telegram-mock-receipts.jsonl"),JSON.stringify({at:new Date().toISOString(),messageId:id,chatHash:digest(input.chat_id),textHash:digest(input.text)})+"\n",{mode:0o600});
   res.setHeader("Content-Type","application/json");res.end(JSON.stringify({ok:true,result:{message_id:id,chat:{id:Number(input.chat_id)},text:input.text}}));
  }catch{res.writeHead(400);res.end();}
 });
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(4143,"127.0.0.1",resolve);});
 return {close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
