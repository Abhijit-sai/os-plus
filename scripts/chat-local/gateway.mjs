import http from "node:http";
import { state, ports, project, safeSecretEqual } from "./common.mjs";
const s = await state();
const equal = safeSecretEqual;
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://127.0.0.1").pathname;
  if (pathname === "/__local/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ project, mode: "isolated-local" }));
    return;
  }
  if (
    pathname === "/__local/stop" &&
    req.method === "POST" &&
    equal(req.headers["x-local-control"], s.nonce)
  ) {
    res.end("Stopped");
    server.close();
    return;
  }
  if (!pathname.startsWith("/rest/v1/")) {
    res.writeHead(501);
    res.end("Only local database REST is provided.");
    return;
  }
  if (
    !equal(req.headers.apikey, s.anon) &&
    !equal(req.headers.apikey, s.service)
  ) {
    res.writeHead(401);
    res.end("Local API key required");
    return;
  }
  const headers = { ...req.headers, host: "127.0.0.1:" + ports.rest };
  delete headers.apikey;
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: ports.rest,
      path: req.url.slice("/rest/v1".length),
      method: req.method,
      headers,
      timeout: 30000,
    },
    (response) => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    },
  );
  upstream.on("timeout", () => upstream.destroy());
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502);
    res.end("Local API unavailable");
  });
  req.on("aborted", () => upstream.destroy());
  req.pipe(upstream);
});
server.listen(ports.gateway, "127.0.0.1", () =>
  console.log("Local database gateway ready on loopback port " + ports.gateway),
);
