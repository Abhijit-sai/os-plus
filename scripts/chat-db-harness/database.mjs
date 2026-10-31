import assert from "node:assert/strict";
import { command } from "../chat-local/common.mjs";
import { randomBytes } from "node:crypto";
import { applyChatMigrations } from "./migrate.mjs";
import pg from "../shopify-db-harness/node_modules/pg/lib/index.js";

// Reuse the repository's locked pg test dependency; never read application .env files.
const image =
  "sha256:c7526c0f6c3f30260a563d7bcf8ad778effac59a44f8ffa86678c35418338609";
export async function startChatDatabase() {
  if (process.env.CHAT_TEST_OWNED_DATABASE_NONCE) {
    if(process.platform!=="linux" || process.env.CHAT_TEST_OWNED_DATABASE_MODE!=="isolated-internal-network")
      throw new Error("OWNED_DATABASE_RUNNER_REQUIRED");
    const {startOwnedChatDatabase}=await import("./owned-database.mjs");
    return startOwnedChatDatabase(process.env.CHAT_TEST_OWNED_DATABASE_NONCE,
      process.env.CHAT_TEST_OWNED_DATABASE_PASSWORD);
  }

  const nonce = randomBytes(12).toString("hex"),
    password = randomBytes(32).toString("hex");
  const name = "osplus-chat-test-" + nonce,
    label = "osplus.chat.disposable";
  const clients = [];
  const docker = (...args) => command("docker", args);
  let owned = false;
  const stop = async () => {
    await Promise.allSettled(clients.map((client) => client.end()));
    if (owned) {
      const actual = await docker(
        "inspect",
        "--format",
        `{{index .Config.Labels "${label}"}}`,
        name,
      );
      assert.equal(
        actual,
        nonce,
        "Refuse cleanup of a container not owned by this test",
      );
      await docker("rm", "-f", name);
    }
  };
  try {
    await docker(
      "run",
      "--rm",
      "-d",
      "--pull=never",
      "--name",
      name,
      "--label",
      label + "=" + nonce,
      "--memory",
      "1g",
      "--cpus",
      "2",
      "--tmpfs",
      "/var/lib/postgresql/data:rw,size=536870912",
      "-p",
      "127.0.0.1::5432",
      "-e",
      "POSTGRES_PASSWORD=" + password,
      "-e",
      "PGDATA=/var/lib/postgresql/data/pgdata",
      image,
    );
    owned = true;
    const published = await docker("port", name, "5432/tcp");
    assert.match(published, /^127\.0\.0\.1:\d+$/);
    const connect = async () => {
      const client = new pg.Client({
        host: "127.0.0.1",
        port: Number(published.split(":")[1]),
        user: "postgres",
        password,
        database: "postgres",
        ssl: false,
        connectionTimeoutMillis: 2000,
        statement_timeout: 10000,
        lock_timeout: 4000,
      });
      await client.connect();
      clients.push(client);
      return client;
    };
    let db;
    for (let n = 0; n < 40; n++) {
      try {
        db = await connect();
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    assert.ok(db, "Disposable PostgreSQL did not start");
    await applyChatMigrations(db);
    return { db, connect, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
