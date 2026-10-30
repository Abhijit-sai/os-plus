import { randomBytes } from "node:crypto";
import pg from "../shopify-db-harness/node_modules/pg/lib/index.js";
import { applyChatMigrations } from "./migrate.mjs";

// Only the internal-network alias created by the isolated runner. No URL, app
// env file, arbitrary host, production credential or Docker override is accepted.
export async function startOwnedChatDatabase(nonce,password,Client=pg.Client){
  if(!/^[a-f0-9]{24}$/.test(nonce??"") || !/^[a-f0-9]{64}$/.test(password??""))
    throw new Error("OWNED_DATABASE_INPUT_INVALID");
  const options={host:"osplus-chat-qa-db",port:5432,user:"postgres",password,
    connectionTimeoutMillis:3000,statement_timeout:10000,lock_timeout:4000};
  const control=new Client({...options,database:"postgres"});
  const clients=[];
  const database="chat_qa_"+nonce+"_"+randomBytes(6).toString("hex");
  let created=false,closed=false;
  const attest=async()=>{
    const row=(await control.query("SELECT current_setting('osplus.test_nonce',true) nonce,current_database() database,current_user AS user")).rows[0];
    if(row?.nonce!==nonce || row.database!=="postgres" || row.user!=="postgres")
      throw new Error("OWNED_DATABASE_ATTESTATION_FAILED");
  };
  const stop=async()=>{
    if(closed)return;closed=true;
    await Promise.allSettled(clients.map(c=>c.end()));
    try{
      if(created){
        await attest();
        const row=(await control.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=$1",[database])).rows[0];
        if(row?.marker!==nonce)throw new Error("OWNED_DATABASE_CLEANUP_REFUSED");
        await control.query('DROP DATABASE "'+database+'" WITH (FORCE)');
      }
    }finally{await control.end();}
  };
  try{
    await control.connect();
    await attest();
    const roles=(await control.query("SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') ORDER BY rolname")).rows;
    if(roles.length!==3 || roles.some(x=>x.rolsuper || x.rolbypassrls!==(x.rolname==="service_role")))
      throw new Error("OWNED_DATABASE_ROLES_INVALID");
    await control.query('CREATE DATABASE "'+database+'"');created=true;
    await control.query('COMMENT ON DATABASE "'+database+'" IS '+"'"+nonce+"'");
    const connect=async()=>{
      const client=new Client({...options,database});
      clients.push(client);await client.connect();return client;
    };
    const db=await connect();
    await db.query(`CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
      CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;
      GRANT USAGE ON SCHEMA extensions TO anon,authenticated,service_role;
      SET search_path=public,extensions;`);
    await applyChatMigrations(db,{ownedRelease:true,rolesPrepared:true});
    return {db,connect,stop};
  }catch(error){await stop();throw error;}
}
