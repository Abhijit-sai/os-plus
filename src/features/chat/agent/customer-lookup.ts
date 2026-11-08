import { z } from "zod";
import { customerTextSchema } from "../actions/customer-text.ts";

const lookupKind = z.enum(["status", "tracking", "balance", "address", "measurements"]);
export type CustomerLookupKind = z.infer<typeof lookupKind>;
export const customerLookupSchema = z.object({
  kind: lookupKind,
  text: customerTextSchema,
  proof: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();
export type CustomerLookup = z.infer<typeof customerLookupSchema>;

// Recognize standalone requests. A supplied reference never becomes a
// request for the latest order if it cannot be understood or verified.
const orderRef = /(?:\s+(?:for\s+(?:order\s+)?)?|\s*[:#-]\s*)#?ord-[0-9]{6,12}$/i;
const exactRef = /^#?ord-[0-9]{6,12}$/i;
const requests: [CustomerLookupKind, RegExp][] = [
  ["tracking", /^(?:(?:please )?(?:send|share|give) (?:me )?(?:the |my )?|(?:can|could) (?:i (?:get|see|have)|you (?:send|share)) (?:me )?(?:the |my )?)?(?:order )?tracking link(?: for my (?:latest )?order)?$/i],
  ["balance", /^(?:(?:what(?:'s| is) )?(?:my |the )?(?:pending payment|balance due|outstanding balance)|how much do i (?:still )?owe|do i (?:still )?owe anything|is my payment pending)(?: (?:for|on) my (?:latest )?order)?$/i],
  ["address", /^(?:do you have my (?:shipping|delivery) address|is my (?:shipping|delivery) address on file)$/i],
  ["measurements", /^(?:do you have my (?:saved )?measurements|(?:what are|show me) my (?:saved )?measurements)$/i],
  ["status", /^(?:(?:what(?:'s| is) )?(?:the )?(?:current )?(?:status|update) (?:of|for|on) (?:my |the )?(?:latest )?order|(?:what(?:'s| is) )?(?:my |the )?(?:latest )?order (?:status|update|tracking)|where(?:'s| is) (?:my |the )?(?:latest )?(?:order|parcel|package)|(?:can you |could you |please )?(?:check|track) (?:my |the )?(?:latest )?order)$/i],
];

export function customerLookupKind(content: string): CustomerLookupKind | null {
  if (/^is my (?:shipping|delivery) address .{5,250}\?$/i.test(content.trim())) return "address";
  const text = content.trim().replace(/[.!?]+$/, "").trim();
  if (exactRef.test(text)) return "status";
  const request = text.replace(orderRef, "");
  if (request !== text && /^(?:status|update)$/i.test(request)) return "status";
  return requests.find(([, pattern]) => pattern.test(request))?.[0] ?? null;
}
