import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const kit = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function render4GB() {
  let config;
  try {
    config = JSON.parse(
      execFileSync(
        "docker",
        [
          "compose",
          "--profile",
          "ops",
          "--env-file",
          path.join(kit, ".env.example"),
          "-f",
          path.join(kit, "compose.yaml"),
          "-f",
          path.join(kit, "compose.4gb.yaml"),
          "config",
          "--no-interpolate",
          "--no-env-resolution",
          "--no-path-resolution",
          "--format",
          "json",
        ],
        {
          cwd: kit,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        },
      ),
    );
  } catch {
    throw new Error(
      "Could not render the4GB deployment profile; inspect Compose availability and profile syntax.",
    );
  }
  // Let each standalone directory select its own project; the source kit has a fixed name.
  delete config.name;
  // Compose computes explicit names from the build directory. Remove those so different deployments remain isolated.
  for (const resource of [
    ...Object.values(config.volumes ?? {}),
    ...Object.values(config.networks ?? {}),
  ])
    if (resource) delete resource.name;
  for (const service of Object.values(config.services)) {
    if (Array.isArray(service.environment))
      service.environment = Object.fromEntries(
        service.environment.map((entry) => {
          const at = entry.indexOf("=");
          if (at < 1)
            throw new Error("Unresolved inherited environment variable.");
          return [entry.slice(0, at), entry.slice(at + 1)];
        }),
      );
    const bytes = (value) => {
      const match = /^([1-9][0-9]*)([mg])$/.exec(String(value));
      return match
        ? Number(match[1]) * 1024 ** (match[2] === "g" ? 3 : 2)
        : Number(value);
    };
    service.mem_limit = bytes(service.mem_limit);
    service.memswap_limit = bytes(service.memswap_limit);
    if (
      !Number.isSafeInteger(service.mem_limit) ||
      service.mem_limit <= 0 ||
      service.mem_limit !== service.memswap_limit
    )
      throw new Error("Missing or unbounded resource limit.");
  }
  const maximum = Object.values(config.services).reduce(
    (sum, service) => sum + service.mem_limit,
    0,
  );
  if (maximum > 3072 * 1024 * 1024)
    throw new Error("Profile exceeds the3GiB application budget.");
  config["x-osplus-capacity"] = {
    hostMiB: 4096,
    applicationBudgetMiB: 3072,
    reservedHostMiB: 1024,
  };
  return config;
}
export function prepare4GB(output) {
  const target = path.resolve(output);
  if (fs.existsSync(target))
    throw new Error(
      "Output directory already exists; refusing to overwrite any files.",
    );
  const config = render4GB();
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    path.join(target, "compose.yaml"),
    JSON.stringify(config, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  for (const file of [
    ".env.example",
    "Caddyfile",
    "backup.cron.example",
    "scripts/backup.sh",
    "scripts/verify-backup.sh",
    "scripts/check-backup.sh",
    "scripts/init-n8n-db.sh",
    "scripts/check-config.mjs",
  ]) {
    const dest = path.join(target, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(kit, file), dest, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(
      dest,
      file === "scripts/init-n8n-db.sh"
        ? 0o644
        : file.endsWith(".sh")
          ? 0o700
          : 0o600,
    );
  }
  fs.writeFileSync(
    path.join(target, "README.txt"),
    "OS PLUS constrained4GB pilot bundle. No credentials included. compose.yaml is JSON-format YAML.\n" +
      "Prepare a fresh owner-only .env from .env.example. Do not reuse any existing business environment.\n" +
      "Use ordinary docker compose commands in THIS directory. The compiled limits travel with backups/restores.\n" +
      "Prepare Chatwoot database BEFORE starting web/worker/n8n. Do not run a second Rails process while web/worker are running.\n" +
      "Read the repository deploy/chatwoot/README.md and docs_chat/CH10_4GB_PILOT.md before an authorized deployment.\n" +
      "This bundle is not evidence of server capacity, live acceptance or release approval. AI/STT remain disabled in OS PLUS.\n",
    { flag: "wx", mode: 0o600 },
  );
  return { target, config };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv.length !== 3)
      throw new Error(
        "Usage: node deploy/chatwoot/scripts/prepare-4gb.mjs NEW_OUTPUT_DIRECTORY",
      );
    const { target } = prepare4GB(process.argv[2]);
    console.log(
      "Created a fresh4GB pilot bundle: " + target + ". No credentials copied.",
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Profile preparation failed.",
    );
    process.exitCode = 1;
  }
}
