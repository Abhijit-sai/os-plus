import "server-only";
import { z } from "zod";

const id = z.number().int().positive().safe();
const remoteUrl = z
  .string()
  .url()
  .max(8192)
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" && !url.username && !url.password && !url.hash
    );
  });
const botSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  account_id: id.nullable(),
  outgoing_url: remoteUrl,
  access_token: z.string().min(1).max(8192),
});
const webhookSchema = z.object({
  id,
  url: remoteUrl,
  subscriptions: z.array(z.string().max(100)).max(100),
});
const projectBot = (bot: z.infer<typeof botSchema>) => ({
  id: bot.id,
  name: bot.name,
  accountId: bot.account_id,
  url: bot.outgoing_url,
  token: bot.access_token,
});
const accountSchema = z.object({ id, name: z.string().trim().min(1).max(200) });
const inboxSchema = z.object({
  id,
  name: z.string().trim().min(1).max(200),
  channel_type: z.string().min(1).max(100),
});
export type ChatInbox = {
  id: number;
  name: string;
  kind: "whatsapp" | "instagram" | "facebook" | "website";
};
const kinds: Record<string, ChatInbox["kind"] | undefined> = {
  "Channel::Whatsapp": "whatsapp",
  "Channel::Instagram": "instagram",
  "Channel::FacebookPage": "facebook",
  "Channel::WebWidget": "website",
};

