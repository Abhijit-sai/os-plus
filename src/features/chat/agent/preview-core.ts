import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { parseKnowledgePack } from "../knowledge-pack.ts";
import { runAgentTurn, turnResultSchema, type TurnResult } from "./turn.ts";
import { createMockModel, mockScenarioSchema } from "./mock-model.ts";
const uuid = z.string().uuid();
export const previewInputSchema = z
  .object({
    brandId: uuid,
    knowledge: z.enum(["draft", "published"]),
    scenario: mockScenarioSchema,
    message: z.string().trim().min(1).max(4000),
    history: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            text: z.string().min(1).max(6000),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();
const contextSchema = z
  .object({
    tenantId: uuid,
    actor: z
      .object({ type: z.literal("USER"), id: z.string().min(1) })
      .strict(),
    source: z.literal("OS_PLUS_UI"),
    correlationId: z.string().min(1).max(200),
    idempotencyKey: z.string().optional(),
  })
  .strict();
export type PreviewCommandContext = z.infer<typeof contextSchema>;
export type PreviewDependencies = {
  authorize(): Promise<unknown>;
  load(
    tenantId: string,
    brandId: string,
    source: "draft" | "published",
  ): Promise<unknown>;
  command(
    context: PreviewCommandContext,
    action: string,
    input: unknown,
  ): Promise<unknown>;
};
export type ReplyPreview = {
  mock: true;
  replyText: string | null;
  outcome: TurnResult["outcome"];
  knowledgeVersion: number;
  sourceRefs: string[];
  costUsd: "0";
};
const project = (value: unknown): ReplyPreview => {
  const result = turnResultSchema.parse(value);
  return {
    mock: true,
    replyText: result.replyText,
    outcome: result.outcome,
    knowledgeVersion: result.packVersion,
    sourceRefs: result.provenance.map((item) => item.reference),
    costUsd: "0",
  };
};
/** Only sandbox turn audit is persisted. These message IDs exist solely in memory, never in chat_messages. */
export async function runMockPreview(
  raw: unknown,
  keyInput: unknown,
  deps: PreviewDependencies,
): Promise<ReplyPreview> {
  const context = contextSchema.parse(await deps.authorize());
  const input = previewInputSchema.parse(raw),
    key = uuid.parse(keyInput);
  const requestHash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  const receiptInput = { brandId: input.brandId, commandKey: key, requestHash };
  const replay = await deps.command(context, "sandbox.replay", receiptInput);
  if (replay !== null)
    return project(
      z.object({ id: uuid, result: z.unknown() }).strict().parse(replay).result,
    );
  const loaded = z
    .object({
      tenantId: uuid,
      brandId: uuid,
      version: z.number().int().positive(),
      currency: z
        .string()
        .regex(/^[A-Z]{3}$/)
        .nullable()
        .default(null),
      body: z.unknown(),
    })
    .strict()
    .parse(await deps.load(context.tenantId, input.brandId, input.knowledge));
  if (loaded.tenantId !== context.tenantId || loaded.brandId !== input.brandId)
    throw new Error("Preview unavailable.");
  const pack = parseKnowledgePack(loaded.body),
    now = new Date().toISOString();
  const workspaceId = randomUUID(),
    channelId = randomUUID(),
    conversationId = randomUUID(),
    triggerMessageId = randomUUID();
  const scope = {
    tenantId: context.tenantId,
    workspaceId,
    channelId,
    conversationId,
    triggerMessageId,
  };
  const messages = [
    ...input.history.map((message, index) => ({
      tenantId: context.tenantId,
      conversationId,
      id: randomUUID(),
      providerId: index + 1,
      author: message.role === "user" ? "customer" : "bot",
      private: false,
      content: message.text,
      at: new Date(
        Date.parse(now) - (input.history.length - index) * 1000,
      ).toISOString(),
    })),
    {
      tenantId: context.tenantId,
      conversationId,
      id: triggerMessageId,
      providerId: input.history.length + 1,
      author: "customer",
      private: false,
      content: input.message,
      at: now,
    },
  ];
  const result = await runAgentTurn(
    {
      scope,
      now,
      data: {
        ...scope,
        brandId: input.brandId,
        active: true,
        moduleEnabled: true,
        channelKind: "website",
        agentMode: "draft",
        quietUntil: null,
        currency: loaded.currency,
        ledger: {},
        historyComplete: true,
        pack: {
          tenantId: context.tenantId,
          brandId: input.brandId,
          version: loaded.version,
          body: pack,
        },
        messages,
      },
    },
    createMockModel(input.scenario, pack),
  );
  try {
    z.object({ id: uuid })
      .strict()
      .parse(
        await deps.command(context, "sandbox.record", {
          ...receiptInput,
          result,
        }),
      );
  } catch {
    // Another request or a lost response may have committed the same log. Recover before asking for another run.
    const recovered = await deps.command(
      context,
      "sandbox.replay",
      receiptInput,
    );
    if (recovered !== null)
      return project(
        z.object({ id: uuid, result: z.unknown() }).strict().parse(recovered)
          .result,
      );
    throw new Error("Preview could not be recorded.");
  }
  return project(result);
}
