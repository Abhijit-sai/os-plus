import { z } from "zod";
import { agentScopeSchema, buildAgentContext } from "../agent/context.ts";
import { turnResultSchema, type TurnResult } from "../agent/turn.ts";
import { voiceStatusSchema, voiceTargetSchema } from "./schemas.ts";
import { voiceTransportEnabled } from "./http.ts";
import { transcribeSyntheticVoice } from "./transcriber.ts";
type Prepared = { status: string; data?: unknown; result?: TurnResult };
export type VoiceStore = {
  run(action: string, input: unknown): Promise<unknown>;
  load(): Promise<unknown>;
  download(raw: unknown): Promise<{ bytes: Uint8Array }>;
  post(raw: unknown, beforePost: () => Promise<void>): Promise<{ id: number }>;
};
const requestSchema = z
  .object({
    scope: agentScopeSchema,
    data: z.unknown(),
    capability: z
      .object({ runId: z.string().uuid(), leaseToken: z.string().uuid() })
      .strict(),
  })
  .strict();
function unreadable(scope: unknown, data: unknown): Prepared {
  const ctx = buildAgentContext(scope, data),
    repeated = ctx.session.messages.some(
      (m) =>
        ["staff", "bot"].includes(m.author) &&
        m.content === ctx.pack.locked.unreadableHandoff,
    );
  return {
    status: "unreadable",
    result: turnResultSchema.parse({
      mode: "draft",
      ledger: { ...ctx.ledger, handoff: true },
      outcome: repeated ? "silent" : "handoff",
      replyText: repeated ? null : ctx.pack.locked.unreadableHandoff,
      costUsd: "0",
      packVersion: ctx.packVersion,
      understanding: { signals: [{ kind: "unreadable" }] },
      decision: { mock: true, handoff: true, reason: "unreadable_voice" },
      checks: ["voice_requires_review"],
      provenance: [],
      models: [],
      timingsMs: {},
    }),
  };
}
/** The original turn lease owns this preprocessing; no second customer turn or external retry is created. */
export async function prepareVoiceTurn(
  raw: unknown,
  store: VoiceStore,
): Promise<Prepared> {
  const request = requestSchema.parse(raw);
  try {
    voiceTransportEnabled();
  } catch {
    return { status: "voice_disabled" };
  }
  // A newer trigger cannot discard earlier untranscribed audio in the same unanswered burst.
  if (buildAgentContext(request.scope, request.data).incompleteVoice)
    return unreadable(request.scope, request.data);
  const call = async (action: string, extra: Record<string, unknown> = {}) =>
    voiceStatusSchema.parse(
      await store.run(action, { ...request.capability, ...extra }),
    );
  const first = await call("claim");
  if (first.status === "not_audio")
    return { status: "ready", data: request.data };
  if (first.status === "sent")
    return { status: "ready", data: await store.load() };
  if (first.status === "unreadable")
    return unreadable(request.scope, request.data);
  if (!["processing", "ready"].includes(first.status))
    return { status: "voice_" + first.status };
  const check = async () => {
    voiceTransportEnabled();
    const out = await call("check");
    if (!["processing", "ready"].includes(out.status))
      throw new Error("Voice authorization changed.");
  };
  if (first.status === "processing") {
    const target = voiceTargetSchema.parse(first);
    let transcript;
    try {
      await check();
      const audio = await store.download({
        accountId: target.accountId,
        conversationId: target.conversationId,
        providerMessageId: target.providerMessageId,
        attachmentId: target.attachmentId,
        maxBytes: target.maxBytes,
        maxSeconds: target.maxSeconds,
      });
      await check();
      transcript = await transcribeSyntheticVoice(
        audio.bytes,
        { maxBytes: target.maxBytes, maxSeconds: target.maxSeconds },
        target.languages,
      );
    } catch {
      const failed = await call("unreadable");
      return failed.status === "unreadable"
        ? unreadable(request.scope, request.data)
        : { status: "voice_" + failed.status };
    }
    const saved = await call("record", {
      text: transcript.text,
      sha256: transcript.sha256,
      durationMs: transcript.durationMs,
      bytes: transcript.bytes,
      language: transcript.language,
    });
    if (saved.status !== "ready") return { status: "voice_" + saved.status };
  }
  const note = await call("note.claim");
  if (note.status !== "sending") return { status: "voice_" + note.status };
  const target = voiceTargetSchema.parse(note);
  if (!target.text) throw new Error("Transcript unavailable.");
  try {
    const receipt = await store.post(
      {
        accountId: target.accountId,
        conversationId: target.conversationId,
        providerMessageId: target.providerMessageId,
        jobId: target.jobId,
        text: target.text,
      },
      check,
    );
    const recorded = await call("note.record", {
      providerNoteId: z.number().int().positive().safe().parse(receipt.id),
    });
    if (recorded.status !== "sent")
      throw new Error("Unconfirmed transcript note.");
  } catch {
    try {
      await call("note.uncertain");
    } catch {
      /* The durable sending claim remains held if receipt storage failed. */
    }
    return { status: "voice_uncertain" };
  }
  return { status: "ready", data: await store.load() };
}