/** Pinned Chatwoot v4.18.0 APIs. Response projection intentionally discards provider credentials. */
export class ChatwootAdminClient {
  private origin: string;
  private token: string;
  private timeoutMs: number;
  constructor(options: {
    origin: string;
    token: string;
    allowLocalMock?: boolean;
    timeoutMs?: number;
  }) {
    const parsed = new URL(options.origin);
    const local =
      options.allowLocalMock === true &&
      parsed.hostname === "127.0.0.1" &&
      parsed.protocol === "http:";
    if (
      (!local && parsed.protocol !== "https:") ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname !== "/"
    ) {
      throw new Error("Chat connection unavailable.");
    }
    this.origin = parsed.origin;
    this.token = z.string().min(1).max(8192).parse(options.token);
    this.timeoutMs = options.timeoutMs ?? 8000;
  }
  private async request(
    path: string,
    body?: unknown,
    allowEmpty = false,
  ): Promise<unknown> {
    try {
      const response = await fetch(this.origin + path, {
        method: body === undefined ? "GET" : "POST",
        redirect: "error",
        cache: "no-store",
        headers: {
          "api-access-token": this.token,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error("Request failed");
      }
      if (!response.body) {
        if (allowEmpty) return null;
        throw new Error("Empty response");
      }
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const item = await reader.read();
          if (item.done) break;
          size += item.value.byteLength;
          if (size > 1048576) throw new Error("Response too large");
          chunks.push(item.value);
        }
      } finally {
        await reader.cancel();
      }
      if (size === 0 && allowEmpty) return null;
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new Error("Chat connection unavailable.");
    }
  }
  async conversationRouting(
    accountId: number,
    conversationId: number,
    inboxId: number,
  ) {
    try {
      const account = id.parse(accountId),
        conversation = id.parse(conversationId),
        inbox = id.parse(inboxId);
      const value = z
        .object({
          id,
          account_id: id,
          inbox_id: id,
          meta: z.object({ assignee: z.object({ id }).nullable().optional() }),
        })
        .parse(
          await this.request(
            "/api/v1/accounts/" + account + "/conversations/" + conversation,
          ),
        );
      if (
        value.id !== conversation ||
        value.account_id !== account ||
        value.inbox_id !== inbox
      )
        throw new Error("Scope mismatch");
      return { assigneeId: value.meta.assignee?.id ?? null };
    } catch {
      throw new Error("Conversation routing unavailable.");
    }
  }
  async createAccount(name: string, provisioningKey: string) {
    try {
      const input = z
        .object({
          name: z.string().trim().min(1).max(160),
          key: z.string().uuid(),
        })
        .parse({ name, key: provisioningKey });
      return accountSchema.parse(
        await this.request("/platform/api/v1/accounts", {
          name: input.name,
          custom_attributes: { osplus_provisioning_key: input.key },
        }),
      );
    } catch {
      throw new Error("Chat connection unavailable.");
    }
  }
  async verifyProvisionedAccount(accountId: number, provisioningKey: string) {
    try {
      const expected = id.parse(accountId);
      const schema = accountSchema.extend({
        custom_attributes: z.object({
          osplus_provisioning_key: z.string().uuid(),
        }),
      });
      const result = schema.parse(
        await this.request("/platform/api/v1/accounts/" + expected),
      );
      if (
        result.id !== expected ||
        result.custom_attributes.osplus_provisioning_key !==
          z.string().uuid().parse(provisioningKey)
      )
        throw new Error("Reconciliation mismatch");
      return { id: result.id, name: result.name };
    } catch {
      throw new Error("Chat connection unavailable.");
    }
  }
  async verifyAccount(accountId: number) {
    try {
      const expected = id.parse(accountId);
      const result = accountSchema.parse(
        await this.request("/api/v1/accounts/" + expected),
      );
      if (result.id !== expected) throw new Error("Account mismatch");
      return result;
    } catch {
      throw new Error("Chat connection unavailable.");
    }
  }
  async websiteInbox(accountId: number, inboxId: number) {
    try {
      const expected = id.parse(inboxId);
      const value = z
        .object({
          id,
          name: z.string().trim().min(1).max(200),
          channel_type: z.literal("Channel::WebWidget"),
          website_token: z
            .string()
            .min(16)
            .max(200)
            .regex(/^[A-Za-z0-9_-]+$/),
          pre_chat_form_enabled: z.boolean(),
        })
        .parse(
          await this.request(
            "/api/v1/accounts/" + id.parse(accountId) + "/inboxes/" + expected,
          ),
        );
      if (value.id !== expected) throw Error("Inbox mismatch");
      return {
        id: value.id,
        name: value.name,
        websiteToken: value.website_token,
        preChatEnabled: value.pre_chat_form_enabled,
      };
    } catch {
      throw Error("Website inbox unavailable.");
    }
  }
  async listInboxes(accountId: number): Promise<ChatInbox[]> {
    try {
      const result = z
        .object({ payload: z.array(inboxSchema).max(1000) })
        .parse(
          await this.request(
            "/api/v1/accounts/" + id.parse(accountId) + "/inboxes",
          ),
        );
      if (
        new Set(result.payload.map((inbox) => inbox.id)).size !==
        result.payload.length
      )
        throw new Error("Duplicate inbox");
      return result.payload.flatMap((inbox) => {
        const kind = kinds[inbox.channel_type];
        return kind ? [{ id: inbox.id, name: inbox.name, kind }] : [];
      });
    } catch {
      throw new Error("Chat connection unavailable.");
    }
  }

  async addLabels(accountId: number, conversationId: number, added: string[]) {
    try {
      const labels = z.array(z.string().trim().min(1).max(100)).max(100);
      const path =
        "/api/v1/accounts/" +
        id.parse(accountId) +
        "/conversations/" +
        id.parse(conversationId) +
        "/labels";
      const input = labels.parse(added);
      const current = z
        .object({ payload: labels })
        .parse(await this.request(path));
      const merged = [...new Set([...current.payload, ...input])];
      // Chatwoot replaces all labels. Read/merge preserves unrelated labels in this snapshot.
      // The remote API offers no compare-and-swap; concurrent external edits need reconciliation.
      return z
        .object({ payload: labels })
        .parse(await this.request(path, { labels: merged })).payload;
    } catch {
      throw new Error("Chat connection unavailable.");
    }
  }

