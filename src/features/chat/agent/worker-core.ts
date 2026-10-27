import { z } from "zod";
import { agentScopeSchema } from "./context.ts";
import { runAgentTurn, type MockAgentModel, type TurnResult } from "./turn.ts";
const statusSchema = z
  .object({ status: z.string().min(1).max(50) })
  .passthrough();
const inputSchema = z
  .object({
    scope: agentScopeSchema,
    now: z.string().datetime({ offset: true }),
    dryRun: z.boolean(),
    deliver: z.boolean(),
  })
  .strict();
export type MockTurnStore = {
  load(): Promise<unknown>;
  run(action: string, input: unknown): Promise<unknown>;
  dryRun(result?: TurnResult): Promise<unknown>;
  publicDelivery?(capability: {
    runId: string;
    leaseToken: string;
  }): Promise<{ status: string }>;
};
/** DB claims fence duplicate execution; a remote send is never retried after an ambiguous result. */
export async function runStoredMockTurn(
  raw: unknown,
  store: MockTurnStore,
  model: MockAgentModel,
  post: (input: {
    draftId: string;
    text: string;
    runId: string;
    leaseToken: string;
  }) => Promise<{ id: number }>,
): Promise<{ status: string }> {
  const input = inputSchema.parse(raw);
  if (model.kind !== "mock") throw new Error("Live model execution disabled.");
  if (input.dryRun) {
    if ((await store.dryRun()) !== null) return { status: "dry_run" };
    const result = await runAgentTurn(
      { scope: input.scope, now: input.now, data: await store.load() },
      model,
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
    const result = await runAgentTurn(
      { scope: input.scope, now: input.now, data: lease.context },
      model,
    );
    completed = statusSchema.parse(
      await store.run("complete", { ...capability, result }),
    );
  }
  if (completed.status !== "ready" || !input.deliver)
    return { status: completed.status };
  if (store.publicDelivery) {
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
