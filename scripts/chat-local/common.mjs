import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { spawn } from "node:child_process";
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "../shopify-db-harness/node_modules/pg/lib/index.js";
export const root = fileURLToPath(new URL("../../", import.meta.url));
export const runtime = path.join(root, "outputs", "chat-local");
export const project =
  "osplus-chat-local-" +
  createHash("sha256").update(root.toLowerCase()).digest("hex").slice(0, 10);
export const ports = { db: 15437, rest: 15438, gateway: 15439, app: 4131 };
export const stateFile = path.join(runtime, "private.json");
export const exists = async (p) =>
  access(p).then(
    () => true,
    () => false,
  );
export function jwt(role, secret) {
  const b = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const msg =
    b({ alg: "HS256", typ: "JWT" }) +
    "." +
    b({
      role,
      iss: "osplus-local-qa",
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    });
  return (
    msg + "." + createHmac("sha256", secret).update(msg).digest("base64url")
  );
}
export async function state(create = false) {
  if (!(await exists(stateFile))) {
    if (!create)
      throw new Error("Local environment is not prepared. Run up first.");
    await mkdir(runtime, { recursive: true });
    const secret = randomBytes(48).toString("hex");
    const value = {
      root,
      project,
      nonce: randomBytes(24).toString("hex"),
      password: randomBytes(32).toString("hex"),
      jwtSecret: secret,
      anon: jwt("anon", secret),
      service: jwt("service_role", secret),
      chatKey: randomBytes(32).toString("base64"),
    };
    await writeFile(stateFile, JSON.stringify(value, null, 2), {
      mode: 0o600,
      flag: "wx",
    });
    await writeFile(
      path.join(runtime, "clerk.env"),
      "# Use one Clerk DEVELOPMENT instance only. Never paste keys into chat.\nNEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=\nCLERK_SECRET_KEY=\nOS_PLUS_SUPER_ADMIN_CLERK_USER_IDS=\n",
      { mode: 0o600, flag: "wx" },
    );
  }
  const value = JSON.parse(await readFile(stateFile, "utf8"));
  if (
    value.root !== root ||
    value.project !== project ||
    !/^[a-f0-9]{48}$/.test(value.nonce) ||
    !/^[a-f0-9]{64}$/.test(value.password) ||
    !/^[a-f0-9]{96}$/.test(value.jwtSecret) ||
    !/^[A-Za-z0-9+/]{43}=$/.test(value.chatKey)
  )
    throw new Error("Local environment ownership mismatch.");
  return value;
}
function rawCommand(
  file,
  args,
  { input, env, cwd = root, binary = false } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      cwd,
      env,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const out = [],
      err = [];
    child.stdout.on("data", (b) => out.push(b));
    child.stderr.on("data", (b) => err.push(b));
    const timer = setTimeout(() => child.kill(), 120000);
    child.on("error", () => {
      clearTimeout(timer);
      reject(new Error(file + " unavailable"));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0)
        resolve(
          binary ? Buffer.concat(out) : Buffer.concat(out).toString().trim(),
        );
      else
        reject(
          new Error(
            file +
              " failed (exit " +
              code +
              "). Inspect local logs; arguments/credentials are not printed.",
          ),
        );
    });
    child.stdin.end(input);
  });
}
export function safeSecretEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function requireLocalEndpoint(endpoint) {
  if (
    typeof endpoint !== "string" ||
    !(
      /^npipe:\/\/(?:\/\/)?\.\/pipe\/[A-Za-z0-9_.-]+$/.test(endpoint) ||
      /^unix:\/\/\/(?!\/)[^\\\s?#]+$/.test(endpoint)
    )
  )
    throw new Error(
      "A local Docker engine is required; remote and TCP endpoints are refused.",
    );
  return endpoint;
}
export async function localDockerCommand(
  args,
  options = {},
  execute = rawCommand,
) {
  if (args.some((arg) => /^(?:--(?:host|context)(?:=|$)|-[Hc])/.test(arg)))
    throw new Error(
      "Use the validated local Docker engine; endpoint argument overrides are refused.",
    );
  // Windows environment names are case-insensitive; normalize both Docker selectors.
  const source = Object.fromEntries(
    Object.entries(options.env ?? process.env).map(([key, value]) => [
      /^DOCKER_(HOST|CONTEXT)$/i.test(key) ? key.toUpperCase() : key,
      value,
    ]),
  );
  // Context inspection reads local metadata only. Never contact a selected engine before validation.
  if (source.DOCKER_HOST) requireLocalEndpoint(source.DOCKER_HOST);
  const context = source.DOCKER_CONTEXT;
  if (context && !/^[A-Za-z0-9_.-]+$/.test(context))
    throw new Error("Invalid local Docker context name.");
  const endpoint = requireLocalEndpoint(
    source.DOCKER_HOST && !context
      ? source.DOCKER_HOST
      : await execute(
          "docker",
          [
            "context",
            "inspect",
            ...(context ? [context] : []),
            "--format",
            "{{.Endpoints.docker.Host}}",
          ],
          { ...options, input: undefined, binary: false, env: source },
        ),
  );
  const env = { ...source };
  delete env.DOCKER_CONTEXT;
  delete env.DOCKER_HOST;
  // Pin the checked endpoint so a context change cannot redirect a subsequent mutation.
  return execute("docker", ["--host", endpoint, ...args], { ...options, env });
}
export async function command(file, args, options = {}) {
  return file === "docker"
    ? localDockerCommand(args, options)
    : rawCommand(file, args, options);
}
export async function compose(s, ...args) {
  return command("docker", [
    "compose",
    "--project-name",
    project,
    "--env-file",
    path.join(runtime, "compose.env"),
    "-f",
    path.join(root, "scripts/chat-local/compose.yaml"),
    ...args,
  ]);
}
export async function verifyContainer(s, service) {
  const name = project + "-" + service;
  const owner = await command("docker", [
    "inspect",
    "--format",
    '{{index .Config.Labels "osplus.chat.local"}}',
    name,
  ]);
  if (owner !== s.nonce)
    throw new Error(
      "Refuse to operate on a container not owned by this local environment.",
    );
  return name;
}
export async function connect(s, database = "postgres") {
  if (!/^postgres$|^chat_restore_[a-f0-9]{12}$/.test(database))
    throw new Error("Invalid local database");
  await verifyContainer(s, "db");
  const db = new pg.Client({
    host: "127.0.0.1",
    port: ports.db,
    user: "postgres",
    password: s.password,
    database,
    connectionTimeoutMillis: 3000,
    statement_timeout: 30000,
  });
  try {
    await db.connect();
  } catch (error) {
    await db.end();
    throw error;
  }
  return db;
}
export function cleanEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) =>
      /^(PATH|Path|SystemRoot|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA|NUMBER_OF_PROCESSORS)$/i.test(
        key,
      ),
    ),
  );
}
export function parseClerk(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  const allowed = [
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "OS_PLUS_SUPER_ADMIN_CLERK_USER_IDS",
  ];
  if (Object.keys(env).some((k) => !allowed.includes(k)))
    throw new Error("Unexpected local Clerk configuration entry.");
  if (
    !env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_") ||
    !env.CLERK_SECRET_KEY?.startsWith("sk_test_")
  )
    throw new Error(
      "Clerk development keys are required in outputs/chat-local/clerk.env; production keys are rejected.",
    );
  return env;
}
