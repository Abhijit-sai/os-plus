import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const id = "67000000-0000-4000-8000-000000000001";
function nativeStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
}
function controllerWithAuth(create, options) {
  return create({
    ...options,
    coordinator: Object.hasOwn(options, "coordinator")
      ? options.coordinator
      : {
          claim: async () => ({ status: "claimed" }),
          record: async () => ({ status: "sent" }),
        },
    api: {
      ...options.api,
      get: async (url, ...args) =>
        url.endsWith("/profile")
          ? { data: { id: 55 } }
          : options.api.get(url, ...args),
    },
  });
}
const messages = () => [
  {
    id: 10,
    conversation_id: 10,
    message_type: 0,
    private: false,
    content: "Synthetic inquiry",
  },
  {
    id: 11,
    conversation_id: 10,
    message_type: 1,
    private: true,
    content: "💬 Suggested reply\n\nA safe synthetic answer.",
    sender: { type: "agent_bot" },
    content_attributes: {
      osplus_draft_id: id,
      osplus_engine: "osplus-v1",
      osplus_trigger_message_id: 10,
    },
  },
];
test("signed-in staff sends the exact checked private suggestion once; edited sends carry explicit provenance without a platform token", async () => {
  const {
    createDraftController,
  } = require("../public/chatwoot/osplus-reply.js");
  const data = messages(),
    posts = [],
    saved = new Map();
  const api = {
    async get() {
      return { data: { payload: data } };
    },
    async post(url, body) {
      posts.push({ url, body });
      const message = { ...body, id: 12, conversation_id: 10 };
      data.push(message);
      return { data: message };
    },
  };
  const controller = controllerWithAuth(createDraftController, {
    api,
    readPath: () => "/app/accounts/901/conversations/10",
    storage: {
      getItem: (k) => saved.get(k),
      setItem: (k, v) => saved.set(k, v),
    },
    locks: { request: (_key, fn) => fn() },
  });
  assert.equal((await controller.send(11)).status, "sent");
  assert.equal(posts.length, 1);
  assert.equal(posts[0].body.private, false);
  assert.equal(posts[0].body.content, "A safe synthetic answer.");
  assert.equal(posts[0].body.content_attributes.osplus_source_draft_id, id);
  assert.equal((await controller.send(11)).status, "sent");
  assert.equal(posts.length, 1);
});

test("stale, public, forged, cross-conversation and changed-route notes cannot be sent", async () => {
  const {
    createDraftController,
  } = require("../public/chatwoot/osplus-reply.js");
  for (const mutate of [
    (rows) =>
      rows.push({
        id: 12,
        conversation_id: 10,
        message_type: 0,
        private: false,
      }),
    (rows) => (rows[1].private = false),
    (rows) => (rows[1].sender.type = "user"),
    (rows) => (rows[1].conversation_id = 999),
    (rows) => (rows[1].content_attributes.osplus_engine = "other"),
    (rows) => (rows[1].content = "💬 Suggested reply\n\n{{INTERNAL}}"),
  ]) {
    const rows = messages();
    mutate(rows);
    let posts = 0;
    const controller = controllerWithAuth(createDraftController, {
      api: {
        get: async () => ({ data: { payload: rows } }),
        post: async () => {
          posts++;
        },
      },
      readPath: () => "/app/accounts/901/conversations/10",
      storage: { getItem: () => null, setItem() {} },
      locks: { request: (_key, fn) => fn() },
    });
    await assert.rejects(controller.send(11));
    assert.equal(posts, 0);
  }
  let path = "/app/accounts/901/conversations/10",
    posts = 0;
  const controller = controllerWithAuth(createDraftController, {
    api: {
      get: async () => {
        path = "/app/accounts/902/conversations/10";
        return { data: { payload: messages() } };
      },
      post: async () => {
        posts++;
      },
    },
    readPath: () => path,
    storage: { getItem: () => null, setItem() {} },
    locks: { request: (_key, fn) => fn() },
  });
  await assert.rejects(controller.send(11));
  assert.equal(posts, 0);
});
test("lost staff-send receipts stay uncertain across a fresh controller and edited requests use the reviewed text", async () => {
  const {
    createDraftController,
  } = require("../public/chatwoot/osplus-reply.js");
  const saved = new Map(),
    rows = messages();
  let posts = 0;
  const deps = {
    api: {
      get: async () => ({ data: { payload: rows } }),
      post: async () => {
        posts++;
        throw Error("PRIVATE_WIRE_DETAIL");
      },
    },
    readPath: () => "/app/accounts/901/conversations/10",
    storage: {
      getItem: (k) => saved.get(k),
      setItem: (k, v) => saved.set(k, v),
    },
    locks: { request: (_key, fn) => fn() },
  };
  assert.equal(
    (await controllerWithAuth(createDraftController, deps).send(11)).status,
    "uncertain",
  );
  assert.equal(
    (await controllerWithAuth(createDraftController, deps).send(11)).status,
    "uncertain",
  );
  assert.equal(posts, 1);
  const edited = {
    ...deps,
    storage: { getItem: () => null, setItem() {} },
    api: {
      ...deps.api,
      post: async (_url, body) => {
        assert.equal(body.content, "An owner-reviewed edit.");
        return { data: { ...body, id: 13 } };
      },
    },
  };
  assert.equal(
    (
      await controllerWithAuth(createDraftController, edited).send(
        11,
        "An owner-reviewed edit.",
      )
    ).status,
    "sent",
  );
  await assert.rejects(
    controllerWithAuth(createDraftController, { ...edited, locks: null }).send(
      11,
    ),
  );
});

