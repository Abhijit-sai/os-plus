import "server-only";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { refreshInputSchema, refreshResultSchema } from "./schemas.ts";
type RefreshInput = z.infer<typeof refreshInputSchema>;
type Context = {
  tenantId: string;
  actor: { type: "SYSTEM"; id: "chat-stage-refresh" };
  source: "AUTOMATION";
  correlationId: string;
};
type Dependencies = {
  refresh(context: Context, input: RefreshInput): Promise<unknown>;
};
const bodySchema = z
  .object({
    tenantId: z.string().uuid(),
    leadId: z.string().uuid().optional(),
    afterId: z.string().uuid().optional(),
  })
  .strict();
const response = (status: number) =>
  new Response(null, { status, headers: { "Cache-Control": "no-store" } });
export async function handleLeadRefresh(
  request: Request,
  deps: Dependencies,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (request.method !== "POST") return response(405);
  const secret = env.CHAT_LEAD_REFRESH_SECRET,
    authorization = request.headers.get("authorization");
  if (
    env.CHAT_FOUNDATION_ENABLED !== "true" ||
    env.CHAT_LEAD_REFRESH_ENABLED !== "true" ||
    !secret ||
    secret.length < 32 ||
    secret.length > 512
  )
    return response(404);
  const expected = createHash("sha256")
    .update("Bearer " + secret)
    .digest();
  const actual = createHash("sha256")
    .update(authorization ?? "")
    .digest();
  if (
    !authorization ||
    authorization.length > 520 ||
    !timingSafeEqual(expected, actual)
  )
    return response(404);
  let parsed: z.infer<typeof bodySchema>;
  try {
    if (!request.body) return response(400);
    const reader = request.body.getReader(),
      chunks: Uint8Array[] = [];
    let count = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        count += part.value.byteLength;
        if (count > 1024) throw new Error("Too large");
        chunks.push(part.value);
      }
    } finally {
      await reader.cancel();
    }
    parsed = bodySchema.parse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
  } catch {
    return response(400);
  }
  const { tenantId, ...raw } = parsed;
  let input: RefreshInput;
  try {
    input = refreshInputSchema.parse(raw);
  } catch {
    return response(400);
  }
  try {
    const data = refreshResultSchema.parse(
      await deps.refresh(
        {
          tenantId,
          actor: { type: "SYSTEM", id: "chat-stage-refresh" },
          source: "AUTOMATION",
          correlationId: randomUUID(),
        },
        input,
      ),
    );
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return response(503);
  }
}
