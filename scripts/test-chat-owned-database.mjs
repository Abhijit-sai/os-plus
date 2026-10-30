import { test } from "node:test";
import assert from "node:assert/strict";
import { startOwnedChatDatabase } from "./chat-db-harness/owned-database.mjs";
test("unattested database is closed before any mutation",async()=>{
  const queries=[];let ended=false;
  class Client {
    async connect(){}
    async query(sql){queries.push(sql);return {rows:[{nonce:"wrong",database:"postgres",user:"postgres"}]};}
    async end(){ended=true;}
  }
  await assert.rejects(startOwnedChatDatabase("a".repeat(24),"b".repeat(64),Client),/OWNED_DATABASE_ATTESTATION_FAILED/);
  assert.equal(ended,true);
  assert.equal(queries.length,1);
  assert.ok(queries.every(sql=>/^SELECT /.test(sql)));
});
