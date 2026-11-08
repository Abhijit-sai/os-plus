import type { AgentContext } from "./context.ts";
import { customerTextSchema } from "../actions/customer-text.ts";
import { hasPublicReply } from "./plan.ts";
import { customerLookupKind, type CustomerLookup } from "./customer-lookup.ts";

const greeting = /^(?:(?:hi+|hey+|hello|namaste|good (?:morning|afternoon|evening))(?: (?:there|sir|team))?(?:[.!?,\s]+(?:are you there|you there|anyone there))?|are you there|you there|anyone there)$/i;
const greetingSuffix = /(?:[.!?,\s]|\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|[#*0-9]\ufe0f?\u20e3|[\u200d\ufe0f\u{e0020}-\u{e007f}])+$/u;
const order = /\b(?:order (?:status|update|tracking)|track(?:ing)? (?:my |the )?order|my (?:order|parcel|package)|ord-[0-9]+)\b/i;
const availability = /(?:^stock[.!?\s]*$|\b(?:in stock|out of stock|(?:have (?:any )?|check (?:the )?|how much )stock|stock (?:check|availability|left)|in my size|(?:shirts?|kurtas?|item|design|product|this|that|it|xs|s|m|l|xl|2xl|xxl|xxxl) (?:still )?available|(?:available|availability) in (?:size|small|medium|large|xs|s|m|l|xl|2xl|xxl|xxxl)|do you have (?:an? )?(?:small|medium|large|xs|s|m|l|xl|2xl|xxl|xxxl)|do you have .+ in size)\b)/i;
const deliveryTiming = /\b(?:delivery date|when (?:will|can) .+ deliver)\b/i;
const savedSizing = /\b(?:you (?:already )?(?:know|have) my (?:size|measurements)|(?:use|check) my (?:saved|usual) (?:size|measurements))\b/i;
const sensitiveRequest = /\b(?:cancel(?:lation)?|refund|complaint|damaged|defect(?:ive)?|wrong item|(?:speak|talk|connect me) (?:to|with) (?:a |an )?(?:real )?(?:human|person|agent|someone)|(?:want|need) (?:a |an )(?:real )?(?:human|person|agent))\b/i;
const paymentClaim = /\b(?:i(?:['’]ve| have)? (?:already )?paid|paid (?:just now|already)|payment (?:(?:has been|is|was) )?(?:done|sent|made|completed)|i(?:['’]ve| have)? (?:made|sent|completed) (?:the |my )?payment)\b|^paid[.!?\s]*$/i;
const paymentDetails = /\b(?:payment|paid|how much (?:do|should) i (?:need to )?pay|bank details|card number)\b/i;
const orderNumber = /\bord-[0-9]{6,12}\b/i;
const visiting = /^(?:when (?:do you|are you) open|(?:what are )?(?:your )?(?:opening|store|business) hours|are you open(?: (?:now|today|tomorrow))?|(?:can|may) i (?:come (?:down|by)|visit)(?: (?:today|tomorrow))?)[.!?\s]*$/i;
const customDesign = /^(?:do you (?:do|make|offer)|can you (?:do|make)) (?:a |any )?(?:custom|personalized|personalised) designs?[.!?\s]*$/i;

const automaticHandoffReply =
  "I’ll pass this to our team. They’ll check the details and reply here.";
const defaultAvailabilityReply =
  `${automaticHandoffReply} If you have a product link or a size in mind, you can share it here.`;

export function automaticErrorReply(ctx: AgentContext) {
  return ctx.pack.replies?.error ?? automaticHandoffReply;
}

export function automaticClarification(ctx: AgentContext) {
  return ctx.pack.replies?.clarify ?? "Could you tell me a little more about what you need?";
}

function isGreeting(message: string, localGreetings: string[]) {
  if (message.length > 2048) return false;
  const normalized = message.trim().replace(greetingSuffix, "").toLowerCase();
  return greeting.test(normalized) || localGreetings.some((word) =>
    normalized === word.replace(greetingSuffix, "").toLowerCase(),
  );
}

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
  lookup?: CustomerLookup,
): { text: string; handoff: boolean; staffAlert?: boolean; lookup?: CustomerLookup; once?: boolean } | null {
  const { brand, replies } = ctx.pack;
  const inquiries = unanswered.filter((message) => !isGreeting(message, brand.localGreetings ?? []));
  if (unanswered.length > 0 && inquiries.length === 0)
    return { text: replies?.greeting ?? `Hi! How can I help you with ${brand.displayName} today?`, handoff: false };
  const text = inquiries.join("\n");
  const stockCheck = inquiries.some((message) => availability.test(message));
  if (inquiries.some((message) => paymentClaim.test(message)))
    return { text: hasPublicReply(ctx, ctx.pack.locked.paymentClaimReply)
      ? ctx.pack.locked.paymentClaimAgain : ctx.pack.locked.paymentClaimReply, handoff: true, staffAlert: true };
  if (sensitiveRequest.test(text))
    return { text: replies?.needsPerson ?? automaticHandoffReply, handoff: true, staffAlert: true };
  const requestedLookup = inquiries.length === 1 ? customerLookupKind(text) : null;
  if (requestedLookup) {
    if (lookup?.kind === requestedLookup)
      return { text: lookup.text, handoff: false, lookup };
    const hasReference = orderNumber.test(text);
    if (hasReference)
      return {
        text: replies?.orderUnconfirmed ?? `I couldn’t confirm that order from this chat. ${automaticHandoffReply}`,
        handoff: true,
        staffAlert: true,
      };
    if (requestedLookup === "status" || requestedLookup === "tracking")
      return {
        text: replies?.askOrderNumber ?? "Could you share your order number so I can check the latest status?",
        handoff: false,
      };
    return { text: replies?.handoffTopic ?? automaticHandoffReply, handoff: true };
  }
  if (paymentDetails.test(text))
    return { text: replies?.handoffTopic ?? automaticHandoffReply, handoff: true };
  if (/\b(?:are you (?:a bot|human|real)|who are you)\b/i.test(text))
    return { text: ctx.pack.locked.identityReply, handoff: false, once: true };
  if (/\b(?:(?:we|i) (?:supply|manufacture)|(?:we(?:['’]re| are)|i(?:['’]m| am)) (?:a )?(?:vendor|supplier|manufacturer))\b/i.test(text))
    return { text: ctx.pack.locked.vendorReply, handoff: false, once: true };
  if (order.test(text)) {
    if (orderNumber.test(text))
      return {
        text: replies?.orderUnconfirmed ?? `I couldn’t confirm that order from this chat. ${automaticHandoffReply}`,
        handoff: true,
        staffAlert: true,
      };
    if (!stockCheck)
      return {
        text: replies?.askOrderNumber ?? "Could you share your order number so I can check the latest status?",
        handoff: false,
      };
  }
  if (stockCheck)
    return {
      text: replies?.availability ?? defaultAvailabilityReply,
      handoff: true,
      staffAlert: true,
    };
  if (savedSizing.test(text))
    return {
      text: replies?.handoffTopic ?? "I’ll ask our team to check your sizing details. They’ll follow up with you here.",
      handoff: true,
    };
  const handoffTopic = ctx.pack.handoffTopics.some((topic) =>
    !["order status", "stock availability"].includes(topic.toLowerCase()) &&
    text.toLowerCase().includes(topic.toLowerCase()),
  );
  if (handoffTopic)
    return { text: replies?.handoffTopic ?? automaticHandoffReply, handoff: true };
  if (deliveryTiming.test(text))
    return { text: replies?.handoffTopic ?? defaultAvailabilityReply, handoff: true };
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
