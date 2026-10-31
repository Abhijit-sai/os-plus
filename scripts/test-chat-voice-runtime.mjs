import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { startChatDatabase } from "./chat-db-harness/database.mjs";
import { voiceFixture } from "./chat-db-harness/voice-fixture.mjs";
let local, fixtures;
const rpc = async (name, ctx, input, action, db = local.db) =>
  (
    await db.query(
      "select " +
        name +
        "($1::jsonb," +
        (action === undefined ? "$2::jsonb" : "$2,$3::jsonb") +
        ") result",
      action === undefined
        ? [JSON.stringify(ctx), JSON.stringify(input)]
        : [JSON.stringify(ctx), action, JSON.stringify(input)],
    )
  ).rows[0].result;
before(
  async () => {
    local = await startChatDatabase();
    fixtures = [
      await voiceFixture(local.db, 0),
      await voiceFixture(local.db, 1),
    ];
  },
  { timeout: 120000 },
);
after(async () => local?.stop(), { timeout: 30000 });
test("voice is disabled by default and only this business's owner can configure bounded settings", async () => {
  const f = fixtures[0];
  const initial = await rpc("chat_voice_settings", f.owner, {});
  assert.equal(initial.enabled, false);
  assert.equal(initial.maxSeconds, 120);
  assert.equal(initial.maxBytes, 10000000);
  for (const role of ["manager", "viewer", "finance"])
    await assert.rejects(
      rpc(
        "chat_voice_settings",
        { ...f.owner, actor: { type: "USER", id: "voice-" + role } },
        {},
      ),
    );
  const save = {
    version: initial.version,
    enabled: true,
    maxSeconds: 120,
    maxBytes: 10000000,
  };
  const updated = await rpc("chat_voice_settings", f.owner, save);
  assert.equal(updated.enabled, true);
  assert.equal(updated.version, initial.version + 1);
  assert.deepEqual(await rpc("chat_voice_settings", f.owner, save), updated);
  await assert.rejects(
    rpc(
      "chat_voice_settings",
      { ...f.owner, idempotencyKey: randomUUID() },
      { ...save, maxSeconds: 121 },
    ),
  );
  assert.equal(
    (await rpc("chat_voice_settings", fixtures[1].owner, {})).enabled,
    false,
  );
});

test("one original agent lease owns transcription and a private-note receipt; replay preserves original message", async () => {
  const f = fixtures[0];
  const agent = await rpc("chat_agent_run", f.context, f.scope, "claim");
  assert.equal(agent.status, "claimed");
  const input = {
    ...f.scope,
    runId: agent.runId,
    leaseToken: agent.leaseToken,
  };
  f.capability = input;
  const voice = await rpc("chat_voice_command", f.context, input, "claim");
  assert.equal(voice.status, "processing");
  assert.equal(voice.attachmentId, 30);
  assert.ok(!JSON.stringify(voice).includes("169.254"));
  assert.equal(
    (await rpc("chat_voice_command", f.context, input, "claim")).status,
    "held",
  );
  const admitted = await rpc(
    "chat_agent_run",
    f.context,
    { ...input, callKey: "transcribe", maxUsd: "0.01" },
    "budget.reserve",
  );
  assert.equal(admitted.admitted, true);
  assert.equal(
    (
      await rpc(
        "chat_agent_run",
        f.context,
        {
          ...input,
          callKey: "transcribe",
          actualUsd: "0.001",
          generationId: "synthetic-accounting-only",
        },
        "budget.settle",
      )
    ).status,
    "settled",
  );
  const result = {
    ...input,
    text: "CH8 synthetic information: What are your opening hours?",
    sha256: "b".repeat(64),
    durationMs: 1000,
    bytes: 32044,
    language: "en",
  };
  assert.equal(
    (await rpc("chat_voice_command", f.context, result, "record")).status,
    "ready",
  );
  const note = await rpc("chat_voice_command", f.context, input, "note.claim");
  assert.equal(note.status, "sending");
  assert.equal(
    (await rpc("chat_voice_command", f.context, input, "note.claim")).status,
    "held",
  );
  assert.equal(
    (
      await rpc(
        "chat_voice_command",
        f.context,
        { ...input, providerNoteId: 9001 },
        "note.record",
      )
    ).status,
    "sent",
  );
  const stored = (
    await local.db.query(
      "select content,transcript from chat_messages where tenant_id=$1 and id=$2",
      [f.tenantId, f.scope.triggerMessageId],
    )
  ).rows[0];
  assert.equal(stored.content, null);
  assert.equal(stored.transcript, result.text);
  const loaded = await rpc("chat_agent_load", f.context, f.scope);
  assert.equal(loaded.messages.at(-1).content, result.text);
  assert.equal(loaded.messages.at(-1).inputSource, "voice");
  assert.equal(
    (await rpc("chat_voice_command", f.context, input, "claim")).status,
    "sent",
  );
  await assert.rejects(
    rpc("chat_voice_command", fixtures[1].context, input, "claim"),
  );
});