test("separate staff profiles share one send claim; a missing coordinator never sends publicly", async () => {
  const {
    createDraftController,
  } = require("../public/chatwoot/osplus-reply.js");
  let claimed = false,
    posts = 0;
  const coordinator = {
    claim: async () => {
      if (claimed) return { status: "uncertain" };
      claimed = true;
      return { status: "claimed" };
    },
    record: async () => ({ status: "sent" }),
  };
  const api = {
    get: async () => ({ data: { payload: messages() } }),
    post: async (_url, body) => {
      posts++;
      return { data: { ...body, id: 22 } };
    },
  };
  const make = () =>
    controllerWithAuth(createDraftController, {
      api,
      coordinator,
      readPath: () => "/app/accounts/901/conversations/10",
      storage: { getItem: () => null, setItem() {} },
      locks: { request: (_key, fn) => fn() },
    });
  const result = await Promise.all([make().send(11), make().send(11)]);
  assert.equal(posts, 1);
  assert.deepEqual(result.map((x) => x.status).sort(), ["sent", "uncertain"]);
  const missing = controllerWithAuth(createDraftController, {
    api,
    coordinator: null,
    readPath: () => "/app/accounts/901/conversations/10",
    storage: { getItem: () => null, setItem() {} },
    locks: { request: (_key, fn) => fn() },
  });
  await assert.rejects(missing.send(11));
  assert.equal(posts, 1);
});

test("a customer message arriving during shared authorisation blocks the native public send", async () => {
  const {
    createDraftController,
  } = require("../public/chatwoot/osplus-reply.js");
  const rows = messages();
  let posts = 0;
  const coordinator = {
    claim: async () => {
      rows.push({
        id: 12,
        conversation_id: 10,
        message_type: 0,
        private: false,
        content: "A newer question",
      });
      return { status: "claimed" };
    },
    record: async () => ({ status: "sent" }),
  };
  const controller = controllerWithAuth(createDraftController, {
    coordinator,
    api: {
      get: async () => ({ data: { payload: rows } }),
      post: async (_url, body) => {
        posts++;
        return { data: { ...body, id: 13 } };
      },
    },
    readPath: () => "/app/accounts/901/conversations/10",
    storage: { getItem: () => null, setItem() {} },
    locks: { request: (_key, fn) => fn() },
  });
  assert.equal((await controller.send(11)).status, "uncertain");
  assert.equal(posts, 0);
});

