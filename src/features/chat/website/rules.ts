import { z } from "zod";
import { normalizeCustomerPhone } from "../../customers/phone.ts";
/** A website form proves neither phone possession nor country. Never use this claim for identity lookup. */
export function websitePhoneClaim(input: unknown) {
  const raw = z.string().trim().max(40).nullish().safeParse(input);
  if (!raw.success || !raw.data || !/^\+[0-9][0-9 ().-]*$/.test(raw.data))
    return null;
  const normalized = normalizeCustomerPhone(raw.data);
  return normalized
    ? { value: normalized.e164, verified: false as const }
    : null;
}

export const publicWebsiteTokenSchema = z
  .string()
  .min(16)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/);
export function websiteWidgetSnippet(input: unknown) {
  const value = z
    .object({
      origin: z.string().url().max(2048),
      websiteToken: publicWebsiteTokenSchema,
      allowLocal: z.boolean().default(false),
    })
    .strict()
    .parse(input);
  const origin = new URL(value.origin);
  if (
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    (origin.protocol !== "https:" &&
      !(
        value.allowLocal &&
        origin.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
      ))
  )
    throw Error("Website widget unavailable.");
  // JSON values are generated here; never relay provider-supplied HTML or admin credentials.
  const quote = (text: string) =>
    JSON.stringify(text).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  return (
    "<script>\n(function(d,t){\n  var BASE_URL=" +
    quote(origin.origin) +
    ';\n  var g=d.createElement(t),s=d.getElementsByTagName(t)[0];\n  g.src=BASE_URL+"/packs/js/sdk.js";g.async=true;\n  g.onload=function(){window.chatwootSDK.run({websiteToken:' +
    quote(value.websiteToken) +
    ',baseUrl:BASE_URL});};\n  s.parentNode.insertBefore(g,s);\n})(document,"script");\n</script>'
  );
}