test("derived voice context remains compatible with the guarded inquiry turn and cost stage admission", async () => {
  const f = fixtures[0];
  const loaded = await rpc("chat_agent_load", f.context, f.scope);
  const { runAgentTurn } = await import("../src/features/chat/agent/turn.ts");
  const { createMockModel } =
    await import("../src/features/chat/agent/mock-model.ts");
  const scope = { tenantId: f.tenantId, ...f.scope };
  delete scope.secretHash;
  const result = await runAgentTurn(
    { scope, data: loaded, now: new Date().toISOString() },
    createMockModel("information", f.pack),
  );
  assert.equal(result.outcome, "drafted");
  assert.ok(result.replyText);
});

test("the real voice worker and stored turn produce one private transcript and one guarded draft under replay", async () => {
  const { prepareVoiceTurn } =
    await import("../src/features/chat/voice/worker-core.ts");
  const { ChatwootAttachmentClient } =
    await import("../src/integrations/chatwoot/attachment-client.ts");
  const { ChatwootTranscriptClient } =
    await import("../src/integrations/chatwoot/transcript-client.ts");
  const { ChatwootMessageClient } =
    await import("../src/integrations/chatwoot/message-client.ts");
  const { runStoredMockTurn } =
    await import("../src/features/chat/agent/worker-core.ts");
  const { createMockModel } =
    await import("../src/features/chat/agent/mock-model.ts");
  const { syntheticVoiceFixture } =
    await import("../src/features/chat/voice/mock-fixtures.ts");
  const { default: http } = await import("node:http");
  const f = await voiceFixture(local.db, 3);
  await rpc("chat_voice_settings", f.owner, {
    version: 1,
    enabled: true,
    maxSeconds: 120,
    maxBytes: 10000000,
  });
  const old = { ...process.env };
  for (const [k, v] of Object.entries({
    CHAT_VOICE_ENABLED: "true",
    CHAT_TRANSCRIPTION_MODE: "mock",
    CHAT_VOICE_MEDIA_MOCK_ENABLED: "true",
    CHAT_DRY_RUN: "false",
  }))
    process.env[k] = v;
  let origin;
  const posts = [];
  const server = http.createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.method === "GET" && req.url.includes("/messages?"))
      res.end(
        JSON.stringify({
          payload: [
            {
              id: 20,
              private: false,
              message_type: 0,
              attachments: [
                {
                  id: 30,
                  account_id: 904,
                  message_id: 20,
                  file_type: "audio",
                  data_url:
                    origin +
                    "/rails/active_storage/blobs/redirect/source/tone.wav",
                },
              ],
            },
          ],
        }),
      );
    else if (req.method === "GET") {
      res.setHeader("Content-Type", "audio/wav");
      res.end(syntheticVoiceFixture().bytes);
    } else {
      let text = "";
      for await (const c of req) text += c;
      const body = JSON.parse(text);
      posts.push(body);
      res.end(JSON.stringify({ id: 8000 + posts.length, conversation_id:21, ...body }));
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  origin = "http://127.0.0.1:" + server.address().port;
  try {
    const opts = { origin, token: "mock-only", allowLocalMock: true };
    const attachment = new ChatwootAttachmentClient({
      ...opts,
      mediaOrigins: [origin],
    });
    const note = new ChatwootTranscriptClient(opts);
    const load = () => rpc("chat_agent_load", f.context, f.scope);
    const store = {
      load,
      run: (action, extra) =>
        rpc("chat_agent_run", f.context, { ...f.scope, ...extra }, action),
      dryRun: async () => null,
      prepare: (capability, data) =>
        prepareVoiceTurn(
          {
            scope: {
              tenantId: f.tenantId,
              ...Object.fromEntries(
                Object.entries(f.scope).filter(([k]) => k !== "secretHash"),
              ),
            },
            data,
            capability,
          },
          {
            run: (action, extra) =>
              rpc(
                "chat_voice_command",
                f.context,
                { ...f.scope, ...extra },
                action,
              ),
            load,
            download: (raw) => attachment.download(raw),
            post: (raw, check) => note.post(raw, check),
          },
        ),
    };
    const request = {
      scope: {
        tenantId: f.tenantId,
        ...Object.fromEntries(
          Object.entries(f.scope).filter(([k]) => k !== "secretHash"),
        ),
      },
      now: new Date().toISOString(),
      dryRun: false,
      deliver: true,
    };
    const model = createMockModel("information", f.pack);
    const draft = (raw) =>
      new ChatwootMessageClient(opts).postPrivateDraft({
        accountId: 904,
        conversationId: 21,
        draftId: raw.draftId,
        text: raw.text,
      });
    assert.equal(
      (await runStoredMockTurn(request, store, model, draft)).status,
      "delivered",
    );
    await runStoredMockTurn(request, store, model, draft);
    assert.equal(posts.length, 2);
    assert.ok(posts.every((p) => p.private === true));
    assert.ok(posts[0].content.includes("Automatic voice transcript"));
    assert.ok(posts[1].content.startsWith("💬 Suggested reply"));
    assert.ok(!posts[1].content.includes("CH8 synthetic"));
  } finally {
    await new Promise((r) => server.close(r));
    for (const k of [
      "CHAT_VOICE_ENABLED",
      "CHAT_TRANSCRIPTION_MODE",
      "CHAT_VOICE_MEDIA_MOCK_ENABLED",
      "CHAT_DRY_RUN",
    ])
      if (old[k] === undefined) delete process.env[k];
      else process.env[k] = old[k];
  }
});

