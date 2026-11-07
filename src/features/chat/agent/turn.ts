import { z } from "zod";
import { agentScopeSchema, buildAgentContext } from "./context.ts";
import { preflight } from "./rules.ts";
import { validateUnderstanding, understandingSchema } from "./schemas.ts";
import { renderDraft } from "./checks.ts";
import { choosePlan, hasPublicReply } from "./plan.ts";
import { automaticReplyContext, checkedAutomaticReply, immediateAutomaticReply } from "./automatic-reply.ts";
import { customerTextSchema } from "../actions/customer-text.ts";
import { ledgerSchema } from "./ledger.ts";
import { addUsd, usd } from "./budget.ts";

export type ModelStage = "understand" | "classify" | "write" | "rewrite";
export interface AgentModel {
  kind: "mock" | "live";
  complete(input: {
    stage: ModelStage;
    context: unknown;
    signal: AbortSignal;
  }): Promise<unknown>;
}
export interface MockAgentModel extends AgentModel {
  kind: "mock";
}
/** Sanitized paid failure: retains only accounting metadata, never provider text. */
export class AgentModelCallError extends Error {
  readonly model: string;
  readonly costUsd: string | null;
  constructor(model: string, costUsd: string | null) {
    super("Model stage unavailable.");
    this.model = model;
    this.costUsd = costUsd;
  }
}
const requestSchema = z
  .object({
    scope: agentScopeSchema,
    data: z.unknown(),
    now: z.string().datetime({ offset: true }),
    timeoutMs: z.number().int().min(10).max(10000).default(8000),
    allowAutomatic: z.boolean().default(false),
    orderStatus: z.string().optional(),
  })
  .strict();
const resultSchema = z
  .object({
    json: z.unknown(),
    model: z.string().min(1).max(200),
    costUsd: usd,
  })
  .strict();
export const turnResultSchema = z
  .object({
    mode: z.literal("draft"),
    ledger: ledgerSchema,
    outcome: z.enum(["drafted", "silent", "handoff", "fallback", "error"]),
    replyText: z.string().max(6000).nullable(),
    costUsd: usd,
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
          costUsd: usd,
          timingMs: z.number().nonnegative(),
        })
        .strict(),
    ),
    timingsMs: z.record(z.number().nonnegative()),
  })
  .strict();
export type TurnResult = z.infer<typeof turnResultSchema>;

/** Pure draft orchestration; the configured model adapter owns paid admission/accounting, never delivery. */
export async function runAgentTurn(
  raw: unknown,
  model: AgentModel,
): Promise<TurnResult> {
  const request = requestSchema.parse(raw),
    ctx = buildAgentContext(request.scope, request.data);
  if (model.kind !== "mock" && model.kind !== "live")
    throw new Error("Live agent model is not enabled.");
  const automatic = model.kind === "live" && ctx.agentMode === "auto";
  if (automatic && !request.allowAutomatic)
    throw new Error("Live assistance supports private drafts only without an automatic delivery scope.");
  const result: TurnResult = {
    mode: "draft",
    ledger: { ...ctx.ledger },
    outcome: "silent",
    replyText: null,
    costUsd: "0",
    packVersion: ctx.packVersion,
    understanding: {},
    decision: { mock: model.kind === "mock" },
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
    const repeated = ctx.session.messages.some(
      (m) =>
        ["staff", "bot"].includes(m.author) &&
        m.content === ctx.pack.locked.unreadableHandoff,
    );
    return turnResultSchema.parse({
      ...result,
      ledger: { ...ctx.ledger, handoff: true },
      outcome: repeated ? "silent" : "handoff",
      replyText: repeated ? null : ctx.pack.locked.unreadableHandoff,
      understanding: { signals: [{ kind: "unreadable" }] },
      decision: { mock: true, handoff: true, reason: "unreadable_voice" },
      checks: ["voice_requires_review"],
    });
  }
  const fence = globalFence.reason
    ? globalFence
    : preflight({ ...fenceInput, messages: ctx.session.messages });
  if (fence.reason) {
    result.decision = { reason: fence.reason, mock: model.kind === "mock" };
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
    } catch (error) {
      if (
        model.kind === "live" &&
        error instanceof AgentModelCallError &&
        error.costUsd !== null
      ) {
        const costUsd = usd.parse(error.costUsd),
          timingMs = Math.max(0, performance.now() - started);
        result.models.push({
          stage,
          model: error.model,
          costUsd,
          timingMs,
        });
        result.costUsd = addUsd(result.costUsd, costUsd);
        result.timingsMs[stage] = timingMs;
      }
      throw error;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
    const answer = resultSchema.parse(rawAnswer);
    if (model.kind === "mock" && answer.costUsd !== "0")
      throw new Error("Mock model cannot incur costs.");
    if (Buffer.byteLength(JSON.stringify(answer.json), "utf8") > 64000)
      throw new Error("Model result too large.");
    const timingMs = Math.max(0, performance.now() - started);
    result.models.push({
      stage,
      model: answer.model,
      costUsd: answer.costUsd,
      timingMs,
    });
    result.costUsd = addUsd(result.costUsd, answer.costUsd);
    result.timingsMs[stage] = timingMs;
    return answer.json;
  };
  try {
    if (automatic) {
      const { unanswered, facts } = automaticReplyContext(ctx);
      const immediate = immediateAutomaticReply(ctx, unanswered, request.orderStatus);
      const selection = immediate ? null : z.object({ fact: z.string().nullable() })
        .strict().parse(await call("write", { unanswered, facts })).fact;
      const grounded = immediate?.text ?? checkedAutomaticReply(facts, selection);
      const handoff = immediate?.handoff ?? grounded === null;
      const text = customerTextSchema.parse(grounded ??
        "Could you share a little more about what you’re looking for? Our team can help with the details.");
      result.decision = { automatic: true, reason: handoff ? "person_required" : "information", handoff, mock: false };
      if (immediate?.verifiedOrderStatus) result.decision.verifiedOrderStatus = immediate.verifiedOrderStatus;
      if (selection && grounded)
        result.provenance.push({ kind: "knowledge", version: ctx.packVersion, reference: selection });
      result.ledger.handoff ||= handoff;
      result.replyText = (handoff || immediate?.once) && hasPublicReply(ctx, text) ? null : text;
      result.outcome = result.replyText === null ? "silent" : handoff ? "handoff" : "drafted";
      return turnResultSchema.parse(result);
    }
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
      mock: model.kind === "mock",
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
      // Live output selects approved facts; the model cannot introduce factual prose.
      if (model.kind === "live") {
        const factTokens =
          written.data.text.match(/\{\{FACT:[a-zA-Z0-9_:-]+\}\}/gu) ?? [];
        const connective = written.data.text.replace(
          /\{\{FACT:[a-zA-Z0-9_:-]+\}\}/gu,
          "",
        );
        if (
          factTokens.length === 0 ||
          /[^\s.,;:!?()\u2014\u2013-]/u.test(connective)
        )
          return { ok: false as const, reason: "unapproved_live_prose" };
      }
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
      mock: model.kind === "mock",
    };
    result.ledger.handoff = true;
    const fallback = automatic
      ? "I’m having trouble checking that right now. Our team can help with the details."
      : ctx.pack.locked.handoffLine;
    if (automatic) result.decision.automatic = true;
    result.replyText = hasPublicReply(ctx, fallback)
      ? null
      : fallback;
    if (result.replyText === null) result.outcome = "silent";
    result.checks.push("unavailable_or_unsafe");
  }
  return turnResultSchema.parse(result);
}
