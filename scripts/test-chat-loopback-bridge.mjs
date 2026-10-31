import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, request } from "node:http";
test("IPv4 bridge reaches IPv6 loopback without altering Host/auth and refuses an occupied listener", async () => {
  const { startIpv4Bridge } = await import("./chat-local/ipv4-bridge.mjs");
  const target = createServer((req, res) =>
    res.end(
      JSON.stringify({
        host: req.headers.host,
        fixture: req.headers["x-fixture"],
      }),
    ),
  );
  await new Promise((resolve) => target.listen(0, "::1", resolve));
  let bridge;
  try {
    bridge = await startIpv4Bridge({
      port: 0,
      targetPort: target.address().port,
    });
    const response = await new Promise((resolve, reject) => {
      const req = request(
        {
          hostname: "127.0.0.1",
          port: bridge.port,
          path: "/",
          headers: { host: "localhost:4131", "x-fixture": "synthetic" },
        },
        (res) => {
          const parts = [];
          res.on("data", (part) => parts.push(part));
          res.on("end", () =>
            resolve(JSON.parse(Buffer.concat(parts).toString())),
          );
        },
      );
      req.on("error", reject);
      req.end();
    });
    assert.deepEqual(response, {
      host: "localhost:4131",
      fixture: "synthetic",
    });
    await assert.rejects(
      startIpv4Bridge({ port: bridge.port, targetPort: target.address().port }),
      { code: "EADDRINUSE" },
    );
    assert.equal((await fetch("http://127.0.0.1:" + bridge.port)).status, 200);
  } finally {
    await bridge?.close();
    await new Promise((resolve) => target.close(resolve));
  }
});

test("owned app launch rejects an occupied IPv6 target before starting a child or publishing IPv4", async () => {
  const { startOwnedLoopbackApp } =
    await import("./chat-local/ipv4-bridge.mjs");
  const foreign = createServer((req, res) => res.end("foreign"));
  await new Promise((resolve) => foreign.listen(0, "::1", resolve));
  let started = false;
  try {
    await assert.rejects(
      startOwnedLoopbackApp({
        port: 0,
        targetPort: foreign.address().port,
        start: async () => {
          started = true;
          throw new Error("Must not start");
        },
      }),
      { code: "EADDRINUSE" },
    );
    assert.equal(started, false);
  } finally {
    await new Promise((resolve) => foreign.close(resolve));
  }
});