test("a plain text run cannot reserve a transcription charge", async () => {
  const f = await voiceFixture(local.db, 8);
  await local.db.query(
    "update chat_messages set attachments_json='[]',content='Opening hours?' where tenant_id=$1",
    [f.tenantId],
  );
  const lease = await rpc("chat_agent_run", f.context, f.scope, "claim");
  await assert.rejects(
    rpc(
      "chat_agent_run",
      f.context,
      {
        ...f.scope,
        runId: lease.runId,
        leaseToken: lease.leaseToken,
        callKey: "transcribe",
        maxUsd: "0.01",
      },
      "budget.reserve",
    ),
  );
});

async function activeVoice(index, transformPack,ageHours=0) {
  const f = await voiceFixture(local.db, index, transformPack,ageHours);
  await rpc("chat_voice_settings", f.owner, {
    version: 1,
    enabled: true,
    maxSeconds: 120,
    maxBytes: 10000000,
  });
  const a = await rpc("chat_agent_run", f.context, f.scope, "claim");
  return {
    ...f,
    capability: { ...f.scope, runId: a.runId, leaseToken: a.leaseToken },
  };
}
test("concurrent claims and an ambiguous private-note receipt cannot repeat a transcription or note", async () => {
  const f = await activeVoice(9),
    other = await local.connect();
  const claims = await Promise.all([
    rpc("chat_voice_command", f.context, f.capability, "claim"),
    rpc("chat_voice_command", f.context, f.capability, "claim", other),
  ]);
  assert.equal(claims.filter((x) => x.status === "processing").length, 1);
  assert.equal(claims.filter((x) => x.status === "held").length, 1);
  await rpc(
    "chat_voice_command",
    f.context,
    {
      ...f.capability,
      text: "Synthetic transcript",
      sha256: "c".repeat(64),
      durationMs: 1000,
    bytes: 32044,
      language: "en",
    },
    "record",
  );
  const notes = await Promise.all([
    rpc("chat_voice_command", f.context, f.capability, "note.claim"),
    rpc("chat_voice_command", f.context, f.capability, "note.claim", other),
  ]);
  assert.equal(notes.filter((x) => x.status === "sending").length, 1);
  await rpc("chat_voice_command", f.context, f.capability, "note.uncertain");
  assert.equal(
    (await rpc("chat_voice_command", f.context, f.capability, "claim")).status,
    "held",
  );
  assert.equal(
    (await rpc("chat_voice_command", f.context, f.capability, "note.claim"))
      .status,
    "held",
  );
  assert.equal(
    (
      await local.db.query(
        "select count(*)::int n from chat_voice_jobs where tenant_id=$1",
        [f.tenantId],
      )
    ).rows[0].n,
    1,
  );
});
test("transcript and its audit roll back together on storage failure", async () => {
  const f = await activeVoice(10);
  await rpc("chat_voice_command", f.context, f.capability, "claim");
  await local.db.query(
    "create function voice_qa_fail() returns trigger language plpgsql as $$ begin if new.event_type='chat.voice.record' then raise exception 'synthetic audit failure';end if;return new;end $$;create trigger voice_qa_fail before insert on domain_events for each row execute function voice_qa_fail()",
  );
  try {
    await assert.rejects(
      rpc(
        "chat_voice_command",
        f.context,
        {
          ...f.capability,
          text: "Never committed",
          sha256: "d".repeat(64),
          durationMs: 1000,
    bytes: 32044,
          language: "en",
        },
        "record",
      ),
    );
    assert.equal(
      (
        await local.db.query(
          "select transcript from chat_messages where tenant_id=$1 and id=$2",
          [f.tenantId, f.scope.triggerMessageId],
        )
      ).rows[0].transcript,
      null,
    );
    assert.equal(
      (
        await local.db.query(
          "select state from chat_voice_jobs where tenant_id=$1",
          [f.tenantId],
        )
      ).rows[0].state,
      "processing",
    );
  } finally {
    await local.db.query(
      "drop trigger voice_qa_fail on domain_events;drop function voice_qa_fail()",
    );
  }
});
test("current business settings, staff quiet and newer customer messages revoke pending voice work", async () => {
  const f = await activeVoice(11);
  await rpc("chat_voice_command", f.context, f.capability, "claim");
  await local.db.query(
    "update chat_conversations set quiet_until=now()+interval '1 minute' where tenant_id=$1",
    [f.tenantId],
  );
  assert.equal(
    (await rpc("chat_voice_command", f.context, f.capability, "check")).status,
    "superseded",
  );
  await local.db.query(
    "update chat_conversations set quiet_until=null where tenant_id=$1",
    [f.tenantId],
  );
  await rpc(
    "chat_voice_settings",
    { ...f.owner, idempotencyKey: randomUUID() },
    { version: 2, enabled: false, maxSeconds: 120, maxBytes: 10000000 },
  );
  assert.equal(
    (await rpc("chat_voice_command", f.context, f.capability, "check")).status,
    "disabled",
  );
  await assert.rejects(
    rpc("chat_voice_command", f.owner, f.capability, "record"),
  );
  await local.db.query("set role authenticated");
  try {
    await assert.rejects(local.db.query("select * from chat_voice_jobs"));
    await assert.rejects(
      local.db.query("select chat_voice_command('{}','claim','{}')"),
    );
  } finally {
    await local.db.query("reset role");
  }
});
test("transcript privacy is enforced in the database and final DTO, including separately configurable viewer grants", async () => {
  const f = fixtures[0],
    lead = (
      await local.db.query("select id from leads where tenant_id=$1", [
        f.tenantId,
      ])
    ).rows[0].id;
  const read = (ctx) =>
    local.db
      .query("select chat_crm_read($1,'lead',$2) result", [
        JSON.stringify(ctx),
        JSON.stringify({ id: lead }),
      ])
      .then((x) => x.rows[0].result);
  const full = await read(f.owner);
  assert.ok(full.details.messages[0].transcript.includes("CH8 synthetic"));
  const viewer = { ...f.owner, actor: { type: "USER", id: "voice-viewer" } };
  await assert.rejects(read(viewer));
  await local.db.query(
    "insert into chat_role_permissions(tenant_id,role,permission,allowed) values($1,'viewer','leads:view',true)",
    [f.tenantId],
  );
  const masked = await read(viewer);
  assert.ok(
    masked.details.messages.every(
      (m) => m.transcript === null && m.content === null,
    ),
  );
  const { projectMessage } = await import("../src/features/leads/pii.ts");
  assert.equal(
    projectMessage(full.details.messages[0], false).transcript,
    undefined,
  );
  await local.db.query(
    "insert into chat_role_permissions(tenant_id,role,permission,allowed) values($1,'viewer','leads:pii',true)",
    [f.tenantId],
  );
  assert.ok((await read(viewer)).details.messages[0].transcript);
  const guessed = await read(fixtures[1].owner);
  assert.equal(guessed.item, null);
});
test("the real voice settings adapter refuses a stale tenant tab before any RPC", async () => {
  const { loadServerModule } =
      await import("./chat-db-harness/server-adapter.mjs"),
    { z } = await import("zod"),
    schemas = await import("../src/features/chat/voice/schemas.ts");
  let calls = 0;
  const selected = fixtures[1].tenantId;
  const adapter = loadServerModule("src/features/chat/voice/commands.ts", {
    zod: { z },
    "@/core/command-context/server": {
      createUserCommandContext: () => fixtures[1].owner,
    },
    "../module": {
      requireChatPermission: async () => ({
        context: { tenant: { id: selected } },
        db: {
          rpc: async (name, args) => {
            calls++;
            return {
              data: await rpc(name, args.p_context, args.p_input),
              error: null,
            };
          },
        },
      }),
    },
    "../schemas": { commandKeySchema: z.string().uuid() },
    "./schemas": schemas,
  });
  const before = process.env.CHAT_VOICE_ENABLED;
  process.env.CHAT_VOICE_ENABLED = "true";
  try {
    await assert.rejects(
      adapter.configureVoice(
        { enabled: true, maxBytes: 10000000, maxSeconds: 120, version: 1 },
        randomUUID(),
        fixtures[0].tenantId,
      ),
    );
    assert.equal(calls, 0);
    await adapter.configureVoice(
      { enabled: true, maxBytes: 10000000, maxSeconds: 120, version: 1 },
      randomUUID(),
      selected,
    );
    assert.equal(calls, 1);
  } finally {
    if (before === undefined) delete process.env.CHAT_VOICE_ENABLED;
    else process.env.CHAT_VOICE_ENABLED = before;
  }
});

