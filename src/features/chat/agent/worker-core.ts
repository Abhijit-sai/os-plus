import { z } from "zod";
import { agentScopeSchema } from "./context.ts";
import type { CustomerLookup } from "./customer-lookup.ts";
import {
  runAgentTurn,
  type AgentModel,
  type MockAgentModel,
  type TurnResult,
} from "./turn.ts";
const statusSchema = z
  .object({ status: z.string().min(1).max(50) })
  .passthrough();
const inputSchema = z
  .object({
    scope: agentScopeSchema,
    now: z.string().datetime({ offset: true }),
    dryRun: z.boolean(),
    deliver: z.boolean(),
    publicAuto: z.boolean().default(false),
  })
  .strict();
export type MockTurnStore = {
  load(): Promise<unknown>;
  run(action: string, input: unknown): Promise<unknown>;
  dryRun(result?: TurnResult): Promise<unknown>;
  prepare?(
    capability: { runId: string; leaseToken: string },
    data: unknown,
  ): Promise<{ status: string; data?: unknown; result?: TurnResult; customerLookup?: CustomerLookup }>;
  publicDelivery?(capability: {
    runId: string;
    leaseToken: string;
  }): Promise<{ status: string }>;
};
export type AgentModelFactory = {
  kind: "mock" | "live";
  create(capability: { runId: string; leaseToken: string }): AgentModel;
};
/** Preserve the released mock interface and its no-paid-model guarantee. */
export async function runStoredMockTurn(
  raw: unknown,
  store: MockTurnStore,
  model: MockAgentModel,
  post: Parameters<typeof runStoredAgentTurn>[3],
): Promise<{ status: string }> {
  if (model.kind !== "mock") throw new Error("Live model execution disabled.");
  return runStoredAgentTurn(
    raw,
    store,
    { kind: "mock", create: () => model },
    post,
  );
}
/** DB claims fence duplicate execution; a remote send is never retried after an ambiguous result. */
export async function runStoredAgentTurn(
  raw: unknown,
  store: MockTurnStore,
  factory: AgentModelFactory,
  post: (input: {
    draftId: string;
    text: string;
    runId: string;
    leaseToken: string;
  }) => Promise<{ id: number }>,
): Promise<{ status: string }> {
  const input = inputSchema.parse(raw);
  if (input.dryRun && factory.kind === "live") {
    await store.dryRun();
    return { status: "dry_run" };
  }
  if (input.dryRun) {
    if ((await store.dryRun()) !== null) return { status: "dry_run" };
    const result = await runAgentTurn(
      { scope: input.scope, now: input.now, data: await store.load() },
      factory.create({
        runId: "00000000-0000-4000-8000-000000000000",
        leaseToken: "00000000-0000-4000-8000-000000000000",
      }),
    );
    await store.dryRun(result);
    return { status: "dry_run" };
  }
  const claim = statusSchema.parse(await store.run("claim", {}));
  if (!["claimed", "ready"].includes(claim.status))
    return { status: claim.status };
  const lease = z
    .object({
      runId: z.string().uuid(),
      leaseToken: z.string().uuid(),
      context: z.unknown(),
    })
    .passthrough()
    .parse(claim);
  const capability = { runId: lease.runId, leaseToken: lease.leaseToken };
  let completed = { status: claim.status };
  if (claim.status === "claimed") {
    const prepared = store.prepare
      ? await store.prepare(capability, lease.context)
      : { status: "ready", data: lease.context };
    if (!["ready", "unreadable"].includes(prepared.status))
      return { status: prepared.status };
    const result =
      prepared.result ??
      (await runAgentTurn(
        {
          scope: input.scope, now: input.now, data: prepared.data,
          allowAutomatic: input.publicAuto,
          customerLookup: "customerLookup" in prepared ? prepared.customerLookup : undefined,
        },
        factory.create(capability),
      ));
    completed = statusSchema.parse(
      await store.run("complete", { ...capability, result }),
    );
  }
  if (completed.status !== "ready" || !input.deliver)
    return { status: completed.status };
  if (store.publicDelivery && (factory.kind === "mock" || input.publicAuto)) {
    const publicResult = await store.publicDelivery(capability);
    if (publicResult.status !== "private") return publicResult;
  }
  const delivery = statusSchema.parse(
    await store.run("delivery.claim", capability),
  );
  if (delivery.status !== "delivering") return { status: delivery.status };
  const draft = z
    .object({
      draftId: z.string().uuid(),
      replyText: z.string().min(1).max(6000),
    })
    .passthrough()
    .parse(delivery);
  try {
    const receipt = z
      .object({ id: z.number().int().positive().safe() })
      .strict()
      .parse(
        await post({
          draftId: draft.draftId,
          text: draft.replyText,
          ...capability,
        }),
      );
    return {
      status: statusSchema.parse(
        await store.run("delivery.record", {
          ...capability,
          providerNoteId: receipt.id,
        }),
      ).status,
    };
  } catch {
    try {
      await store.run("delivery.uncertain", capability);
    } catch {
      /* Retain the original delivering state; duplicate claims remain blocked. */
    }
    return { status: "uncertain" };
  }
}
