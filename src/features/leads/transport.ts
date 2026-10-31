import { z } from "zod";
export const chatTransportSchema = z
  .object({
    baseUrl: z.string().url(),
    accountId: z.number().int().positive().safe(),
    conversationId: z.number().int().positive().safe().optional(),
  })
  .strict();
export function chatwootBrowserUrl(input: unknown, browserOrigin?: string) {
  const value = chatTransportSchema.parse(input),
    base = new URL(value.baseUrl);
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error("Invalid chat destination");
  const url = browserOrigin ? new URL(browserOrigin) : base;
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  )
    throw new Error("Invalid chat destination");
  url.pathname =
    "/app/accounts/" +
    value.accountId +
    (value.conversationId
      ? "/conversations/" + value.conversationId
      : "/dashboard");
  return url.href;
}