test("voice evidence can save a provisional request but a voice yes cannot confirm and later voice invalidates approval", async () => {
  const f=await activeVoice(12,base=>({
    ...base,
    booking: {
      capability: "follow_up_task",
      confirmation: {
        intro: "Synthetic callback request. Please confirm.",
        labels: {
          name: "Name",
          services: "Services",
          address: "Address",
          date: "Date",
          window: "Window",
          timePreference: "Preferred time",
        },
        phrases: ["yes"],
      },
    },
  }));
  const pack=f.pack;
  await local.db.query(
    "update chat_channels set can_book=true where tenant_id=$1",
    [f.tenantId],
  );
  await rpc("chat_voice_command", f.context, f.capability, "claim");
  await rpc(
    "chat_voice_command",
    f.context,
    {
      ...f.capability,
      text: "Please arrange a callback",
      sha256: "e".repeat(64),
      durationMs: 1000,
    bytes: 32044,
      language: "en",
    },
    "record",
  );
  await rpc("chat_voice_command", f.context, f.capability, "note.claim");
  await rpc(
    "chat_voice_command",
    f.context,
    { ...f.capability, providerNoteId: 9500 },
    "note.record",
  );
  const lead = (
    await local.db.query("select id from leads where tenant_id=$1", [
      f.tenantId,
    ])
  ).rows[0].id;
  const command = (name, action, input) =>
    rpc(name, { ...f.owner, idempotencyKey: randomUUID() }, input, action);
  const saved = await command("chat_action_command", "request.save", {
    leadId: lead,
    capability: "follow_up_task",
    sourceMessageId: f.scope.triggerMessageId,
    evidence: "Please arrange a callback",
    details: {
      name: null,
      services: [pack.services[0].key],
      area: null,
      address: null,
      date: null,
      window: null,
      timePreference: null,
    },
  });
  assert.equal(saved.status, "requested");
  const review = await command("chat_request_workflow", "review", {
    id: saved.id,
    version: saved.version,
  });
  assert.ok(review.reviewText);
  let counter = 30;
  const add = async (content, author, voice = false) => {
    counter++;
    return rpc(
      "chat_capture",
      f.context,
      {
        workspaceId: f.scope.workspaceId,
        secretHash: f.scope.secretHash,
        channelId: f.scope.channelId,
        identity: { displayName: "Synthetic voice", sourceId: "voice-12" },
        message: {
          messageId: counter,
          accountId: 913,
          inboxId: 20,
          conversationId: 21,
          contactId: 22,
          status: "open",
          channelKind: "website",
          author,
          private: false,
          content,
          contentType: "text",
          attachments: voice ? [{ id: 80 + counter, file_type: "audio" }] : [],
          staffUserId: null,
          createdAt: new Date(Date.now() + counter * 1000).toISOString(),
        },
      },
      "events",
    );
  };
  await add(review.reviewText, "bot");
  const spoken = await add("yes", "customer", true);
  await assert.rejects(
    command("chat_request_workflow", "confirm", {
      id: saved.id,
      version: review.version,
      messageId: spoken.messageId,
    }),
    /Typed customer confirmation required/,
  );
  await add(review.reviewText, "bot");
  const typed = await add("yes", "customer");
  const confirmed = await command("chat_request_workflow", "confirm", {
    id: saved.id,
    version: review.version,
    messageId: typed.messageId,
  });
  assert.equal(confirmed.status, "customer_confirmed");
  await add(null, "customer", true);
  await assert.rejects(
    command("chat_request_workflow", "approve", {
      id: saved.id,
      version: confirmed.version,
    }),
    /confirmation changed/i,
  );
  assert.equal(
    (
      await local.db.query(
        "select count(*)::int n from customers where tenant_id=$1",
        [f.tenantId],
      )
    ).rows[0].n,
    0,
  );
});

