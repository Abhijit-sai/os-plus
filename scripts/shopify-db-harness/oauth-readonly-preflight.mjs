// Only SELECTs inside a server-enforced read-only transaction.
// Credentials enter through the existing DPAPI wrapper's private stdin pipe.
import { Client } from "pg";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateInput } from "./private-backup-contract.mjs";

const report = { kind: "osplus-private-backup-report-v1", check: "oauth-readonly-preflight",
  status: "failed", productionWrites: false };
let db;
try {
  let size = 0; const parts = [];
  for await (const part of process.stdin) {
    size += part.length;
    if (size > 65536) throw new Error("INPUT_LIMIT");
    parts.push(part);
  }
  const access = validateInput(JSON.parse(Buffer.concat(parts).toString("utf8")));
  if (access.mode !== "Inspect") throw new Error("READ_ONLY_REQUIRED");
  const proposal = await readFile(new URL("../../docs/sql/20261020180000_shopify_oauth_credentials.proposed.sql", import.meta.url), "utf8");
  report.proposalSha256 = createHash("sha256").update(proposal).digest("hex");
  const expectedBody = proposal.match(/returns jsonb language plpgsql security definer set search_path=public,pg_temp as \$\$([\s\S]*?)end \$\$;/)?.[1] + "end ";
  if (!expectedBody.startsWith("\ndeclare")) throw new Error("PROPOSAL_INVALID");
  db = new Client({ host: access.host, port: access.port, database: access.database,
    user: access.user, password: access.password,
    ssl: { ca: access.ca, rejectUnauthorized: true, minVersion: "TLSv1.2" },
    application_name: "osplus_oauth_readonly_preflight", connectionTimeoutMillis: 10000,
    statement_timeout: 10000, query_timeout: 15000, lock_timeout: 1000,
    options: "-c default_transaction_read_only=on -c idle_in_transaction_session_timeout=30000" });
  db.on("error", () => {});
  await db.connect(); access.password = null;
  await db.query("begin isolation level repeatable read read only");
  report.readOnly = (await db.query("select current_setting('transaction_read_only') as value")).rows[0].value === "on";
  if (!report.readOnly) throw new Error("READ_ONLY_REQUIRED");
  const fn = (await db.query(`select prosrc,prosecdef,proconfig,pg_get_userbyid(proowner) as owner
    from pg_proc where oid=to_regprocedure('public.shopify_oauth_storage(uuid,text,text,jsonb)')`)).rows[0];
  const normalize = text => text.replace(/\r\n/g, "\n").trim();
  report.functionMatches = !!fn && normalize(fn.prosrc) === normalize(expectedBody);
  report.functionSecurity = !!fn && fn.prosecdef && fn.owner === "postgres" &&
    fn.proconfig?.includes("search_path=public, pg_temp");
  report.tables = (await db.query(`select relname,relrowsecurity,pg_get_userbyid(relowner) as owner,
    (select count(*)::int from pg_policy where polrelid=c.oid) as policies
    from pg_class c where oid in (to_regclass('public.shopify_oauth_attempts'),to_regclass('public.shopify_oauth_credentials'))
    order by relname`)).rows;
  report.permissions = (await db.query(`select r.name as role,
    has_function_privilege(r.name,'public.shopify_oauth_storage(uuid,text,text,jsonb)','EXECUTE') as execute,
    has_table_privilege(r.name,'public.shopify_oauth_credentials','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as credential_access,
    has_table_privilege(r.name,'public.shopify_oauth_attempts','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as attempt_access
    from (values ('anon'),('authenticated'),('service_role')) as r(name)`)).rows;
  const tenant = "7be40f50-94a0-46c5-af57-7eea5e36ea8a";
  report.test = (await db.query(`select
    (select count(*)::int from public.shopify_connections where tenant_id=$1 and environment='production' and status='verified'
      and canonical_domain='n1djr1-99.myshopify.com') as verified_connections,
    (select count(*)::int from public.shopify_oauth_credentials where tenant_id=$1) as oauth_credentials,
    (select count(*)::int from public.shopify_unified_policies where tenant_id=$1 and automatic_enabled) as automatic_connections,
    (select count(*)::int from public.shopify_sync_jobs where tenant_id=$1 and requested_generation>completed_generation) as pending_jobs,
    (select count(*)::int from public.shopify_sync_jobs where tenant_id=$1 and lease_token is not null) as leased_jobs`, [tenant])).rows[0];
  await db.query("rollback");
  report.status = report.functionMatches && report.functionSecurity &&
    report.tables.length === 2 && report.tables.every(t => t.relrowsecurity && t.owner === "postgres" && t.policies === 0) &&
    report.permissions.every(p => p.execute === (p.role === "service_role") && !p.credential_access && !p.attempt_access)
    ? "passed" : "review_required";
} catch (error) {
  report.code = /^[A-Z_]+$/.test(error.message ?? "") ? error.message : "READONLY_CHECK_FAILED";
  if (/^[A-Z0-9]{5}$/.test(error.code ?? "")) report.sqlState = error.code;
  process.exitCode = 1;
} finally {
  await db?.end().catch(() => {});
  process.stdout.write(JSON.stringify(report));
}
