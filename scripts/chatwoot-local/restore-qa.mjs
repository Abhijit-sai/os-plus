import {randomBytes} from "node:crypto";
import {writeFile} from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import {state,owned,command,runtime,root,project} from "./common.mjs";
const s=await state();await owned(s);
const args=["compose","-p",project,"--env-file",path.join(runtime,"compose.env"),"-f",path.join(root,"scripts/chatwoot-local/compose.yaml"),"exec","-T","db"];
const run=(cmd,opts={})=>command("docker",[...args,...cmd],opts);
const dump=await run(["pg_dump","-U","chatwoot","-d","chatwoot","-Fc"],{binary:true});
const name="cw_restore_"+randomBytes(6).toString("hex");
await writeFile(path.join(runtime,name+".dump"),dump);
await run(["createdb","-U","chatwoot",name]);
await run(["pg_restore","-U","chatwoot","-d",name,"--no-owner","--exit-on-error"],{input:dump});
const sql=`
create function pg_temp.manifest() returns jsonb language plpgsql as $$
declare t record; result jsonb := '{}'::jsonb; v jsonb;
begin
 for t in select tablename from pg_tables where schemaname='public' order by tablename loop
 execute format('select jsonb_build_object(''count'',count(*),''hash'',md5(coalesce(string_agg(row_to_json(r)::text,''''
 order by row_to_json(r)::text),''''))) from public.%I r',t.tablename) into v;
 result:=result||jsonb_build_object(t.tablename,v);
 end loop;return result;
end $$;
select pg_temp.manifest();`;
const manifest=async(db)=>JSON.parse((await run(["psql","-X","-q","-t","-A","-v","ON_ERROR_STOP=1","-U","chatwoot","-d",db],{input:sql})).trim());
// Compare stable data; stop writers for the short dump/restore window in the calling workflow.
const before=await manifest("chatwoot"),after=await manifest(name);assert.deepEqual(after,before);
await writeFile(path.join(runtime,"restore-report.json"),JSON.stringify({at:new Date().toISOString(),result:"PASS",database:name,tables:Object.keys(after).length,bytes:dump.length,limitation:"Native Chatwoot database only; no attachment/Redis/host recovery claim.",manifest:after},null,2));
console.log("PASS actual Chatwoot database restore: "+Object.keys(after).length+" tables and content hashes");