async function nextVoiceMessage(f, content, voice=false, author="customer", hours=0) {
 const account=(await local.db.query("select chatwoot_account_id from chat_workspaces where tenant_id=$1",[f.tenantId])).rows[0].chatwoot_account_id;
 const provider=(await local.db.query("select coalesce(max(chatwoot_message_id),20)::int+1 n from chat_messages where tenant_id=$1",[f.tenantId])).rows[0].n;
 return rpc("chat_capture",f.context,{workspaceId:f.scope.workspaceId,secretHash:f.scope.secretHash,channelId:f.scope.channelId,identity:{displayName:"Synthetic burst",sourceId:"burst"},
  message:{messageId:provider,accountId:Number(account),inboxId:20,conversationId:21,contactId:22,status:"open",channelKind:"website",author,private:false,content,contentType:"text",
   attachments:Array.isArray(voice)?voice:voice?[{id:provider+100,file_type:"audio"}]:[],staffUserId:author==="staff"?77:null,createdAt:new Date(Date.now()+provider*1000+hours*3600000).toISOString()}},author==="customer"?"agent":"events");
}
test("unanswered voice bursts fail closed for a typed acknowledgement or another audio; answered and fresh history do not block",async()=>{
 const {buildAgentContext}=await import("../src/features/chat/agent/context.ts");
 const {runAgentTurn}=await import("../src/features/chat/agent/turn.ts");
 for(const secondVoice of [false,true]){
  const f=await activeVoice(secondVoice?15:14),captured=await nextVoiceMessage(f,secondVoice?null:"yes",secondVoice);
  const input={...f.scope,triggerMessageId:captured.messageId},scope={tenantId:f.tenantId,...input};delete scope.secretHash;
  const data=await rpc("chat_agent_load",f.context,input);
  assert.equal(data.voice.incompleteAudio,true);assert.equal(buildAgentContext(scope,data).incompleteVoice,true);
  let calls=0;
  const result=await runAgentTurn({scope,data,now:new Date().toISOString()},{kind:"mock",complete:async()=>{calls++;throw Error("must not call");}});
  assert.equal(calls,0);assert.equal(result.outcome,"handoff");assert.equal(result.decision.reason,"unreadable_voice");
  const lease=await rpc("chat_agent_run",f.context,input,"claim");
  const cap={...input,runId:lease.runId,leaseToken:lease.leaseToken};
  await assert.rejects(rpc("chat_agent_run",f.context,{...cap,result:{...result,decision:{mock:true},checks:[]}},"complete"),/Incomplete voice/);
  assert.equal((await rpc("chat_action_agent_run",f.context,{...cap,result},"complete")).status,"ready");
  assert.equal((await rpc("chat_voice_command",f.context,f.capability,"check")).status,"superseded");
 }
 const answered=await activeVoice(16);
 await nextVoiceMessage(answered,"Handled by staff","", "staff");
 await local.db.query("update chat_conversations set quiet_until=null where tenant_id=$1",[answered.tenantId]);
 const newer=await nextVoiceMessage(answered,"What are your hours?");
 const input={...answered.scope,triggerMessageId:newer.messageId},scope={tenantId:answered.tenantId,...input};delete scope.secretHash;
 const data=await rpc("chat_agent_load",answered.context,input);
 assert.equal(data.voice,null);assert.equal(buildAgentContext(scope,data).incompleteVoice,false);
 const fresh=await activeVoice(17,undefined,25),msg=await nextVoiceMessage(fresh,"What are your hours?");
 const freshInput={...fresh.scope,triggerMessageId:msg.messageId},freshScope={tenantId:fresh.tenantId,...freshInput};delete freshScope.secretHash;
 const freshData=await rpc("chat_agent_load",fresh.context,freshInput);
 assert.equal(freshData.voice,null);assert.equal(buildAgentContext(freshScope,freshData).incompleteVoice,false);
});
test("lowered settings revoke processing and pending notes, and current SQL rejects oversized results",async()=>{
 for(const stage of ["processing","ready","sending"]){
  const f=await activeVoice(18+["processing","ready","sending"].indexOf(stage));
  await rpc("chat_voice_command",f.context,f.capability,"claim");
  const result={...f.capability,text:"Synthetic",sha256:"f".repeat(64),durationMs:1000,bytes:32044,language:"en"};
  await assert.rejects(rpc("chat_voice_command",f.context,{...result,bytes:10000001},"record"),/Voice result invalid/);
  if(stage!=="processing")await rpc("chat_voice_command",f.context,result,"record");
  if(stage==="sending")await rpc("chat_voice_command",f.context,f.capability,"note.claim");
  await rpc("chat_voice_settings",{...f.owner,idempotencyKey:randomUUID()},{version:2,enabled:true,maxBytes:1024,maxSeconds:1});
  assert.equal((await rpc("chat_voice_command",f.context,f.capability,"check")).status,"settings_changed");
  assert.equal((await rpc("chat_voice_command",f.context,f.capability,stage==="processing"?"record":"note.claim")).status,"settings_changed");
 }
});

