import test from "node:test";
import assert from "node:assert/strict";
import { render4GB } from "../scripts/prepare-4gb.mjs";
test("4GB deployment bundle preserves security and fits the application memory budget", () => {
  const config = render4GB();
  assert.equal(config["x-osplus-capacity"].applicationBudgetMiB, 3072);
  let total = 0;
  for (const [name, service] of Object.entries(config.services)) {
    assert.ok(service.mem_limit > 0, name);
    total += service.mem_limit;
    assert.equal(service.memswap_limit, service.mem_limit, name);
  }
  assert.ok(total <= 3072 * 1024 * 1024);
  assert.equal(config.services.sidekiq.environment.SIDEKIQ_CONCURRENCY, "1");
  assert.equal(
    config.services.n8n.environment.N8N_CONCURRENCY_PRODUCTION_LIMIT,
    "1",
  );
  assert.equal(
    config.services.n8n.environment.NODE_OPTIONS,
    "--max-old-space-size=256",
  );
  assert.equal(
    config.services.rails.environment.ENABLE_ACCOUNT_SIGNUP,
    "false",
  );
  assert.equal(config.services.rails.environment.FORCE_SSL, "true");
  assert.equal(
    config.services.rails.environment.FB_APP_SECRET,
    "${FB_APP_SECRET:-}",
  );
  assert.equal(
    config.services.rails.environment.POSTGRES_PASSWORD,
    "${CW_DB_PASSWORD:?Generate a database password}",
  );
  assert.deepEqual(config.services["cw-postgres"].ports ?? [], []);
  assert.deepEqual(config.services["n8n-postgres"].ports ?? [], []);
  assert.deepEqual(config.services.redis.ports ?? [], []);
  assert.equal(config.services.n8n.ports[0].host_ip, "127.0.0.1");
  for (const resource of [
    ...Object.values(config.volumes),
    ...Object.values(config.networks),
  ])
    assert.ok(
      !resource?.name,
      "Generated bundle must not freeze Docker resource names across projects",
    );
});

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { prepare4GB } from "../scripts/prepare-4gb.mjs";
import { parseEnv } from "../scripts/check-config.mjs";
const repo = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
test("standalone4GB bundle retains limits after ordinary Compose rendering and isolates project volumes", () => {
  const parent = fs.mkdtempSync(path.join(repo, "outputs", "pilot4gb-unit-"));
  try {
    const { target } = prepare4GB(path.join(parent, "bundle"));
    const values = parseEnv(
      fs.readFileSync(path.join(target, ".env.example"), "utf8"),
    );
    for (const [index, key] of [
      "CW_SECRET_KEY_BASE",
      "CW_ENCRYPTION_PRIMARY_KEY",
      "CW_ENCRYPTION_DETERMINISTIC_KEY",
      "CW_ENCRYPTION_SALT",
      "CW_DB_PASSWORD",
      "CW_REDIS_PASSWORD",
      "N8N_DB_ADMIN_PASSWORD",
      "N8N_DB_PASSWORD",
      "N8N_ENCRYPTION_KEY",
    ].entries())
      values[key] = String(index + 1).repeat(64);
    fs.writeFileSync(
      path.join(target, ".env"),
      Object.entries(values)
        .map(([key, value]) => key + "=" + value)
        .join("\n") + "\n",
      { mode: 0o600 },
    );
    const rendered = JSON.parse(
      execFileSync(
        "docker",
        [
          "compose",
          "-p",
          "osplus-pilot-export-unit",
          "--profile",
          "ops",
          "--env-file",
          path.join(target, ".env"),
          "-f",
          path.join(target, "compose.yaml"),
          "config",
          "--format",
          "json",
        ],
        {
          cwd: target,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        },
      ),
    );
    assert.equal(Number(rendered.services.rails.mem_limit), 896 * 1024 * 1024);
    assert.equal(
      Number(rendered.services.rails.memswap_limit),
      896 * 1024 * 1024,
    );
    assert.equal(
      rendered.services.rails.environment.POSTGRES_PASSWORD,
      values.CW_DB_PASSWORD,
    );
    assert.equal(
      rendered.services.sidekiq.environment.SIDEKIQ_CONCURRENCY,
      "1",
    );
    assert.equal(
      rendered.volumes["cw-postgres"].name,
      "osplus-pilot-export-unit_cw-postgres",
    );
    assert.equal(
      rendered.networks["cw-backend"].name,
      "osplus-pilot-export-unit_cw-backend",
    );
    assert.ok(
      rendered.services.redis.command.join(" ").includes("$REDIS_PASSWORD"),
    );
    // Existing backup/restore tools archive this exact standalone file, so the chosen limits travel with recovery.
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(target, "compose.yaml"), "utf8"))
        .services.rails.mem_limit,
      896 * 1024 * 1024,
    );
    for (const file of [
      "scripts/backup.sh",
      "scripts/verify-backup.sh",
      "scripts/check-backup.sh",
      "scripts/init-n8n-db.sh",
      "Caddyfile",
    ])
      assert.equal(
        fs.readFileSync(path.join(target, file), "utf8"),
        fs.readFileSync(path.join(repo, "deploy/chatwoot", file), "utf8"),
      );
    assert.throws(() => prepare4GB(target), /already exists/);
    assert.equal(
      fs
        .readFileSync(path.join(target, ".env"), "utf8")
        .includes(values.CW_DB_PASSWORD),
      true,
    );
  } finally {
    assert.equal(path.dirname(parent), path.join(repo, "outputs"));
    fs.rmSync(parent, { recursive: true });
  }
});
test("profile preparation never resolves secrets inherited from the operator environment", () => {
  const prior = process.env.CW_DB_PASSWORD;
  process.env.CW_DB_PASSWORD = "PARENT_SECRET_MUST_NOT_BE_EXPORTED";
  try {
    const config = render4GB();
    assert.ok(
      !JSON.stringify(config).includes("PARENT_SECRET_MUST_NOT_BE_EXPORTED"),
    );
  } finally {
    if (prior === undefined) delete process.env.CW_DB_PASSWORD;
    else process.env.CW_DB_PASSWORD = prior;
  }
});

