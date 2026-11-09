import type { AgentContext } from "./context.ts";

const store = "https://phantomthreads.in";
const collections = {
  shirt: `${store}/collections/black-outfits`,
  pants: `${store}/collections/korean-pants`,
  kurta: `${store}/collections/latest-kurta-collection`,
  "hand-painted": `${store}/collections/art-collection`,
  clothing: `${store}/collections`,
};
const garmentPattern = /\b(shirts?|pants?|trousers?|kurtas?)\b/i;
const paintedPattern = /\bhand[ -]?paint(?:ed|ing)?\b/i;
const customPattern = /\b(?:custom(?:i[sz]ed)?|made.to.measure|tailor.made|make (?:it|one|me)|personal[i]?s[ez](?:d)?)\b/i;
const standardPattern = /\b(?:standard(?: size)?|ready.to.wear|ready.?made|existing (?:size|design)|off the rack)\b/i;
const sizePattern = /\b(?:size\s*(?:[2-5]?xl|xs|[sml]|\d{2})\b|(?:^|\s)(?:[2-5]?xl|xs)\b|(?:regular|relaxed|slim|loose|oversized) fit\b)/i;
const bareSize = /^(?:[2-5]?xl|xs|[sml]|\d{2}|small|medium|large)[.! ]*$/i;
const deadlinePattern = /\b(?:today|tomorrow|tonight|asap|(?:next |this )?(?:mon|tues|wednes|thurs|fri|satur|sun)day|\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?))\b/i;
const asksDelivery = /\b(?:deliver(?:y|ed)?|arriv(?:e|al)|ship(?:ping|ped)?|pick[ -]?up|collect|need (?:it|this) by)\b/i;
const flexible = /\b(?:no rush|no deadline|anytime|flexible|no (?:particular|specific) date)\b/i;
const pause = /^(?:(?:i|we)(?:['’]ll| will)? (?:get back|let you know|confirm|check|decide|reply|tell you|send (?:it|one|the (?:link|photo)))\b|(?:will |let me )(?:check|confirm|decide|get back|let you know)\b)/i;
const acknowledgement = /^(?:ok(?:ay)?|yes|yeah|sure|thanks|thank you|got it|great|cool)[.!\s]*$/i;
const shoppingIntent = /\b(?:interested|browse|catalog(?:ue)?|collections?|shopping|looking for (?:something|an outfit)|hand[ -]?print(?:ed|ing)?)\b/i;
const wantsReview = /\b(?:quote|price|how much|can you (?:make|check|confirm)|check (?:stock|availability)|in stock|available in|do you have .+ in)\b/i;
const explicitNoReference = /^(?:no|no reference|nothing yet|i don['’]?t have (?:one|a reference))[.! ]*$/i;
const linkPattern = /https?:\/\/[^\s<>]+/gi;
const sentToTeam = "I’ve shared this with our";
const sizeQuestion = "What size or fit works for you?";
const referenceQuestion = "Do you have a photo or link you’d like us to work from? A short description works too.";
const timingQuestion = "Is there a date you need it by?";

export type PhantomRequest = {
  category: "design" | "delivery" | "availability";
  garment: keyof typeof collections;
  reference: "photo" | "product" | "link" | "description" | null;
  deadline: string | null;
  fit: string | null;
};

type SalesReply = { text: string | null; request?: PhantomRequest };

function productLink(text: string) {
  for (const candidate of (text.match(linkPattern) ?? []).reverse()) {
    try {
      const url = new URL(candidate.replace(/[.,!?;)]+$/, ""));
      if (["phantomthreads.in", "www.phantomthreads.in"].includes(url.hostname) &&
          !url.username && !url.password && !url.port &&
          /^\/products\/[a-z0-9-]+\/?$/.test(url.pathname)) return store + url.pathname;
    } catch { /* The original reference remains in the chat. */ }
  }
  return null;
}

export function phantomSalesReply(ctx: AgentContext, now: string): SalesReply | null {
  const messages = ctx.session.messages;
  const lastStaff = messages.findLastIndex((message) => message.author === "staff");
  const thread = messages.slice(lastStaff + 1);
  const lastBot = thread.findLastIndex((message) => message.author === "bot");
  const incoming = thread.slice(lastBot + 1).filter((message) => message.author === "customer");
  const customer = thread.filter((message) => message.author === "customer");
  const latest = incoming.map((message) => message.content?.trim() ?? "").filter(Boolean);
  const previous = thread[lastBot]?.content ?? "";
  if (!incoming.length) return null;
  if (latest.length && latest.every((text) => pause.test(text) || acknowledgement.test(text)) &&
      latest.some((text) => pause.test(text)) && !incoming.some((message) => message.hasImage))
    return { text: "Of course. Send it here whenever you’re ready." };

  const texts = customer.map((message) => message.content?.trim() ?? "");
  const history = texts.join("\n");
  const latestText = latest.join("\n");
  const product = productLink(history);
  const garmentName = texts.findLast((text) => garmentPattern.test(text))?.match(garmentPattern)?.[1].toLowerCase();
  const garment = garmentName?.startsWith("shirt") ? "shirt"
    : garmentName?.startsWith("kurta") ? "kurta"
    : garmentName ? "pants"
    : paintedPattern.test(history) ? "hand-painted" : "clothing";
  const mode = texts.findLast((text) => standardPattern.test(text) || customPattern.test(text));
  const custom = !!mode && customPattern.test(mode) && !standardPattern.test(mode);
  const standard = (!!mode && standardPattern.test(mode)) || (!!product && !custom);
  const image = customer.some((message) => message.hasImage);
  const externalLink = texts.some((text) => /https?:\/\/\S+/i.test(text));
  const referencePrompt = thread.findIndex((message) => message.author === "bot" && message.content === referenceQuestion);
  const referenceAnswer = referencePrompt >= 0 && thread.slice(referencePrompt + 1)
    .find((message) => message.author === "customer" && message.content?.trim())?.content?.trim();
  const described = /\b(?:design|paint|embroider|print)\s+(?:of |with |a |my |on )\S+/i.test(history) ||
    Boolean(referenceAnswer && referenceAnswer.length >= 6 && !explicitNoReference.test(referenceAnswer) &&
      !acknowledgement.test(referenceAnswer) && !pause.test(referenceAnswer));
  const reference = image ? "photo" : product ? "product" : externalLink ? "link" : described ? "description" : null;
  if (garment === "clothing" && !mode && !product && !image && !shoppingIntent.test(history) &&
      !externalLink && !asksDelivery.test(latestText)) return null;
  if (latest.length && latest.every((text) => acknowledgement.test(text)) &&
      !incoming.some((message) => message.hasImage)) return { text: null };

  const size = texts.findLast((text) => sizePattern.test(text) || bareSize.test(text));
  const fit = size?.match(sizePattern)?.[0].trim() ?? (size && bareSize.test(size) ? size : null);
  const timing = texts.findLast((text) => !pause.test(text) && (deadlinePattern.test(text) || flexible.test(text)));
  const deadline = timing?.match(deadlinePattern)?.[0] ?? null;
  const reviewingStock = stockCheckPending(texts);
  const lastDeadline = thread.slice(0, lastBot)
    .filter((message) => message.author === "customer")
    .map((message) => message.content && !pause.test(message.content) ? message.content.match(deadlinePattern)?.[0] : null)
    .filter(Boolean).at(-1);
  const delivery = asksDelivery.test(latestText) || Boolean(deadline && /\b(?:today|tomorrow|tonight|asap)\b/i.test(deadline));
  const category = delivery || (!!deadline && deadline !== lastDeadline && previous.startsWith(sentToTeam))
    ? "delivery" : custom ? "design" : "availability";
  const handoff = (): SalesReply => {
    const team = custom ? "design team" : "team";
    const timing = followUpTiming(now, ctx.pack.hours);
    return {
      text: `${sentToTeam} ${team}. They’ll reply here ${timing}.`,
      request: { category, garment, reference, deadline, fit },
    };
  };
  if (previous.startsWith(sentToTeam)) {
    if ((deadline && deadline.toLowerCase() !== lastDeadline?.toLowerCase()) ||
        incoming.some((message) => message.hasImage) || wantsReview.test(latestText)) return handoff();
    return { text: null };
  }
  if (delivery && deadline) return handoff();
  if (custom) {
    if (!reference && !explicitNoReference.test(latestText) && referencePrompt === -1)
      return { text: referenceQuestion };
    if (!timing && !thread.some((message) => message.author === "bot" && message.content === timingQuestion))
      return { text: timingQuestion };
    if (!fit && !thread.some((message) => message.author === "bot" && message.content === sizeQuestion))
      return { text: sizeQuestion };
    return handoff();
  }
  if (standard && product) {
    if (reviewingStock && !fit && previous !== sizeQuestion) return { text: sizeQuestion };
    if (delivery || reviewingStock || wantsReview.test(latestText)) return handoff();
    return { text: `You can choose a standard size and order here: ${product}` };
  }
  if (delivery && !timing) return { text: timingQuestion };
  if (reference && !standard)
    return { text: `${image ? "Thanks for the photo." : "Thanks for the reference."} Are you looking for an existing piece in a standard size, or would you like us to make something similar for you?` };
  const collection = paintedPattern.test(latestText) ? "hand-painted" : garment;
  if (standard)
    return { text: `Here’s the collection: ${collections[collection]}\nIf one catches your eye, send me the product link and I can help you with the next step.` };
  return { text: `Here’s our collection: ${collections[collection]}\nIf one catches your eye, send me the link or a screenshot. Are you looking for a standard size or something custom-made?` };
}

function stockCheckPending(texts: string[]) {
  return texts.some((text) => /\b(?:in stock|available in|availability|do you have .+ in (?:size |xs|[smlx]{1,4}\b))\b/i.test(text));
}

function followUpTiming(now: string, hours: AgentContext["pack"]["hours"]) {
  // Only use a named day when the approved hours have an unambiguous daily schedule.
  const daily = /^we are open every day, (\d{1,2}) (am|pm) to (\d{1,2}) (am|pm)\.?$/i.exec(hours.default);
  if (!daily || hours.byDay) return "during our next working hours";
  const toMinutes = (hour: string, meridiem: string) =>
    (Number(hour) % 12 + (meridiem.toLowerCase() === "pm" ? 12 : 0)) * 60;
  const start = toMinutes(daily[1], daily[2]), end = toMinutes(daily[3], daily[4]);
  if (start >= end || ![daily[1], daily[3]].every((hour) => Number(hour) >= 1 && Number(hour) <= 12))
    return "during our next working hours";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(now));
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  const minute = Number(value("hour")) * 60 + Number(value("minute"));
  if (minute >= end - 30) return "tomorrow during working hours";
  if (minute >= start) return "as soon as they can";
  return "during our next working hours";
}
