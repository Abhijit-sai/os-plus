import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { chatwootOrigin, accountClient } from "../connection";
import { decryptChatSecret } from "../secrets";
import { createMockModel } from "./mock-model";
import { runStoredAgentTurn, type AgentModelFactory } from "./worker-core";
import { customerLookupKind, customerLookupSchema } from "./customer-lookup.ts";
import { matchesScopedDraftChannel, selectAgentRuntime } from "./runtime-config";
import { allowsPilotContext, allowsPilotScope } from "./live-draft-pilot";
import { createLiveModel } from "./live-model";
import { OpenRouterClient } from "@/integrations/openrouter/client";
import { ChatwootMessageClient } from "@/integrations/chatwoot/message-client";
import { tryPublicReply } from "../actions/public-worker";
import { deliverHandoffLabel } from "../actions/label-worker";
import { prepareSupplementals } from "../actions/supplemental-worker";
import type { CaptureWorkspace, CaptureChannel } from "../ingress";
import type { Json } from "@/types/database";
export type CapturedAgentJob = {
  workspace: CaptureWorkspace;
  channel: CaptureChannel;
  conversationId: string;
  triggerMessageId: string;
  inboxId: number;
  verifiedPhone?: string | null;
};

/** Live delivery is scoped to the configured inbox and its saved reply mode. */
export async function processCapturedAgent(job: CapturedAgentJob) {
  if (process.env.CHAT_AGENT_ENABLED !== "true") return;
  try {
    const origin = chatwootOrigin(),
      runtime = selectAgentRuntime(process.env, origin);
    if (!runtime) return;
    const channelScope = runtime.kind === "live" ? runtime.channelScope : undefined;
    const liveAuto = runtime.kind === "live" && channelScope !== undefined && job.channel.mode === "auto";
    if (runtime.kind === "live" && job.channel.mode !== "draft" && !liveAuto) return;
    if (channelScope && !matchesScopedDraftChannel(channelScope, job.workspace, job.channel, job.inboxId))
      return;
    const db = createSupabaseServiceRoleClient(),
      w = job.workspace;
    const context = {
      tenantId: w.tenantId,
      actor: { type: "WEBHOOK", id: "chatwoot" },
      source: "WEBHOOK",
      correlationId: randomUUID(),
    };
    const scope = {
      tenantId: w.tenantId,
      workspaceId: w.id,
      channelId: job.channel.id,
      conversationId: job.conversationId,
      triggerMessageId: job.triggerMessageId,
    };
    const pilot = runtime.kind === "live" ? runtime.pilot : undefined;
    if (pilot && !allowsPilotScope(pilot, scope)) return;
    const input = {
      workspaceId: w.id,
      secretHash: w.secretHash,
      channelId: job.channel.id,
      conversationId: job.conversationId,
      triggerMessageId: job.triggerMessageId,
    };
    const capabilities: { runId: string; leaseToken: string }[] = [];
    const call = async (
      name:
        | "chat_agent_load"
        | "chat_agent_run"
        | "chat_agent_dry_run"
        | "chat_agent_target",
      body: Json,
      action?: string,
    ) => {
      let observedAssigneeId: number | null = null;
      if (
        name === "chat_agent_run" &&
        action === "complete" &&
        runtime.kind === "mock" &&
        process.env.CHAT_ACTIONS_ENABLED === "true"
      ) {
        try {
          const routing = await db.rpc("chat_agent_routing", {
            p_context: context,
            p_input: input,
          });
          if (routing.error) throw new Error("Routing unavailable");
          const target = z
            .object({
              conversationId: z.number().int().positive().safe(),
              inboxId: z.number().int().positive().safe(),
            })
            .strict()
            .parse(routing.data);
          const workspace = await db
            .from("chat_workspaces")
            .select("*")
            .eq("tenant_id", w.tenantId)
            .eq("id", w.id)
            .eq("status", "active")
            .single();
          if (workspace.error) throw new Error("Routing unavailable");
          observedAssigneeId = (
            await accountClient(workspace.data).conversationRouting(
              w.accountId,
              target.conversationId,
              target.inboxId,
            )
          ).assigneeId;
        } catch {
          /* An unavailable provider must not drop a durable safety handoff. */
        }
        body = {
          ...z.record(z.unknown()).parse(body),
          observedAssigneeId,
        } as Json;
      }
      const args = { p_context: context as Json, p_input: body };
      const response =
        name === "chat_agent_run"
          ? await db.rpc(
              runtime.kind === "live"
                ? "chat_live_agent_run"
                : process.env.CHAT_ACTIONS_ENABLED === "true"
                  ? "chat_action_agent_run"
                  : name,
              { ...args, p_action: action! },
            )
          : await db.rpc(
              name === "chat_agent_load" &&
                runtime.kind === "mock" &&
                process.env.CHAT_ACTIONS_ENABLED === "true"
                ? "chat_action_agent_load"
                : name,
              args,
            );
      if (response.error) throw new Error("Agent storage unavailable.");
      if (name === "chat_agent_run" && action === "claim") {
        const lease = z
          .object({ runId: z.string().uuid(), leaseToken: z.string().uuid() })
          .passthrough()
          .safeParse(response.data);
        if (lease.success)
          capabilities.push({
            runId: lease.data.runId,
            leaseToken: lease.data.leaseToken,
          });
      }
      return response.data;
    };
    const scopedContext = (raw: unknown) => {
      if (!channelScope) return null;
      const data = z.object({
        brandId: z.literal(channelScope.brandId),
        channelKind: z.literal("whatsapp"),
        agentMode: z.literal(job.channel.mode),
        messages: z.array(z.object({
          id: z.string().uuid(),
          at: z.string().datetime({ offset: true }),
          inputSource: z.string().optional(),
        }).passthrough()),
      }).passthrough().safeParse(raw);
      if (!data.success) return null;
      const messages = data.data.messages.filter((message) => message.inputSource !== "voice");
      const trigger = messages.find((message) => message.id === job.triggerMessageId);
      if (!trigger || Date.parse(trigger.at) < Date.parse(channelScope.startsAt)) return null;
      return { ...data.data, background: null, locations: [], messages };
    };
    const data = await call("chat_agent_load", input);
    if (channelScope && !scopedContext(data)) return;
    if (pilot && !allowsPilotContext(pilot, scope, data)) return;
    const voice = z
      .object({
        voice: z
          .object({ required: z.boolean(), enabled: z.boolean() })
          .passthrough()
          .nullish(),
      })
      .passthrough()
      .parse(data).voice;
    if (runtime.kind === "live" && voice?.required) return;
    // Capture remains available to staff; disabled/preview voice never runs a text fallback or paid preprocessing.
    if (
      voice?.required &&
      (!voice.enabled ||
        process.env.CHAT_VOICE_ENABLED !== "true" ||
        process.env.CHAT_TRANSCRIPTION_MODE !== "mock" ||
        process.env.CHAT_DRY_RUN !== "false")
    )
      return;
    const pack = z
      .object({ pack: z.object({ body: z.unknown() }).passthrough() })
      .passthrough()
      .parse(data).pack.body;
    const latest =
      z
        .object({
          messages: z.array(
            z
              .object({
                author: z.string(),
                private: z.boolean(),
                content: z.string().nullable(),
              })
              .passthrough(),
          ),
        })
        .passthrough()
        .parse(data)
        .messages.filter((m) => m.author === "customer" && !m.private)
        .at(-1)?.content ?? "";
    const scenario =
      process.env.CHAT_ACTIONS_ENABLED === "true"
        ? (/^CH(?:6|8) synthetic (booking|confirm|cancel|complaint|financial|payment_claim|identity|vendor|location|price_list):/i
            .exec(latest)?.[1]
            .toLowerCase() ?? "information")
        : "information";
    const model: import("./turn").MockAgentModel = {
      kind: "mock",
      async complete(args) {
        const raw = z
          .object({
            messages: z
              .array(
                z
                  .object({
                    author: z.string(),
                    content: z.string().nullable(),
                  })
                  .passthrough(),
              )
              .optional(),
            context: z
              .object({
                messages: z
                  .array(
                    z
                      .object({
                        author: z.string(),
                        content: z.string().nullable(),
                      })
                      .passthrough(),
                  )
                  .optional(),
              })
              .passthrough()
              .optional(),
          })
          .passthrough()
          .parse(args.context);
        const messages = raw.messages ?? raw.context?.messages;
        const text =
          messages?.filter((m) => m.author === "customer").at(-1)?.content ??
          latest;
        const selected =
          process.env.CHAT_ACTIONS_ENABLED === "true"
            ? (/^CH(?:6|8) synthetic (booking|confirm|cancel|complaint|financial|payment_claim|identity|vendor|location|price_list):/i
                .exec(text)?.[1]
                .toLowerCase() ?? scenario)
            : "information";
        return createMockModel(selected, pack).complete(args);
      },
    };
    const factory: AgentModelFactory =
      runtime.kind === "live"
        ? {
            kind: "live",
            create(capability) {
              return createLiveModel(
                runtime.config,
                {
                  async run(action, extra) {
                    if (action === "budget.reserve" && pilot && !allowsPilotScope(pilot, scope))
                      return { admitted: false };
                    return call(
                      "chat_agent_run",
                      {
                        ...input,
                        ...capability,
                        ...z.record(z.unknown()).parse(extra),
                      } as Json,
                      action,
                    );
                  },
                },
                new OpenRouterClient({
                  token: process.env.OPENROUTER_API_KEY!,
                }),
                pilot ? () => allowsPilotScope(pilot, scope) : undefined,
                liveAuto,
              );
            },
          }
        : { kind: "mock", create: () => model };
    await runStoredAgentTurn(
      {
        scope,
        now: new Date().toISOString(),
        dryRun: process.env.CHAT_DRY_RUN !== "false",
        deliver: process.env.CHAT_DRAFT_DELIVERY_ENABLED === "true",
        publicAuto: liveAuto,
      },
      {
        load: () => call("chat_agent_load", input),
        async prepare(capability, loadedContext) {
          if (pilot && !allowsPilotContext(pilot, scope, loadedContext))
            return { status: "pilot_scope_changed" };
          if (channelScope) {
            const data = scopedContext(loadedContext);
            if (!data) return { status: "draft_scope_changed" };
            const trigger = data.messages.find((message) => message.id === job.triggerMessageId);
            const kind = liveAuto && process.env.VERCEL_ENV === "production" && typeof trigger?.content === "string"
              ? customerLookupKind(trigger.content) : null;
            if (kind && job.verifiedPhone) {
              const lookup = await db.rpc("chat_live_auto_customer_lookup", {
                p_context: context,
                p_input: { ...input, verifiedPhone: job.verifiedPhone, kind },
              });
              const checked = customerLookupSchema.safeParse(lookup.error ? null : lookup.data);
              return { status: "ready", data, customerLookup: checked.success ? checked.data : undefined };
            }
            return { status: "ready", data };
          }
          if (!voice?.required) return { status: "ready", data: loadedContext };
          return (await import("../voice/worker")).prepareCapturedVoice(job, capability, loadedContext);
        },
        async run(action, extra) {
          if (action === "delivery.claim" && pilot && !allowsPilotScope(pilot, scope))
            return { status: "pilot_expired" };
          return call(
            "chat_agent_run",
            { ...input, ...z.record(z.unknown()).parse(extra) } as Json,
            action,
          );
        },
        publicDelivery:
          !voice?.required && (runtime.kind === "mock" || liveAuto)
            ? (capability) =>
                tryPublicReply({
                  context,
                  input,
                  workspace: w,
                  ...capability,
                  ...(liveAuto ? { liveAccountId: w.accountId, verifiedPhone: job.verifiedPhone } : {}),
                })
            : undefined,
        dryRun: (result) =>
          call("chat_agent_dry_run", {
            ...input,
            ...(result ? { result } : {}),
          } as Json),
      },
      factory,
      async (draft) => {
        if (process.env.CHAT_AGENT_ENABLED !== "true")
          throw new Error("Agent disabled.");
        const target = z
          .object({
            accountId: z.number().int().positive().safe(),
            conversationId: z.number().int().positive().safe(),
            triggerProviderId: z.number().int().positive().safe(),
            knowledgeVersion: z.number().int().positive(),
          })
          .strict()
          .parse(
            await call("chat_agent_target", {
              ...input,
              runId: draft.runId,
              leaseToken: draft.leaseToken,
            }),
          );
        const workspace = await db
          .from("chat_workspaces")
          .select("*")
          .eq("tenant_id", w.tenantId)
          .eq("id", w.id)
          .eq("status", "active")
          .maybeSingle();
        if (
          workspace.error ||
          !workspace.data ||
          workspace.data.chatwoot_base_url !== origin ||
          Number(workspace.data.chatwoot_account_id) !== target.accountId ||
          !workspace.data.bot_token_enc
        )
          throw new Error("Draft transport unavailable.");
        const token = decryptChatSecret(workspace.data.bot_token_enc, {
          tenantId: w.tenantId,
          workspaceId: w.id,
          purpose: "bot_token",
        });
        if (pilot && !allowsPilotScope(pilot, scope))
          throw new Error("Draft pilot expired.");
        return new ChatwootMessageClient({ origin, token }).postPrivateDraft({
          draftId: draft.draftId,
          text: draft.text,
          ...target,
        });
      },
    );
    if (runtime.kind === "live") {
      if (liveAuto) await deliverHandoffLabel(context, input, w, true);
      return;
    }
    await deliverHandoffLabel(context, input, w);
    const capability = capabilities.at(-1);
    if (capability)
      await prepareSupplementals(
        context,
        input,
        capability,
        w.tenantId,
        !voice?.required &&
          job.channel.mode === "auto" &&
          process.env.CHAT_PUBLIC_REPLY_ENABLED === "true",
      );
  } catch {
    // Preserve claims for recovery. Error details, URLs and credentials must never reach logs/customer text.
    console.warn("Chat agent processing unavailable.");
  }
}