  async createUser(name: string, email: string) {
    try {
      const input = z
        .object({
          name: z.string().trim().min(1).max(160),
          email: z.string().email().max(254),
        })
        .parse({ name, email });
      return z
        .object({ id, name: z.string(), email: z.string().email() })
        .parse(await this.request("/platform/api/v1/users", input));
    } catch {
      throw new Error("Chat connection unavailable.");
    }
  }
  async listAgentBots() {
    try {
      return z
        .array(botSchema)
        .max(1000)
        .parse(await this.request("/platform/api/v1/agent_bots"))
        .map(projectBot);
    } catch {
      throw new Error("Chat connection unavailable.");
    }
  }
  async createAgentBot(accountId: number, name: string, url: string) {
    try {
      const input = z
        .object({
          account_id: id,
          name: z.string().trim().min(1).max(160),
          outgoing_url: remoteUrl,
        })
        .parse({ account_id: accountId, name, outgoing_url: url });
      const result = botSchema.parse(
        await this.request("/platform/api/v1/agent_bots", input),
      );
      if (
        result.account_id !== input.account_id ||
        result.outgoing_url !== input.outgoing_url
      )
        throw new Error("Bot mismatch");
      return projectBot(result);
    } catch {
      throw new Error("Chat connection unavailable.");
    }
  }
  async listWebhooks(accountId: number) {
    try {
      return z
        .object({
          payload: z.object({ webhooks: z.array(webhookSchema).max(1000) }),
        })
        .parse(
          await this.request(
            "/api/v1/accounts/" + id.parse(accountId) + "/webhooks",
          ),
        ).payload.webhooks;
    } catch {
      throw new Error("Chat connection unavailable.");
    }
  }
  async createWebhook(accountId: number, url: string) {
    try {
      const endpoint = remoteUrl.parse(url);
      const result = z
        .object({ payload: z.object({ webhook: webhookSchema }) })
        .parse(
          await this.request(
            "/api/v1/accounts/" + id.parse(accountId) + "/webhooks",
            { webhook: { url: endpoint, subscriptions: ["message_created"] } },
          ),
        ).payload.webhook;
      if (
        result.url !== endpoint ||
        !result.subscriptions.includes("message_created")
      )
        throw new Error("Webhook mismatch");
      return result;
    } catch {
      throw new Error("Chat connection unavailable.");
    }
  }
  async getInboxBot(accountId: number, inboxId: number) {
    try {
      const result = z
        .union([
          z.object({ agent_bot: z.object({ id }).nullable() }),
          // v4.18 Jbuilder omits the key when no bot is assigned. Reject other unknown shapes.
          z
            .object({})
            .strict()
            .transform(() => ({ agent_bot: null })),
        ])
        .parse(
          await this.request(
            "/api/v1/accounts/" +
              id.parse(accountId) +
              "/inboxes/" +
              id.parse(inboxId) +
              "/agent_bot",
          ),
        );
      return result.agent_bot?.id ?? null;
    } catch {
      throw new Error("Chat connection unavailable.");
    }
  }
  /** Provider replaces the list: preserve every observed label and verify the result. */
  async mergeConversationLabel(
    accountId: number,
    conversationId: number,
    rawLabel: unknown,
  ) {
    const label = z
      .string()
      .regex(/^[a-z][a-z0-9_-]{0,63}$/)
      .parse(rawLabel);
    const endpoint =
      "/api/v1/accounts/" +
      id.parse(accountId) +
      "/conversations/" +
      id.parse(conversationId) +
      "/labels";
    const shape = z.object({
      payload: z.array(z.string().min(1).max(200)).max(1000),
    });
    const current = shape.parse(await this.request(endpoint)).payload;
    if (current.includes(label)) return;
    const expected = [...new Set([...current, label])];
    const receipt = shape.parse(
      await this.request(endpoint, { labels: expected }),
    ).payload;
    if (expected.some((l) => !receipt.includes(l)))
      throw new Error("Label update unconfirmed.");
  }
  async attachBot(accountId: number, inboxId: number, botId: number) {
    try {
      await this.request(
        "/api/v1/accounts/" +
          id.parse(accountId) +
          "/inboxes/" +
          id.parse(inboxId) +
          "/set_agent_bot",
        { agent_bot: id.parse(botId) },
        true,
      );
    } catch {
      throw new Error("Chat connection unavailable.");
    }
  }
}