test("Edit uses the native text request and receipt while retaining echo/reply metadata and shared duplicate protection", async () => {
  const {
    createDraftController,
    createNativeReplyBridge,
  } = require("../public/chatwoot/osplus-reply.js");
  let posts = 0;
  const saved = new Map(),
    statuses = [];
  const controller = controllerWithAuth(createDraftController, {
    api: {
      get: async () => ({ data: { payload: messages() } }),
      post: async () => {
        posts++;
      },
    },
    readPath: () => "/app/accounts/901/conversations/10",
    storage: {
      getItem: (k) => saved.get(k),
      setItem: (k, v) => saved.set(k, v),
    },
    locks: { request: (_key, fn) => fn() },
  });
  const bridge = createNativeReplyBridge({
    storage: nativeStorage(),
    controller,
    readPath: () => "/app/accounts/901/conversations/10",
    origin: "https://chat.example.invalid",
    onStatus: (s) => statuses.push(s),
  });
  bridge.activate(11);
  const request = {
    method: "post",
    url: "/api/v1/accounts/901/conversations/10/messages",
    data: {
      content: "An edited synthetic answer.",
      private: false,
      echo_id: "native-echo",
      content_attributes: { in_reply_to: 9 },
    },
  };
  assert.equal(await bridge.request(request), request);
  assert.equal(posts, 0);
  assert.equal(request.data.echo_id, "native-echo");
  assert.equal(request.data.content_attributes.in_reply_to, 9);
  assert.equal(request.data.content_attributes.osplus_source_draft_id, id);
  assert.equal(request.data.content_attributes.osplus_source_note_id, 11);
  const response = { config: request, data: { id: 22, ...request.data } };
  assert.equal(await bridge.response(response), response);
  assert.equal(bridge.isActive(), false);
  assert.deepEqual(await controller.send(11), { status: "sent" });
  assert.equal(posts, 0);
  assert.ok(statuses.some((s) => s.includes("Reply sent")));
});

test("native suggestion editing preserves existing text, including text entered while the draft loads", async () => {
  const { fillNativeReply } = require("../public/chatwoot/osplus-reply.js");
  let text = "A staff draft",
    inserted = 0,
    activated = 0,
    loads = 0;
  const composer = {
    read: () => ({ available: true, private: false, text }),
    insert: (v) => {
      text = v;
      inserted++;
    },
  };
  const bridge = { isActive: () => false, activate: () => activated++ };
  const controller = {
    preview: async () => {
      loads++;
      return { sent: false, text: "Suggested text" };
    },
  };
  await assert.rejects(
    fillNativeReply({ controller, noteId: 11, composer, bridge }),
    /already has text/,
  );
  assert.equal(loads, 0);
  assert.equal(inserted, 0);
  text = "";
  controller.preview = async () => {
    text = "Typed during the check";
    return { sent: false, text: "Suggested text" };
  };
  await assert.rejects(
    fillNativeReply({ controller, noteId: 11, composer, bridge }),
    /already has text/,
  );
  assert.equal(text, "Typed during the check");
  assert.equal(inserted, 0);
  text = "";
  controller.preview = async () => ({ sent: false, text: "Suggested text" });
  await fillNativeReply({ controller, noteId: 11, composer, bridge });
  assert.equal(text, "Suggested text");
  assert.equal(inserted, 1);
  assert.equal(activated, 1);
});

test("native interception leaves unrelated and private sends alone and safely releases context after navigation", async () => {
  const {
    createNativeReplyBridge,
  } = require("../public/chatwoot/osplus-reply.js");
  let current = "/app/accounts/901/conversations/10",
    claims = 0;
  const b = createNativeReplyBridge({
    controller: {
      prepareNativeSend: async () => {
        claims++;
      },
    },
    readPath: () => current,
    origin: "https://chat.example.invalid",
  });
  const request = () => ({
    method: "post",
    url: "/api/v1/accounts/901/conversations/10/messages",
    data: { content: "Staff reply", private: false },
  });
  const plain = request();
  assert.equal(await b.request(plain), plain);
  assert.equal(claims, 0);
  b.activate(11);
  const unrelated = {
    ...request(),
    url: "/api/v1/accounts/902/conversations/10/messages",
  };
  assert.equal(await b.request(unrelated), unrelated);
  assert.equal(claims, 0);
  const note = {
    ...request(),
    data: { content: "Private staff note", private: true },
  };
  assert.equal(await b.request(note), note);
  assert.equal(b.isActive(), false);
  assert.equal(claims, 0);
  b.activate(11);
  current = "/app/accounts/901/dashboard";
  const away = request();
  assert.equal(await b.request(away), away);
  assert.equal(b.isActive(), false);
  assert.equal(claims, 0);
});

