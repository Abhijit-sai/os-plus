import "server-only";
import { z } from "zod";
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,199}$/);
const configSchema = z
  .object({
    model: identifier,
    provider: identifier,
    system: z.string().min(1).max(100000),
    user: z.string().min(1).max(140000),
    maxTokens: z.number().int().min(1).max(8192),
    timeoutMs: z.number().int().min(100).max(30000),
    maxPrice: z
      .object({
        prompt: z.number().finite().nonnegative(),
        completion: z.number().finite().nonnegative(),
        request: z.number().finite().nonnegative(),
      })
      .strict(),
  })
  .strict();
/** Decimal expansion avoids a floating multiply adding a fictitious charge. Sub-pico usage rounds up. */
export function usageCostUsd(value: number): string {
  const parts = /^([0-9]+)(?:[.]([0-9]+))?(?:e([+-]?[0-9]+))?$/u.exec(
    z.number().finite().nonnegative().max(1e6).parse(value).toString(),
  );
  if (!parts) throw new Error("Usage unavailable.");
  const fraction = parts[2] ?? "",
    digits = BigInt(parts[1] + fraction),
    shift = 12 + Number(parts[3] ?? 0) - fraction.length;
  const factor = BigInt(10) ** BigInt(Math.abs(shift));
  const units =
    shift >= 0 ? digits * factor : (digits + factor - BigInt(1)) / factor;
  const padded = units.toString().padStart(13, "0");
  return padded.slice(0, -12) + "." + padded.slice(-12);
}
export class ModelCallError extends Error {
  readonly costUsd: string | null;
  readonly generationId: string | null;
  constructor(costUsd: string | null, generationId: string | null) {
    super("Model call unavailable.");
    this.costUsd = costUsd;
    this.generationId = generationId;
  }
}
const envelope = z
  .object({
    id: z.string().min(1).max(200),
    model: z.string().min(1).max(200),
    choices: z
      .array(
        z
          .object({
            finish_reason: z.string().nullable(),
            message: z.object({ content: z.string().max(64000) }).strip(),
          })
          .strip(),
      )
      .length(1),
    usage: z
      .object({ cost: z.number().finite().nonnegative().max(1e6).optional() })
      .passthrough()
      .optional(),
  })
  .strip();

/** Contract checked2026-10-22: openrouter.ai/docs/api_reference/overview,
 * cookbook/administration/usage-accounting and guides/routing/provider-selection.
 * No default model, alternate endpoint, provider fallback, plugin or automatic retry. */
export class OpenRouterClient {
  private origin: string;
  private token: string;
  private mock: boolean;
  constructor(options: {
    token: string;
    origin?: string;
    allowLocalMock?: boolean;
  }) {
    const url = new URL(options.origin ?? "https://openrouter.ai");
    this.mock =
      options.allowLocalMock === true &&
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1";
    if (
      (!this.mock && url.origin !== "https://openrouter.ai") ||
      url.pathname !== "/" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new ModelCallError(null, null);
    this.origin = url.origin;
    this.token = z.string().min(1).max(8192).parse(options.token);
  }
  async complete(raw: unknown): Promise<{
    json: unknown;
    model: string;
    costUsd: string;
    generationId: string;
    timingMs: number;
  }> {
    // D042: mock tests do not enable live calls. Even an existing key is insufficient.
    if (!this.mock && process.env.CHAT_MODEL_LIVE_ENABLED !== "true")
      throw new ModelCallError(null, null);
    const input = configSchema.parse(raw),
      start = performance.now();
    let cost: string | null = null,
      id: string | null = null;
    try {
      const response = await fetch(this.origin + "/api/v1/chat/completions", {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(input.timeoutMs),
        headers: {
          Authorization: "Bearer " + this.token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: input.model,
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.user },
          ],
          stream: false,
          response_format: { type: "json_object" },
          max_tokens: input.maxTokens,
          provider: {
            only: [input.provider],
            allow_fallbacks: false,
            require_parameters: true,
            data_collection: "deny",
            max_price: input.maxPrice,
          },
        }),
      });
      if (!response.body) throw new Error("Empty response");
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 131072) throw new Error("Response too large");
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel();
      }
      const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      // Account for a known charge even when the completion itself is truncated/malformed.
      const accounting = z
        .object({
          id: z.string().max(200).optional(),
          usage: z
            .object({
              cost: z.number().finite().nonnegative().max(1e6).optional(),
            })
            .passthrough()
            .optional(),
        })
        .strip()
        .safeParse(body);
      if (accounting.success) {
        id = accounting.data.id ?? null;
        if (accounting.data.usage?.cost !== undefined)
          cost = usageCostUsd(accounting.data.usage.cost);
      }
      if (!response.ok) throw new Error("Provider rejected");
      const answer = envelope.parse(body);
      if (cost === null || answer.choices[0].finish_reason !== "stop")
        throw new Error("Uncertain response");
      return {
        json: JSON.parse(answer.choices[0].message.content) as unknown,
        model: answer.model,
        costUsd: cost,
        generationId: answer.id,
        timingMs: Math.max(0, performance.now() - start),
      };
    } catch {
      throw new ModelCallError(cost, id);
    }
  }
}
