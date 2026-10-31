import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { chatwootOrigin, accountClient } from "../connection";
import { decryptChatSecret } from "../secrets";
import { createMockModel } from "./mock-model";
import { runStoredMockTurn } from "./worker-core";
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
};

/** D042: live models remain disabled. Only an explicitly enabled loopback mock can run. */
export async function processCapturedAgent(job: CapturedAgentJob) {
  if (process.env.CHAT_AGENT_ENABLED !== "true") return;
  try {
    const origin = chatwootOrigin(),
      url = new URL(origin);
    if (
      process.env.CHAT_AGENT_MODEL_MODE !== "mock" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
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
              process.env.CHAT_ACTIONS_ENABLED === "true"
                ? "chat_action_agent_run"
                : name,
              { ...args, p_action: action! },
            )
          : await db.rpc(
              name === "chat_agent_load" &&
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
    const data = await call("chat_agent_load", input);
    const voice = z
      .object({
        voice: z
          .object({ required: z.boolean(), enabled: z.boolean() })
          .passthrough()
          .nullish(),
      })
      .passthrough()
      .parse(data).voice;
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
    await runStoredMockTurn(
      {
        scope,
        now: new Date().toISOString(),
        dryRun: process.env.CHAT_DRY_RUN !== "false",
        deliver: process.env.CHAT_DRAFT_DELIVERY_ENABLED === "true",
      },
      {
        load: () => call("chat_agent_load", input),
        prepare: async (capability, context) =>
          voice?.required
            ? (await import("../voice/worker")).prepareCapturedVoice(
                job,
                capability,
                context,
              )
            : { status: "ready", data: context },
        run: (action, extra) =>
          call(
            "chat_agent_run",
            { ...input, ...z.record(z.unknown()).parse(extra) } as Json,
            action,
          ),
        publicDelivery: (capability) =>
          voice?.required ? Promise.resolve({status:"private" as const}) :
          tryPublicReply({ context, input, workspace: w, ...capability }),
        dryRun: (result) =>
          call("chat_agent_dry_run", {
            ...input,
            ...(result ? { result } : {}),
          } as Json),
      },
      model,
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
        return new ChatwootMessageClient({ origin, token }).postPrivateDraft({
          draftId: draft.draftId,
          text: draft.text,
          ...target,
        });
      },
    );
    await deliverHandoffLabel(context, input, w);
    const capability = capabilities.at(-1);
    if (capability)
      await prepareSupplementals(
        context,
        input,
        capability,
        w.tenantId,
        !voice?.required && job.channel.mode === "auto" &&
          process.env.CHAT_PUBLIC_REPLY_ENABLED === "true",
      );
  } catch {
    // Preserve claims for recovery. Error details, URLs and credentials must never reach logs/customer text.
    console.warn("Chat agent processing unavailable.");
  }
}
