import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

const binary = process.env.LOCAL_CADDY_BIN;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
test("real Caddy routing against an isolated mock Chatwoot", { skip: !binary }, async (t) => {
  const requests = [];
  const mock = http.createServer((req, res) => {
    requests.push(req.url);
    res.setHeader("Server", "mock-chatwoot");
    res.end("mock inbox");
  });
  mock.on("upgrade", (req, socket) => {
    requests.push(req.url);
    socket.end("HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n");
  });
  await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
  const mockPort = mock.address().port;
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const proxyPort = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "os-plus-caddy-test-"));
  const config = fs.readFileSync(path.join(root, "deploy/chatwoot/Caddyfile"), "utf8").replace("rails:3000", `127.0.0.1:${mockPort}`);
  const configPath = path.join(work, "Caddyfile");
  fs.writeFileSync(configPath, config);
  const child = spawn(binary, ["run", "--config", configPath, "--adapter", "caddyfile"], {
    env: { ...process.env, CHAT_HOST: `http://127.0.0.1:${proxyPort}`, ACME_EMAIL: "operator@example.invalid" },
    stdio: ["ignore", "ignore", "pipe"],
    windowsHide: true,
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  const exited = new Promise((resolve) => child.once("exit", resolve));
  t.after(async () => {
    child.kill();
    await Promise.race([exited, delay(2000)]);
    if (child.exitCode === null) child.kill("SIGKILL");
    mock.closeAllConnections();
    await new Promise((resolve) => mock.close(resolve));
    fs.rmSync(work, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${proxyPort}`;
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { await fetch(`${base}/crm`); ready = true; break; } catch { await delay(100); }
  }
  assert.equal(ready, true, `Proxy did not start: ${stderr}`);
  await t.test("CRM namespace fails closed without reaching Chatwoot", async () => {
    requests.length = 0;
    for (const route of ["/crm", "/crm/leads", "/crm/leads?token=synthetic"]) {
      const response = await fetch(base + route);
      assert.equal(response.status, 503);
      assert.equal(await response.text(), "This workspace is being prepared. Please contact your team.");
    }
    assert.deepEqual(requests, []);
  });
  await t.test("inbox path/query are preserved and server header is removed", async () => {
    requests.length = 0;
    const response = await fetch(base + "/app/accounts/1?filter=synthetic");
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "mock inbox");
    assert.deepEqual(requests, ["/app/accounts/1?filter=synthetic"]);
    assert.equal(response.headers.get("server"), null);
  });
  await t.test("WebSocket upgrade is forwarded", async () => {
    await new Promise((resolve, reject) => {
      const req = http.request(base + "/cable?token=synthetic", {
        headers: { Connection: "Upgrade", Upgrade: "websocket" },
      });
      req.once("upgrade", (res, socket) => {
        socket.destroy();
        try { assert.equal(res.statusCode, 101); resolve(); } catch (error) { reject(error); }
      });
      req.once("response", (res) => { res.resume(); reject(new Error(`Expected upgrade, got ${res.statusCode}`)); });
      req.once("error", reject);
      req.setTimeout(3000, () => req.destroy(new Error("Upgrade timed out")));
      req.end();
    });
  });
});
