import assert from "node:assert/strict";
import { test } from "node:test";
import { parseClerk, cleanEnvironment, jwt } from "./chat-local/common.mjs";
test("local acceptance launcher rejects production, missing and unexpected Clerk configuration", () => {
  assert.throws(
    () =>
      parseClerk(
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_no\nCLERK_SECRET_KEY=sk_test_no",
      ),
    /development/,
  );
  assert.throws(
    () =>
      parseClerk(
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_no\nCLERK_SECRET_KEY=sk_live_no",
      ),
    /development/,
  );
  assert.throws(() => parseClerk(""), /development/);
  assert.throws(
    () =>
      parseClerk(
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_no\nCLERK_SECRET_KEY=sk_test_no\nSUPABASE_SERVICE_ROLE_KEY=no",
      ),
    /Unexpected/,
  );
  assert.equal(
    parseClerk(
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_example\nCLERK_SECRET_KEY=sk_test_example",
    ).CLERK_SECRET_KEY,
    "sk_test_example",
  );
});
test("local app environment drops inherited production endpoints, keys and feature flags", () => {
  const saved = { ...process.env };
  try {
    Object.assign(process.env, {
      SUPABASE_SERVICE_ROLE_KEY: "synthetic",
      CLERK_SECRET_KEY: "sk_live_synthetic",
      CHAT_ADMIN_LIVE_ENABLED: "true",
      NODE_OPTIONS: "--require unsafe",
      OPENROUTER_API_KEY: "synthetic",
    });
    const env = cleanEnvironment();
    for (const k of [
      "SUPABASE_SERVICE_ROLE_KEY",
      "CLERK_SECRET_KEY",
      "CHAT_ADMIN_LIVE_ENABLED",
      "NODE_OPTIONS",
      "OPENROUTER_API_KEY",
    ])
      assert.equal(env[k], undefined);
  } finally {
    for (const k of Object.keys(process.env))
      if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});
test("local JWT encodes only the intended database role and an expiry", () => {
  const payload = JSON.parse(
    Buffer.from(
      jwt("anon", "synthetic-long-test-secret").split(".")[1],
      "base64url",
    ),
  );
  assert.equal(payload.role, "anon");
  assert.ok(payload.exp > Date.now() / 1000);
  assert.equal(payload.iss, "osplus-local-qa");
});

test("local Docker rejects remote contexts and host overrides before any engine operation", async () => {
  const { localDockerCommand } = await import("./chat-local/common.mjs");
  for (const scenario of [
    { env: {}, endpoint: "ssh://remote.example.invalid" },
    { env: {}, endpoint: "tcp://127.0.0.1:2375" },
    {
      env: { DOCKER_HOST: "tcp://remote.example.invalid:2376" },
      endpoint: "npipe:////./pipe/docker_engine",
    },
    {
      env: { DOCKER_CONTEXT: "remote" },
      endpoint: "ssh://remote.example.invalid",
    },
  ]) {
    const calls = [];
    const execute = async (file, args) => {
      calls.push(args);
      return scenario.endpoint;
    };
    await assert.rejects(
      () =>
        localDockerCommand(
          ["compose", "up", "-d"],
          { env: scenario.env },
          execute,
        ),
      /local Docker/,
    );
    assert.ok(
      calls.every((args) => args[0] === "context" && args[1] === "inspect"),
    );
  }
});
test("local Docker pins a validated engine and removes ambient endpoint overrides", async () => {
  const { localDockerCommand } = await import("./chat-local/common.mjs");
  for (const endpoint of [
    "npipe:////./pipe/dockerDesktopLinuxEngine",
    "unix:///var/run/docker.sock",
  ]) {
    const calls = [];
    const execute = async (file, args, options) => {
      calls.push({ args, env: options.env });
      return args[0] === "context" ? endpoint : "ok";
    };
    assert.equal(
      await localDockerCommand(
        ["compose", "up", "-d"],
        { env: { DOCKER_CONTEXT: "desktop-linux", PATH: "synthetic" } },
        execute,
      ),
      "ok",
    );
    assert.deepEqual(calls[1].args, [
      "--host",
      endpoint,
      "compose",
      "up",
      "-d",
    ]);
    assert.equal(calls[1].env.DOCKER_CONTEXT, undefined);
    assert.equal(calls[1].env.DOCKER_HOST, undefined);
    await assert.rejects(
      () =>
        localDockerCommand(
          ["--host", "ssh://remote", "ps"],
          { env: {} },
          execute,
        ),
      /local Docker/,
    );
  }
});
test("malformed multibyte local gateway credentials reject without throwing", async () => {
  const { safeSecretEqual } = await import("./chat-local/common.mjs");
  assert.equal(safeSecretEqual("é".repeat(48), "a".repeat(48)), false);
  assert.equal(safeSecretEqual(undefined, "test"), false);
  assert.equal(safeSecretEqual(["test"], "test"), false);
  assert.equal(safeSecretEqual("test", "test"), true);
  assert.equal(safeSecretEqual("test", "nope"), false);
});

test("local Docker handles Windows environment casing and compact host flags safely", async () => {
  const { localDockerCommand } = await import("./chat-local/common.mjs");
  await assert.rejects(
    () =>
      localDockerCommand(
        ["ps"],
        { env: { docker_host: "ssh://remote.example.invalid" } },
        async () => {
          throw new Error("should not execute");
        },
      ),
    /local Docker/,
  );
  await assert.rejects(
    () =>
      localDockerCommand(
        ["-Hssh://remote.example.invalid", "ps"],
        { env: {} },
        async () => {
          throw new Error("should not execute");
        },
      ),
    /local Docker/,
  );
  const calls = [];
  const execute = async (file, args, opts) => {
    calls.push({ args, env: opts.env });
    return args[0] === "context" ? "unix:///var/run/docker.sock" : "ok";
  };
  await localDockerCommand(
    ["ps"],
    { env: { docker_context: "desktop-linux" } },
    execute,
  );
  assert.ok(calls[0].args.includes("desktop-linux"));
  assert.ok(
    !Object.keys(calls[1].env).some((k) => /^DOCKER_(HOST|CONTEXT)$/i.test(k)),
  );
});
