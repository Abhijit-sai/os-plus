import "server-only";
import { createHash, timingSafeEqual, randomUUID } from "node:crypto";
import { z } from "zod";
import { parseTelegramLink } from "./rules.ts";
import { encryptChatSecret } from "../secrets.ts";
type Context = {
  tenantId: string;
  actor: { type: "WEBHOOK"; id: "telegram" };
  source: "WEBHOOK";
  correlationId: string;
};
type Claim = {
  id: string;
  codeHash: string;
  recipientEnc: string;
  kind: "private" | "group" | "supergroup";
  hint: string;
  updateId: number;
};
type LinkDependencies = {
  after(work: () => Promise<void>): void;
  resolve(hash: string): Promise<unknown>;
  claim(context: Context, input: Claim): Promise<unknown>;
};
const targetSchema = z
  .object({ tenantId: z.string().uuid(), id: z.string().uuid() })
  .strict();
const response = (status: number) =>
  new Response(null, { status, headers: { "Cache-Control": "no-store" } });
export function validNotificationSecret(
  supplied: string | null,
  expected: string | undefined,
): boolean {
  if (
    !supplied ||
    !expected ||
    expected.length < 32 ||
    expected.length > 256 ||
    supplied.length > 264
  )
    return false;
  return timingSafeEqual(
    createHash("sha256").update(supplied).digest(),
    createHash("sha256").update(expected).digest(),
  );
}
export async function readNotificationJson(
  request: Request,
  max = 65536,
): Promise<unknown> {
  if (!request.body) throw new Error("Missing body");
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > max) throw new Error("Body too large");
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function handleTelegramLink(
  request: Request,
  deps: LinkDependencies,
) {
  if (request.method !== "POST") return response(405);
  if (
    process.env.CHAT_FOUNDATION_ENABLED !== "true" ||
    process.env.CHAT_NOTIFICATIONS_ENABLED !== "true" ||
    !validNotificationSecret(
      request.headers.get("X-Telegram-Bot-Api-Secret-Token"),
      process.env.TELEGRAM_WEBHOOK_SECRET,
    )
  )
    return response(404);
  let body: unknown;
  try {
    body = await readNotificationJson(request);
  } catch {
    return response(400);
  }
  const link = parseTelegramLink(body);
  if (!link) return response(200);
  deps.after(async () => {
    if (
      process.env.CHAT_FOUNDATION_ENABLED !== "true" ||
      process.env.CHAT_NOTIFICATIONS_ENABLED !== "true"
    )
      return;
    try {
      // Resolve inside deferred work. Payload tenant/account/chat IDs never select an OS PLUS tenant.
      const hash = createHash("sha256").update(link.code).digest("hex");
      const raw = await deps.resolve(hash);
      if (raw === null) return;
      const target = targetSchema.parse(raw);
      await deps.claim(
        {
          tenantId: target.tenantId,
          actor: { type: "WEBHOOK", id: "telegram" },
          source: "WEBHOOK",
          correlationId: "telegram-" + link.updateId + "-" + randomUUID(),
        },
        {
          id: target.id,
          codeHash: hash,
          kind: link.chatType,
          hint: link.chatId.replace("-", "").slice(-4),
          updateId: link.updateId,
          recipientEnc: encryptChatSecret(
            JSON.stringify({ chatId: link.chatId, senderId: link.senderId }),
            {
              tenantId: target.tenantId,
              workspaceId: target.id,
              purpose: "notification_recipient",
            },
          ),
        },
      );
    } catch {
      /* Do not log code, recipient, provider payload or crypto errors. A failed claim never activates a target. */
    }
  });
  return response(200);
}

type CronDependencies = {
  after(work: () => Promise<void>): void;
  tick(): Promise<void>;
  platformFailure(): Promise<void>;
};
export async function handleNotificationCron(
  request: Request,
  deps: CronDependencies,
) {
  if (request.method !== "POST") return response(405);
  const auth = request.headers.get("authorization");
  if (
    process.env.CHAT_FOUNDATION_ENABLED !== "true" ||
    process.env.CHAT_NOTIFICATIONS_ENABLED !== "true" ||
    process.env.CHAT_NOTIFICATIONS_CRON_ENABLED !== "true" ||
    !auth?.startsWith("Bearer ") ||
    !validNotificationSecret(
      auth.slice(7),
      process.env.CHAT_NOTIFICATIONS_CRON_SECRET,
    )
  )
    return response(404);
  try {
    z.object({})
      .strict()
      .parse(request.body ? await readNotificationJson(request, 1024) : {});
  } catch {
    return response(400);
  }
  deps.after(async () => {
    if (
      process.env.CHAT_NOTIFICATIONS_CRON_ENABLED !== "true" ||
      process.env.CHAT_NOTIFICATIONS_ENABLED !== "true"
    )
      return;
    try {
      await deps.tick();
    } catch {
      try {
        await deps.platformFailure();
      } catch {
        /* No provider payload or tenant data in logs. */
      }
    }
  });
  return Response.json(
    { accepted: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
