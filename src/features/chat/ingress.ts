import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  parseChatwootMessage,
  type ChatwootMessage,
} from "../../integrations/chatwoot/payload.ts";

export type CaptureWorkspace = {
  id: string;
  tenantId: string;
  accountId: number;
  secretHash: string;
};
export type CaptureChannel = {
  id: string;
  kind: string;
  mode: "off" | "draft" | "auto";
};
export type IngressDependencies = {
  workspace(key: string): Promise<CaptureWorkspace | null>;
  channel(
    workspace: CaptureWorkspace,
    inboxId: number,
  ): Promise<CaptureChannel | null>;
  capture(
    workspace: CaptureWorkspace,
    channel: CaptureChannel,
    kind: "events" | "agent",
    message: ChatwootMessage,
  ): Promise<void>;
  issue(
    workspace: CaptureWorkspace,
    code: "unknown_inbox" | "capture_failed",
  ): Promise<void>;
  after(work: () => Promise<void>): void;
};
const response = (status: number) =>
  new Response(null, { status, headers: { "Cache-Control": "no-store" } });
export function validWebhookSecret(token: string | null, expected: string) {
  const actual = createHash("sha256")
    .update(token ?? "")
    .digest();
  const stored = /^[a-f0-9]{64}$/.test(expected)
    ? Buffer.from(expected, "hex")
    : Buffer.alloc(32);
  return (
    timingSafeEqual(actual, stored) &&
    token !== null &&
    token.length >= 32 &&
    token.length <= 512
  );
}
async function readPayload(request: Request) {
  if (!request.body) throw new Error("Missing body");
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 1048576) throw new Error("Body too large");
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
/** URL credentials are the only authority. Payload ids only assert the resolved scope. */
export async function handleChatwootWebhook(
  request: Request,
  workspaceKey: string,
  kind: "events" | "agent",
  deps: IngressDependencies,
) {
  if (request.method !== "POST") return response(405);
  if (
    process.env.CHAT_FOUNDATION_ENABLED !== "true" ||
    !/^[a-zA-Z0-9_-]{32,128}$/.test(workspaceKey)
  )
    return response(404);
  const tokens = new URL(request.url).searchParams.getAll("token");
  if (tokens.length !== 1 || tokens[0].length > 512) return response(404);
  let workspace: CaptureWorkspace | null;
  try {
    workspace = await deps.workspace(workspaceKey);
  } catch {
    return response(503);
  }
  if (!workspace || !validWebhookSecret(tokens[0], workspace.secretHash))
    return response(404);
  let raw: unknown;
  try {
    raw = await readPayload(request);
  } catch {
    return response(400);
  }
  // Only message_created is subscribed in CH-2. Other provider lifecycle events cannot mutate memory.
  if (typeof raw !== "object" || raw === null || !("event" in raw))
    return response(400);
  if (raw.event !== "message_created") return response(200);
  let message: ChatwootMessage;
  try {
    message = parseChatwootMessage(raw);
    if (Date.parse(message.createdAt) > Date.now() + 300000)
      return response(400);
  } catch {
    return response(400);
  }
  if (message.accountId !== workspace.accountId) return response(404);
  let channel: CaptureChannel | null;
  try {
    channel = await deps.channel(workspace, message.inboxId);
  } catch {
    return response(503);
  }
  const scope = workspace;
  const recordIssue = async (code: "unknown_inbox" | "capture_failed") => {
    try {
      await deps.issue(scope, code);
    } catch {
      console.warn("Chat webhook health could not be recorded.");
    }
  };
  if (!channel) {
    deps.after(() => recordIssue("unknown_inbox"));
    return response(200);
  }
  if (message.channelKind !== null && message.channelKind !== channel.kind)
    return response(404);
  if (
    kind === "agent" &&
    (channel.mode === "off" || message.author !== "customer" || message.private)
  )
    return response(200);
  const target = channel;
  deps.after(async () => {
    if (process.env.CHAT_FOUNDATION_ENABLED !== "true") return;
    try {
      await deps.capture(scope, target, kind, message);
    } catch {
      await recordIssue("capture_failed");
    }
  });
  return response(200);
}
