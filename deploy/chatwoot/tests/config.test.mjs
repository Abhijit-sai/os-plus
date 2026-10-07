import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parseEnv, validateDeployment } from "../scripts/check-config.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const example = parseEnv(fs.readFileSync(path.join(repo, "deploy/chatwoot/.env.example"), "utf8"));
const secretFields = [
  "CW_SECRET_KEY_BASE", "CW_ENCRYPTION_PRIMARY_KEY", "CW_ENCRYPTION_DETERMINISTIC_KEY",
  "CW_ENCRYPTION_SALT", "CW_DB_PASSWORD", "CW_REDIS_PASSWORD",
  "N8N_DB_ADMIN_PASSWORD", "N8N_DB_PASSWORD", "N8N_ENCRYPTION_KEY",
];
function syntheticEnv() {
  const result = { ...example };
  secretFields.forEach((key, index) => { result[key] = String(index + 1).repeat(64); });
  return result;
}

test("valid isolated config; prepare ignored Compose fixture", () => {
  const fixture = syntheticEnv();
  assert.equal(validateDeployment(fixture, { allowExampleHost: true }).CHAT_HOST, example.CHAT_HOST);
  const output = path.join(repo, "outputs/chat-ch0");
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, "example.env"), Object.entries(fixture).map(([key, value]) => `${key}=${value}`).join("\n") + "\n", { mode: 0o600 });
});
test("example host cannot pass live preflight", () => {
  assert.throws(() => validateDeployment(syntheticEnv()), /Replace example hostname/);
});
test("blank secrets fail", () => {
  assert.throws(() => validateDeployment({ ...syntheticEnv(), N8N_ENCRYPTION_KEY: "" }, { allowExampleHost: true }));
});
test("reusing a credential across services fails", () => {
  const config = syntheticEnv();
  config.N8N_DB_PASSWORD = config.CW_DB_PASSWORD;
  assert.throws(() => validateDeployment(config, { allowExampleHost: true }), /independently generated/);
});
test("shell syntax in a password is rejected", () => {
  assert.throws(() => validateDeployment({ ...syntheticEnv(), CW_DB_PASSWORD: "$(bad)" }, { allowExampleHost: true }));
});
test("floating image versions are rejected", () => {
  for (const tag of ["latest", "latest-ce", "stable", "beta"]) {
    assert.throws(() => validateDeployment({ ...syntheticEnv(), CHATWOOT_IMAGE: `chatwoot/chatwoot:${tag}` }, { allowExampleHost: true }));
  }
});
test("hostname URL/path injection is rejected", () => {
  for (const value of ["https://chat.example.invalid", "chat.example.invalid/crm", "chat.example.invalid {"]) {
    assert.throws(() => validateDeployment({ ...syntheticEnv(), CHAT_HOST: value }, { allowExampleHost: true }));
  }
});
test("unknown timezone and out-of-range SMTP port fail", () => {
  for (const change of [{ SCHEDULER_TIMEZONE: "invalid-timezone" }, { SMTP_PORT: "65536" }]) {
    assert.throws(() => validateDeployment({ ...syntheticEnv(), ...change }, { allowExampleHost: true }));
  }
});
test("partially filled Meta app fails", () => {
  assert.throws(() => validateDeployment({ ...syntheticEnv(), FB_APP_ID: "synthetic" }, { allowExampleHost: true }));
});
test("duplicate, malformed and unknown env assignments fail", () => {
  assert.throws(() => parseEnv("A=1\nA=2"), /Invalid or duplicate/);
  assert.throws(() => parseEnv("export A=1"), /Invalid or duplicate/);
  assert.throws(() => validateDeployment({ ...syntheticEnv(), WHATSAPP_TOKEN: "bad" }, { allowExampleHost: true }));
});
test("inquiry sample has no prices, booking, links, model ids or credentials", () => {
  const pack = JSON.parse(fs.readFileSync(path.join(repo, "docs_chat/examples/new-business.pack.json"), "utf8"));
  assert.equal(pack.schemaVersion, 1);
  assert.deepEqual(pack.prices, []);
  assert.deepEqual(pack.areas, []);
  assert.equal(Object.hasOwn(pack, "booking"), false);
  assert.match(pack.brand.displayName, /Synthetic/);
  assert.equal(Object.keys(pack.locked).length, 7);
  assert.equal(/https?:|sk-|api.?token|fundry|zoho/i.test(JSON.stringify(pack)), false);
});
