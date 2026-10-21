import {test} from "node:test";
import assert from "node:assert/strict";
import {owned,project} from "./chatwoot-local/common.mjs";
test("local Chatwoot refuses exact-name collisions even without a Compose project label",async()=>{
 for(const [kind,name] of [["container",project+"-db-1"],["volume",project+"_db"],["network",project+"_private"]]){
  const commands=[];
  const execute=async(file,args)=>{commands.push(args);if(args.includes("inspect"))return "foreign";if((kind==="container"&&args[0]==="ps")||(args[0]===kind&&args[1]==="ls"))return name;return "";};
  await assert.rejects(()=>owned({nonce:"owned"},execute),/Foreign resource name collision/);
  assert.ok(commands.some(x=>x.includes("inspect")));
 }
});
test("local Chatwoot ownership accepts its nonce across exact names and project resources",async()=>{
 const execute=async(file,args)=>{if(args.includes("inspect"))return "owned";if(args[0]==="ps"&&args.includes("--format"))return project+"-db-1";if(args[0]==="volume"&&args[1]==="ls")return project+"_db";return "";};
 await owned({nonce:"owned"},execute);
});
