import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import {syntheticOpusBase64} from "../src/features/chat/voice/opus-fixture.ts";
import { syntheticVoiceFixture } from "../src/features/chat/voice/mock-fixtures.ts";
test("authorized attachment lookup downloads only scoped loopback proxy bytes and a transcript is posted privately once", async () => {
  const { ChatwootAttachmentClient } =
    await import("../src/integrations/chatwoot/attachment-client.ts");
  const { ChatwootTranscriptClient } =
    await import("../src/integrations/chatwoot/transcript-client.ts");
  const original = { ...process.env };
  process.env.CHAT_VOICE_ENABLED = "true";
  process.env.CHAT_TRANSCRIPTION_MODE = "mock";
  process.env.CHAT_VOICE_MEDIA_MOCK_ENABLED = "true";
  process.env.CHAT_DRY_RUN = "false";
  let origin,
    posts = 0,
    mediaAuth,
    foreign = false,
    redirect = false,
    wrongConversation = false,
    wrongAccount = false,
    opusMedia = false;
  const server = http.createServer(async (req, res) => {
    if (req.url.includes("/messages?")) {
      assert.equal(req.headers["api-access-token"], "private-test-token");
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          payload: [
            {id: 9, private: false, message_type: 0, content: "Earlier ordinary text"},
            {id: 10, private: true, message_type: 1, content: "Internal note"},
            {
              id: 11,
              private: false,
              message_type: 0,
              attachments: [
                {
                  id: 22,
                  account_id: 1,
                  message_id: 11,
                  file_type: "audio",
                  data_url: foreign
                    ? "http://169.254.169.254/never"
                    : origin +
                      "/rails/active_storage/blobs/redirect/local/tone.wav",
                },
              ],
            },
          ],
        }),
      );
    } else if (req.url.includes("/blobs/proxy/")) {
      mediaAuth = req.headers["api-access-token"];
      if (redirect) {
        res.writeHead(302, { Location: "http://169.254.169.254/never" });
        res.end();
      } else {
        res.setHeader("Content-Type", opusMedia?"audio/opus":"audio/wav");
        res.end(opusMedia?Buffer.from(syntheticOpusBase64,"base64"):syntheticVoiceFixture().bytes);
      }
    } else if (req.method === "POST") {
      posts++;
      let raw = "";
      for await (const c of req) raw += c;
      const body = JSON.parse(raw);
      assert.equal(body.private, true);
      assert.equal(body.message_type, "outgoing");
      assert.ok(!body.content.startsWith("💬 Suggested reply"));
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ id: 91, conversation_id: wrongConversation ? 3 : 2, account_id: wrongAccount ? 3 : 1, ...body }));
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  origin = "http://127.0.0.1:" + server.address().port;
  try {
    const client = new ChatwootAttachmentClient({
      origin,
      token: "private-test-token",
      mediaOrigins: [origin],
      allowLocalMock: true,
    });
    const scope = {
      accountId: 1,
      conversationId: 2,
      providerMessageId: 11,
      attachmentId: 22,
      maxBytes: 10000000,
      maxSeconds: 120,
    };
    assert.equal((await client.download(scope)).mime, "audio/wav");
    assert.equal(mediaAuth, undefined);
    opusMedia=true;assert.equal((await client.download(scope)).mime,"audio/ogg");opusMedia=false;
    foreign = true;
    await assert.rejects(client.download(scope));
    foreign = false;
    redirect = true;
    await assert.rejects(client.download(scope));
    redirect = false,
    wrongConversation = false,
    wrongAccount = false,
    opusMedia = false;
    const note = new ChatwootTranscriptClient({
      origin,
      token: "private-test-token",
      allowLocalMock: true,
    });
    const receipt = await note.post(
      {
        accountId: 1,
        conversationId: 2,
        providerMessageId: 11,
        jobId: randomUUID(),
        text: "Synthetic transcript.",
      },
      async () => {},
    );
    assert.equal(receipt.id, 91);
    assert.equal(posts, 1);
    await assert.rejects(
      note.post(
        {
          accountId: 1,
          conversationId: 2,
          providerMessageId: 11,
          jobId: randomUUID(),
          text: "Stopped",
        },
        async () => {
          throw Error("revoked");
        },
      ),
    );
    assert.equal(posts, 1);
    const input={accountId:1,conversationId:2,providerMessageId:11,jobId:randomUUID(),text:"Synthetic transcript."};
    wrongConversation=true;
    await assert.rejects(note.post(input,async()=>{}),/unconfirmed/);
    wrongConversation=false;wrongAccount=true;
    await assert.rejects(note.post(input,async()=>{}),/unconfirmed/);
    wrongAccount=false;
    process.env.CHAT_VOICE_ENABLED = "false";
    await assert.rejects(client.download(scope));
    assert.equal(posts, 3);
  } finally {
    await new Promise((r) => server.close(r));
    for (const k of [
      "CHAT_VOICE_ENABLED",
      "CHAT_TRANSCRIPTION_MODE",
      "CHAT_VOICE_MEDIA_MOCK_ENABLED",
      "CHAT_DRY_RUN",
    ])
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
  }
});
