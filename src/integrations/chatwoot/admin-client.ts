import "server-only";
import { z } from "zod";

const id = z.number().int().positive().safe();
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
  private async request(path: string, body?: unknown): Promise<unknown> {
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
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new Error("Request failed");
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
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new Error("Chat connection unavailable.");
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
}
