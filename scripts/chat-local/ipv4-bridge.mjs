import { createServer, createConnection } from "node:net";

/** Local QA only. Both ends are loopback; preserve HTTP Host, cookies and websocket bytes. */
export async function startIpv4Bridge({ port = 4131, targetPort = 4131 } = {}) {
  if (
    !Number.isInteger(port) ||
    port < 0 ||
    port > 65535 ||
    !Number.isInteger(targetPort) ||
    targetPort < 1 ||
    targetPort > 65535
  )
    throw new Error("Invalid local loopback port");
  const sockets = new Set();
  const server = createServer((client) => {
    const upstream = createConnection({ host: "::1", port: targetPort });
    sockets.add(client);
    sockets.add(upstream);
    const close = () => {
      client.destroy();
      upstream.destroy();
      sockets.delete(client);
      sockets.delete(upstream);
    };
    client.on("error", close);
    upstream.on("error", close);
    client.on("close", close);
    upstream.on("close", close);
    client.pipe(upstream);
    upstream.pipe(client);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    port: server.address().port,
    close: () =>
      new Promise((resolve, reject) => {
        for (const socket of sockets) socket.destroy();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

/** Reserve neither listener until a verified owned child reports readiness.
 * An unrelated process at the IPv6 target must never receive forwarded requests. */
export async function startOwnedLoopbackApp({
  port,
  targetPort = port,
  start,
}) {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(targetPort, "::1", resolve);
  });
  await new Promise((resolve) => probe.close(resolve));
  const child = await start();
  let bridge;
  try {
    await child.ready;
    bridge = await startIpv4Bridge({ port, targetPort });
  } catch (error) {
    await child.stop();
    throw error;
  }
  void child.exited
    .then(() => bridge.close())
    .catch(() => {
      process.exitCode = 1;
    });
  return {
    close: async () => {
      await child.stop();
    },
  };
}