test("separate standalone directories select distinct projects without a project override", () => {
  const parent = fs.mkdtempSync(
    path.join(repo, "outputs", "pilot4gb-default-project-"),
  );
  const env = { ...process.env };
  delete env.COMPOSE_PROJECT_NAME;
  delete env.COMPOSE_FILE;
  try {
    const configs = ["first-host", "second-host"].map((name) => {
      const { target } = prepare4GB(path.join(parent, name));
      const values = parseEnv(
        fs.readFileSync(path.join(target, ".env.example"), "utf8"),
      );
      for (const [index, key] of [
        "CW_SECRET_KEY_BASE",
        "CW_ENCRYPTION_PRIMARY_KEY",
        "CW_ENCRYPTION_DETERMINISTIC_KEY",
        "CW_ENCRYPTION_SALT",
        "CW_DB_PASSWORD",
        "CW_REDIS_PASSWORD",
        "N8N_DB_ADMIN_PASSWORD",
        "N8N_DB_PASSWORD",
        "N8N_ENCRYPTION_KEY",
      ].entries())
        values[key] = String(index + 1).repeat(64);
      const fixture = path.join(target, ".env");
      fs.writeFileSync(
        fixture,
        Object.entries(values)
          .map(([key, value]) => key + "=" + value)
          .join("\n") + "\n",
      );
      return JSON.parse(
        execFileSync(
          "docker",
          [
            "compose",
            "--env-file",
            fixture,
            "-f",
            path.join(target, "compose.yaml"),
            "config",
            "--format",
            "json",
          ],
          { cwd: target, env, encoding: "utf8", windowsHide: true },
        ),
      );
    });
    assert.notEqual(configs[0].name, configs[1].name);
    assert.notEqual(
      configs[0].volumes["cw-postgres"].name,
      configs[1].volumes["cw-postgres"].name,
    );
    assert.notEqual(
      configs[0].networks["cw-backend"].name,
      configs[1].networks["cw-backend"].name,
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