test("voice and text stages share the same hard budget lock; uncertain voice usage remains reserved",async()=>{
 const f=await activeVoice(21);await rpc("chat_voice_command",f.context,f.capability,"claim");
 await local.db.query("update chat_settings set monthly_budget_usd=0.10 where tenant_id=$1",[f.tenantId]);
 const other=await local.connect();
 try{
 const attempts=await Promise.all(["transcribe","understand"].map((callKey,i)=>rpc("chat_agent_run",f.context,{...f.capability,callKey,maxUsd:"0.06"},"budget.reserve",i?other:local.db)));
 assert.equal(attempts.filter(v=>v.admitted).length,1);
 const winner=attempts[0].admitted?"transcribe":"understand";
 await rpc("chat_agent_run",f.context,{...f.capability,callKey:winner,actualUsd:null,generationId:null},"budget.settle");
 assert.equal((await rpc("chat_agent_run",f.context,{...f.capability,callKey:"write",maxUsd:"0.05"},"budget.reserve")).admitted,false);
 await rpc("chat_agent_run",f.context,{...f.capability,callKey:winner,actualUsd:"0.01",generationId:"synthetic-ledger-only"},"budget.settle");
 assert.equal((await rpc("chat_agent_run",f.context,{...f.capability,callKey:"write",maxUsd:"0.05"},"budget.reserve")).admitted,true);
 }finally{await other.end();}
});

test("multiple recordings require review without media/model work, and expired original leases cannot claim voice",async()=>{
 const f=await activeVoice(22);
 const next=await nextVoiceMessage(f,null,[{id:121,file_type:"audio"},{id:122,file_type:"audio"}]);const scope={...f.scope,triggerMessageId:next.messageId};
 const run=await rpc("chat_agent_run",f.context,scope,"claim"),cap={...scope,runId:run.runId,leaseToken:run.leaseToken};
 assert.equal((await rpc("chat_voice_command",f.context,cap,"claim")).status,"unreadable");
 assert.equal((await local.db.query("select count(*)::int n from chat_agent_cost_entries where tenant_id=$1",[f.tenantId])).rows[0].n,0);
 const expired=await activeVoice(23);await local.db.query("update chat_agent_runs set lease_until=now()-interval '1 second' where tenant_id=$1",[expired.tenantId]);
 assert.equal((await rpc("chat_voice_command",expired.context,expired.capability,"claim")).status,"expired");
 assert.equal((await local.db.query("select count(*)::int n from chat_voice_jobs where tenant_id=$1",[expired.tenantId])).rows[0].n,0);
});
