import type { AgentContext } from "./context.ts";
import { customerTextSchema } from "../actions/customer-text.ts";
import { hasPublicReply } from "./plan.ts";

const greeting = /^(?:(?:hi+|hey+|hello|good (?:morning|afternoon|evening))(?:[.!?,\s]+(?:are you there|you there|anyone there))?|are you there|you there|anyone there)[.!?,\s]*$/i;
const order = /\b(?:order (?:status|update)|track(?:ing)? (?:my |the )?order|my (?:order|parcel|package)|ord-[0-9]+)\b/i;
const availability = /\b(?:stock|in my size|in size|(?:available|availability) (?:in|for)|(?:shirts?|kurtas?|item|design|product) (?:still )?available|do you have (?:an? )?(?:small|medium|large|xs|s|m|l|xl|xxl|xxxl)|new (?:shirts?|designs?|collection)|delivery date|when (?:will|can) .+ deliver)\b/i;
const savedSizing = /\b(?:you (?:already )?(?:know|have) my (?:size|measurements)|(?:use|check) my (?:saved|usual) (?:size|measurements))\b/i;
const sensitiveRequest = /\b(?:cancel|refund|payment|paid|complaint|damaged|defect(?:ive)?|wrong item|bank details|card number|speak to (?:a )?(?:human|person)|talk to (?:a )?(?:human|person))\b/i;
const orderNumber = /\bord-[0-9]{6,12}\b/i;
const visiting = /^(?:when (?:do you|are you) open|(?:what are )?(?:your )?(?:opening|store|business) hours|are you open(?: (?:now|today|tomorrow))?|(?:can|may) i (?:come (?:down|by)|visit)(?: (?:today|tomorrow))?)[.!?\s]*$/i;
const customDesign = /^(?:do you (?:do|make|offer)|can you (?:do|make)) (?:a |any )?(?:custom|personalized|personalised) designs?[.!?\s]*$/i;
const pureOrderStatus = /^(?:(?:what(?:'s| is) (?:the )?(?:current )?(?:status (?:of|for) )?(?:my order|order)|where(?:'s| is) (?:my order|order)|(?:can you |please )?(?:check|track) (?:my order|order)|(?:my )?order status)[\s:#-]*)?ord-[0-9]{6,12}[.!?\s]*$/i;
const statuses = new Map([
  ["confirmed", "confirmed"],
  ["in_progress", "in progress"],
  ["ready", "ready"],
  ["partially_delivered", "partially delivered"],
  ["completed", "marked complete"],
  ["delivered", "marked delivered"],
  ["cancelled", "cancelled"],
]);

export const automaticHandoffReply =
  "I’ll pass this to our team. They’ll check the details and reply here.";

export function automaticReplyContext(ctx: AgentContext) {
  const lastReply = ctx.session.messages.findLastIndex((message) =>
    message.author === "staff" || message.author === "bot",
  );
  const unanswered = ctx.session.messages.slice(lastReply + 1)
    .filter((message) => message.author === "customer")
    .map((message) => message.content?.trim() ?? "");
  const facts = Object.fromEntries([
    ["about", ctx.pack.brand.oneLiner],
    ["hours", ctx.pack.hours.default],
    ...ctx.pack.policies.map((policy, index) => [`policy:${index}`, policy.answer]),
  ]);
  return { unanswered, facts };
}

export function immediateAutomaticReply(
  ctx: AgentContext,
  unanswered: string[],
  orderStatus?: string,
): { text: string; handoff: boolean; verifiedOrderStatus?: string; once?: boolean } | null {
  const inquiries = unanswered.filter((message) => !greeting.test(message));
  if (unanswered.length > 0 && inquiries.length === 0)
    return { text: `Hi! How can I help you with ${ctx.pack.brand.displayName} today?`, handoff: false };
  const text = inquiries.join("\n");
  if (/\b(?:i(?:['’]ve| have)? (?:already )?paid|payment (?:is |was )?(?:done|sent|made)|i sent (?:the )?payment)\b/i.test(text))
    return { text: hasPublicReply(ctx, ctx.pack.locked.paymentClaimReply)
      ? ctx.pack.locked.paymentClaimAgain : ctx.pack.locked.paymentClaimReply, handoff: true };
  if (sensitiveRequest.test(text))
    return { text: automaticHandoffReply, handoff: true };
  if (/\b(?:are you (?:a bot|human|real)|who are you)\b/i.test(text))
    return { text: ctx.pack.locked.identityReply, handoff: false, once: true };
  if (/\b(?:(?:we|i) (?:supply|manufacture)|(?:we(?:['’]re| are)|i(?:['’]m| am)) (?:a )?(?:vendor|supplier|manufacturer))\b/i.test(text))
    return { text: ctx.pack.locked.vendorReply, handoff: false, once: true };
  const handoffTopic = ctx.pack.handoffTopics.some((topic) =>
    !["order status", "stock availability"].includes(topic.toLowerCase()) &&
    text.toLowerCase().includes(topic.toLowerCase()),
  );
  if (handoffTopic)
    return { text: automaticHandoffReply, handoff: true };
  if (order.test(text)) {
    const verified = statuses.get(orderStatus ?? "");
    if (verified && orderStatus && inquiries.length === 1 && pureOrderStatus.test(text))
      return { text: `The status of your order is ${verified}.`, handoff: false, verifiedOrderStatus: orderStatus };
    return {
      text: orderNumber.test(text)
        ? `I couldn’t confirm that order from this chat. ${automaticHandoffReply}`
        : "Could you share your order number so I can check the latest status?",
      handoff: orderNumber.test(text),
    };
  }
  if (savedSizing.test(text))
    return {
      text: "I’ll ask our team to check your sizing details. They’ll follow up with you here.",
      handoff: true,
    };
  if (availability.test(text))
    return {
      text: `${automaticHandoffReply} If you have a product link or a size in mind, you can share it here.`,
      handoff: true,
    };
  if (inquiries.length === 1 && visiting.test(text))
    return { text: ctx.pack.hours.default, handoff: false };
  if (inquiries.length === 1 && customDesign.test(text)) {
    const policy = ctx.pack.policies.find((item) => item.topic === "custom_design_enquiry");
    if (policy) return { text: policy.answer, handoff: false };
  }
  return null;
}

export function checkedAutomaticReply(
  facts: Record<string, string>,
  fact: string | null,
) {
  if (fact === null || !Object.hasOwn(facts, fact)) return null;
  const checked = customerTextSchema.safeParse(facts[fact]);
  return checked.success ? checked.data : null;
}