test("an uncertain native send blocks blind native retries and bookkeeping failure cannot turn a confirmed HTTP receipt into a failed send", async () => {
  const {
    createNativeReplyBridge,
  } = require("../public/chatwoot/osplus-reply.js");
  let bridge = createNativeReplyBridge({
    storage: nativeStorage(),
    controller: {
      prepareNativeSend: async () => ({
        status: "claimed",
        attributes: {},
        confirm: async () => {
          throw Error("Local bookkeeping unavailable");
        },
      }),
    },
    readPath: () => "/app/accounts/901/conversations/10",
    origin: "https://chat.example.invalid",
  });
  bridge.activate(11);
  const config = {
    method: "post",
    url: "/api/v1/accounts/901/conversations/10/messages",
    data: {
      content: "Synthetic",
      private: false,
      echo_id: "uncertain-native-echo",
    },
  };
  await bridge.request(config);
  const receipt = { config, data: { id: 22 } };
  assert.equal(await bridge.response(receipt), receipt);
  await assert.rejects(
    bridge.request({
      method: "post",
      url: "/api/v1/accounts/901/conversations/10/messages/22/retry",
    }),
    /unconfirmed/,
  );
});

test("native failed echoes remain blocked after cancel, navigation and a new bridge", async () => {
  const {
    createNativeReplyBridge,
  } = require("../public/chatwoot/osplus-reply.js");
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  const options = {
    storage,
    origin: "https://chat.example.invalid",
    readPath: () => "/app/accounts/901/conversations/10",
    controller: {
      prepareNativeSend: async () => ({ status: "uncertain" }),
      guardNativeRetry: async () => {},
    },
  };
  const original = () => ({
    method: "post",
    url: "/api/v1/accounts/901/conversations/10/messages",
    data: { content: "Synthetic", private: false, echo_id: "native-echo-qa" },
  });
  const first = createNativeReplyBridge(options);
  first.activate(11);
  await assert.rejects(first.request(original()), /unconfirmed/);
  await assert.rejects(
    first.request({ method: "post", url: original().url + "/22/retry" }),
    /unconfirmed/,
  );
  first.cancel();
  await assert.rejects(
    first.request(original()),
    /already reviewed|unconfirmed/,
  );
  const reloaded = createNativeReplyBridge(options);
  await assert.rejects(
    reloaded.request(original()),
    /already reviewed|unconfirmed/,
  );
  const ordinary = {
    ...original(),
    data: { content: "Staff", private: false, echo_id: "another-echo" },
  };
  assert.equal(await reloaded.request(ordinary), ordinary);
});

test("native retry checks persisted source metadata without an active composer and leaves ordinary staff retries alone", async () => {
  const {
    createDraftController,
    createNativeReplyBridge,
  } = require("../public/chatwoot/osplus-reply.js");
  const data = messages();
  data.push({
    id: 22,
    private: false,
    message_type: 1,
    content_attributes: { osplus_source_draft_id: id },
  });
  data.push({
    id: 23,
    private: false,
    message_type: 1,
    content_attributes: {},
  });
  const controller = controllerWithAuth(createDraftController, {
    api: { get: async () => ({ data: { payload: data } }) },
    readPath: () => "/app/accounts/901/conversations/10",
  });
  const bridge = createNativeReplyBridge({
    controller,
    origin: "https://chat.example.invalid",
    readPath: () => "/app/accounts/901/conversations/10",
  });
  await assert.rejects(
    bridge.request({
      method: "post",
      url: "/api/v1/accounts/901/conversations/10/messages/22/retry",
    }),
    /reviewed|unconfirmed/,
  );
  const ordinary = {
    method: "post",
    url: "/api/v1/accounts/901/conversations/10/messages/23/retry",
  };
  assert.equal(await bridge.request(ordinary), ordinary);
});
