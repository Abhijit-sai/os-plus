import { z } from "zod";
import { agentScopeSchema, buildAgentContext } from "./context.ts";
import { preflight } from "./rules.ts";
import { validateUnderstanding, understandingSchema } from "./schemas.ts";
import { renderDraft } from "./checks.ts";
import { choosePlan, hasPublicReply } from "./plan.ts";
import { ledgerSchema } from "./ledger.ts";

export type ModelStage = "understand" | "classify" | "write" | "rewrite";
export interface MockAgentModel {
  kind: "mock";
  complete(input: {
    stage: ModelStage;
    context: unknown;
    signal: AbortSignal;
  }): Promise<unknown>;
}
const requestSchema = z
  .object({
    scope: agentScopeSchema,
    data: z.unknown(),
    now: z.string().datetime({ offset: true }),
    timeoutMs: z.number().int().min(10).max(10000).default(8000),
  })
  .strict();
const resultSchema = z
  .object({
    json: z.unknown(),
    model: z.string().min(1).max(200),
    costUsd: z.literal("0"),
  })
  .strict();
export const turnResultSchema = z
  .object({
    mode: z.literal("draft"),
    ledger: ledgerSchema,
    outcome: z.enum(["drafted", "silent", "handoff", "fallback", "error"]),
    replyText: z.string().max(6000).nullable(),
    costUsd: z.literal("0"),
    packVersion: z.number().int().positive(),
    understanding: z.record(z.unknown()),
    decision: z.record(z.unknown()),
    checks: z.array(z.string()),
    provenance: z.array(
      z
        .object({
          kind: z.literal("knowledge"),
          version: z.number().int().positive(),
          reference: z.string(),
        })
        .strict(),
    ),
    models: z.array(
      z
        .object({
          stage: z.enum(["understand", "classify", "write", "rewrite"]),
          model: z.string(),
          costUsd: z.literal("0"),
          timingMs: z.number().nonnegative(),
        })
        .strict(),
    ),
    timingsMs: z.record(z.number().nonnegative()),
  })
  .strict();
export type TurnResult = z.infer<typeof turnResultSchema>;

