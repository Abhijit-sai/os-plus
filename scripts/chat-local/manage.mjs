import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  cp,
  symlink,
  lstat,
  readlink,
  open,
} from "node:fs/promises";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  root,
  runtime,
  ports,
  project,
  state,
  exists,
  command,
  compose,
  verifyContainer,
  connect,
  cleanEnvironment,
  parseClerk,
} from "./common.mjs";
import { applyChatMigrations } from "../chat-db-harness/migrate.mjs";
import { seed } from "./seed.mjs";
const operation = process.argv[2] ?? "status";
const s = await state(operation === "up");
async function ownedResources() {
  const resources = [
    ["container", "ps", ["-a"], project + "-db"],
    ["container", "ps", ["-a"], project + "-rest"],
    ["volume", "volume", ["ls"], project + "_data"],
    ["network", "network", ["ls"], project + "_default"],
  ];
  for (const [kind, cmd, args, name] of resources) {
    const names = (
      await command("docker", [
        cmd,
        ...args,
        "--format",
        kind === "container" ? "{{.Names}}" : "{{.Name}}",
      ])
    ).split(/\r?\n/);
    if (!names.includes(name)) continue;
    const field = kind === "container" ? ".Config.Labels" : ".Labels";
    const owner = await command("docker", [
      kind,
      "inspect",
      "--format",
      "{{index " + field + ' "osplus.chat.local"}}',
      name,
    ]);
    if (owner !== s.nonce)
      throw new Error(
        "Existing local resource has different ownership; nothing changed.",
      );
  }
}
async function health() {
  try {
    const response = await fetch(
      "http://127.0.0.1:" + ports.gateway + "/__local/health",
      { signal: AbortSignal.timeout(1500) },
    );
    return response.ok && (await response.json()).project === project;
  } catch {
    return false;
  }
}
async function waitFor(fn) {
  for (let n = 0; n < 40; n++) {
    try {
      if (await fn()) return;
    } catch {}
    await delay(500);
  }
  throw new Error(
    "Local service did not become ready. Inspect its private local logs.",
  );
}
async function snapshot() {
  const target = path.join(runtime, "app-" + Date.now());
  await mkdir(target, { recursive: true });
  const files = [
    "src",
    "public",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "next-env.d.ts",
    "postcss.config.mjs",
    "postcss.config.js",
    "tailwind.config.ts",
    "next.config.ts",
  ];
  const hashes = {};
  async function digest(folder, prefix = "") {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const relative = path.join(prefix, entry.name),
        absolute = path.join(folder, entry.name);
      if (entry.isDirectory()) await digest(absolute, relative);
      else if (entry.isFile())
        hashes[relative] = createHash("sha256")
          .update(await readFile(absolute))
          .digest("hex");
    }
  }
  for (const file of files)
    if (await exists(path.join(root, file)))
      await cp(path.join(root, file), path.join(target, file), {
        recursive: true,
        force: true,
      });
  const modules = path.join(target, "node_modules");
  if (!(await exists(modules)))
    await symlink(path.join(root, "node_modules"), modules, "junction");
  else if (
    !(await lstat(modules)).isSymbolicLink() ||
    path.resolve(await readlink(modules)) !== path.resolve(root, "node_modules")
  )
    throw new Error("Unexpected snapshot dependency directory.");
  await digest(path.join(target, "src"), "src");
  await writeFile(
    path.join(runtime, "snapshot-manifest.json"),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        source: root,
        snapshot: target,
        hashes,
      },
      null,
      2,
    ),
  );
  return target;
}
if (operation === "up") {
  await ownedResources();
  await writeFile(
    path.join(runtime, "compose.env"),
    "LOCAL_PROJECT=" +
      project +
      "\nLOCAL_NONCE=" +
      s.nonce +
      "\nLOCAL_DB_PASSWORD=" +
      s.password +
      "\nLOCAL_JWT_SECRET=" +
      s.jwtSecret +
      "\n",
    { mode: 0o600 },
  );
  await compose(s, "up", "-d", "db");
  let db;
  await waitFor(async () => {
    db = await connect(s);
    return true;
  });
  try {
    await db.query("select pg_advisory_lock(870123451)");
    const folder = path.join(root, "supabase", "migrations");
    const names = (await readdir(folder))
      .filter((n) => n.endsWith(".sql"))
      .sort();
    const hash = createHash("sha256");
    for (const name of names) {
      hash.update(name);
      hash.update(await readFile(path.join(folder, name)));
    }
    const checksum = hash.digest("hex");
    const marker = await db.query(
      "select to_regclass('local_qa.schema_version') as marker",
    );
    if (!marker.rows[0].marker) {
      const tables = await db.query(
        "select count(*)::int as n from information_schema.tables where table_schema='public'",
      );
      if (tables.rows[0].n !== 0)
        throw new Error(
          "Unmarked database is not fresh; refusing to replay migrations.",
        );
      await applyChatMigrations(db);
      await db.query(
        "create role authenticator login noinherit password '" +
          s.password +
          "'; grant anon,authenticated,service_role to authenticator",
      );
      await db.query(
        "create schema local_qa; revoke all on schema local_qa from public; create table local_qa.schema_version(checksum text not null)",
      );
      await db.query("insert into local_qa.schema_version values($1)", [
        checksum,
      ]);
    } else {
      const recorded = await db.query(
        "select checksum from local_qa.schema_version",
      );
      if (recorded.rows[0]?.checksum !== checksum)
        throw new Error(
          "Migration source changed. Preserve this environment and review an explicit local upgrade plan.",
        );
    }
    await seed(db, s);
  } finally {
    await db.end();
  }
  await compose(s, "up", "-d", "rest");
  await waitFor(async () => {
    const r = await fetch("http://127.0.0.1:" + ports.rest + "/", {
      signal: AbortSignal.timeout(1500),
    });
    return r.ok;
  });
  if (!(await health())) {
    const log = await open(path.join(runtime, "gateway.log"), "a");
    const child = spawn(
      process.execPath,
      [path.join(root, "scripts/chat-local/gateway.mjs")],
      {
        cwd: root,
        env: cleanEnvironment(),
        detached: true,
        windowsHide: true,
        stdio: ["ignore", log.fd, log.fd],
      },
    );
    child.unref();
    await log.close();
    await waitFor(health);
  }
  await snapshot();
  console.log(
    "Local database/API ready. Synthetic data retained on restart. App snapshot prepared.",
  );
  console.log(
    "Next: fill outputs/chat-local/clerk.env with DEVELOPMENT keys, then run app.",
  );
} else if (operation === "app") {
  const clerk = parseClerk(
    await readFile(path.join(runtime, "clerk.env"), "utf8"),
  );
  if (!(await health())) throw new Error("Run up before app.");
  await verifyContainer(s, "db");
  await verifyContainer(s, "rest");
  const target = await snapshot();
  // Only allowlisted environment reaches Next: production environment files are never copied.
  const env = {
    ...cleanEnvironment(),
    ...clerk,
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:" + ports.gateway,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: s.anon,
    SUPABASE_SERVICE_ROLE_KEY: s.service,
    CHAT_FOUNDATION_ENABLED: "true",
    CHATWOOT_BASE_URL: "https://chatwoot.example.invalid",
    CHAT_WEBHOOK_ORIGIN: "https://app.example.invalid",
    CHAT_DRY_RUN: "true",
    CHAT_ADMIN_LIVE_ENABLED: "false",
    CHAT_SECRETS_KEYS: JSON.stringify({ v1: s.chatKey }),
    CHAT_SECRETS_ACTIVE_VERSION: "v1",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
    NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: "/select-tenant",
    NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: "/select-tenant",
    NEXT_PUBLIC_APP_URL: "http://localhost:" + ports.app,
  };
  const child = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "dev",
      "--webpack",
      "--hostname",
      "localhost",
      "--port",
      String(ports.app),
    ],
    { cwd: target, env, windowsHide: true, stdio: "inherit" },
  );
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
} else if (operation === "stop") {
  await ownedResources();
  if (await health())
    await fetch("http://127.0.0.1:" + ports.gateway + "/__local/stop", {
      method: "POST",
      headers: { "x-local-control": s.nonce },
    });
  await compose(s, "stop");
  console.log(
    "Owned local services stopped. Data retained. Stop the app terminal separately with Ctrl+C.",
  );
} else if (operation === "status") {
  await verifyContainer(s, "db");
  await verifyContainer(s, "rest");
  console.log(
    JSON.stringify(
      {
        project,
        gatewayReady: await health(),
        database: "127.0.0.1:" + ports.db,
        app: "http://localhost:" + ports.app,
        clerkKeys: "not printed",
      },
      null,
      2,
    ),
  );
} else throw new Error("Usage: manage.mjs up | app | status | stop");
