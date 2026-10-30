import pg from "../shopify-db-harness/node_modules/pg/lib/index.js";
import { readFileSync } from "node:fs";
import { validateInput } from "../shopify-db-harness/private-backup-contract.mjs";
const report={kind:"osplus-private-backup-report-v1",check:"chat-release-catalogue",productionWrites:false,mayApply:false,mayDeploy:false};
let client,step="input";
try{
 const chunks=[];let size=0;
 for await(const chunk of process.stdin){size+=chunk.length;if(size>32768)throw new Error("INPUT_LIMIT");chunks.push(chunk);}
 const input=validateInput(JSON.parse(Buffer.concat(chunks).toString("utf8")));
 if(input.mode!=="Inspect" || input.approved!==false)throw new Error("READ_ONLY_REQUIRED");
 step="connection";
 client=new pg.Client({host:input.host,port:input.port,database:input.database,user:input.user,password:input.password,
  ssl:{ca:input.ca,rejectUnauthorized:true,minVersion:"TLSv1.2"},connectionTimeoutMillis:10000,
  statement_timeout:10000,query_timeout:15000,lock_timeout:1000,
  options:"-c default_transaction_read_only=on -c idle_in_transaction_session_timeout=30000",
  application_name:"osplus_chat_release_catalogue_readonly"});
 client.on("error",()=>{});
 await client.connect();input.password=null;
 await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 step="catalogue";
 report.snapshot=(await client.query(readFileSync(new URL("../../deploy/chat-release/20261030/preflight.sql",import.meta.url),"utf8"))).rows[0].snapshot;
 if(report.snapshot.readOnly!==true)throw new Error("READ_ONLY_REQUIRED");
 await client.query("ROLLBACK");
 report.utc=new Date().toISOString();report.status="observed_review_required";
}catch(error){report.status="failed";report.step=step;report.code="SAFE_CATALOGUE_CHECK_FAILED";
 if(/^[A-Z0-9]{5}$/.test(error.code??""))report.sqlState=error.code;process.exitCode=1;
}finally{await client?.end().catch(()=>{});process.stdout.write(JSON.stringify(report,null,2));}