/** D042: this orchestrator cannot spend money or send messages; live model selection remains a separate gate. */
export async function runAgentTurn(
  raw: unknown,
  model: MockAgentModel,
): Promise<TurnResult> {
  const request = requestSchema.parse(raw),
    ctx = buildAgentContext(request.scope, request.data);
  if (model.kind !== "mock")
    throw new Error("Live agent model is not enabled.");
  const result: TurnResult = {
    mode: "draft",
    ledger: { ...ctx.ledger },
    outcome: "silent",
    replyText: null,
    costUsd: "0",
    packVersion: ctx.packVersion,
    understanding: {},
    decision: { mock: true },
    checks: [],
    provenance: [],
    models: [],
    timingsMs: {},
  };
  const quiet =
    [ctx.quietUntil, ctx.ledger.vendorQuietUntil]
      .filter((value): value is string => value !== null)
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
  const fenceInput = {
    now: request.now,
    triggerId: ctx.scope.triggerMessageId,
    messages: ctx.allPublicMessages,
    quietUntil: quiet,
    openRequest: ctx.ledger.requestOpen,
    acknowledgements: ctx.pack.brand.localAcknowledgements,
  };
  // Global ordering protects against newer messages; closing only considers this session.
  const globalFence = preflight({ ...fenceInput, openRequest: true });
  if (!globalFence.reason && ctx.pendingVoice) {
    const repeated = ctx.session.messages.some(m => ["staff","bot"].includes(m.author) && m.content === ctx.pack.locked.unreadableHandoff);
    return turnResultSchema.parse({...result,ledger:{...ctx.ledger,handoff:true},outcome:repeated?"silent":"handoff",replyText:repeated?null:ctx.pack.locked.unreadableHandoff,
      understanding:{signals:[{kind:"unreadable"}]},decision:{mock:true,handoff:true,reason:"unreadable_voice"},checks:["voice_requires_review"]});
  }
  const fence = globalFence.reason
    ? globalFence
    : preflight({ ...fenceInput, messages: ctx.session.messages });
  if (fence.reason) {
    result.decision = { reason: fence.reason, mock: true };
    return result;
  }
  const deadline = performance.now() + 24000;
  const call = async (stage: ModelStage, context: unknown) => {
    const started = performance.now();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const remaining = Math.min(
      request.timeoutMs,
      Math.max(0, deadline - performance.now()),
    );
    let rawAnswer: unknown;
    try {
      rawAnswer = await Promise.race([
        model.complete({ stage, context, signal: controller.signal }),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error("Model stage unavailable."));
          }, remaining);
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
    const answer = resultSchema.parse(rawAnswer);
    if (Buffer.byteLength(JSON.stringify(answer.json), "utf8") > 64000)
      throw new Error("Model result too large.");
    const timingMs = Math.max(0, performance.now() - started);
    result.models.push({ stage, model: answer.model, costUsd: "0", timingMs });
    result.timingsMs[stage] = timingMs;
    return answer.json;
  };
  try {
    const understanding = validateUnderstanding(
      await call("understand", ctx.modelContext),
      ctx.session.messages,
      ctx.pack,
    );
    const classification = z
      .object({ signals: understandingSchema.shape.signals })
      .strict()
      .parse(await call("classify", ctx.modelContext));
    const combined = validateUnderstanding(
      {
        ...understanding,
        signals: [...understanding.signals, ...classification.signals],
      },
      ctx.session.messages,
      ctx.pack,
    );
    result.understanding = combined;
    result.ledger.language = combined.language;
    const plan = choosePlan(combined, ctx);
    result.decision = {
      reason: plan.reason,
      handoff: plan.handoff,
      mock: true,
    };
    result.ledger.handoff ||= plan.handoff;
    if (plan.kind === "locked") {
      result.outcome =
        plan.text === null ? "silent" : plan.handoff ? "handoff" : "drafted";
      result.replyText = plan.text;
      return turnResultSchema.parse(result);
    }
    const facts: Record<string, string> = {
      hours: ctx.pack.hours.default,
      about: ctx.pack.brand.oneLiner,
    };
    ctx.pack.services.forEach((service) => {
      facts["service:" + service.key] = service.name;
    });
    ctx.pack.policies.forEach((policy, index) => {
      facts["policy:" + index] = policy.answer;
    });
    const writeContext = {
      context: ctx.modelContext,
      facts,
      understanding: combined,
    };
    const check = (raw: unknown) => {
      const written = z
        .object({ text: z.string().min(1).max(6000) })
        .strict()
        .safeParse(raw);
      if (!written.success) return { ok: false as const, reason: "shape" };
      return renderDraft({
        text: written.data.text,
        latinScriptOnly: ctx.pack.brand.latinScriptOnly,
        facts,
        prices: ctx.currency
          ? ctx.pack.prices.map((price) => ({
              label: price.label,
              amount: price.amount,
              unit: price.unit,
              currency: ctx.currency!,
            }))
          : [],
        indicativeLabel: ctx.pack.agent?.indicativeLabel ?? null,
        links: {},
        previousReplies: ctx.session.messages
          .filter((m) => m.author === "staff" || m.author === "bot")
          .map((m) => m.content ?? ""),
        forbiddenTerms: result.models.map((m) => m.model),
      });
    };
    let checked = check(await call("write", writeContext));
    if (!checked.ok) {
      result.checks.push(checked.reason);
      checked = check(
        await call("rewrite", {
          ...writeContext,
          repairReason: checked.reason,
        }),
      );
    }
    if (!checked.ok) throw new Error("Draft validation failed.");
    result.outcome = "drafted";
    result.checks.push(
      ...checked.repairs.map((repair) => "repaired_" + repair),
    );
    result.replyText = checked.text;
    result.provenance = checked.factsUsed
      .filter((key) => key.startsWith("FACT:") || key.startsWith("PRICE:"))
      .map((key) => ({
        kind: "knowledge",
        version: ctx.packVersion,
        reference: key.startsWith("FACT:")
          ? key.slice(5)
          : "price:" + key.slice(6),
      }));
  } catch {
    result.outcome = "fallback";
    result.decision = {
      reason: "unavailable_or_unsafe",
      handoff: true,
      mock: true,
    };
    result.ledger.handoff = true;
    result.replyText = hasPublicReply(ctx, ctx.pack.locked.handoffLine)
      ? null
      : ctx.pack.locked.handoffLine;
    if (result.replyText === null) result.outcome = "silent";
    result.checks.push("unavailable_or_unsafe");
  }
  return turnResultSchema.parse(result);
}
