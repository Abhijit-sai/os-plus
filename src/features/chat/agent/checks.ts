import { z } from "zod";

const safeText = z.string().trim().min(1).max(6000);
const inputSchema = z
  .object({
    text: safeText,
    facts: z.record(z.string().max(100), safeText),
    prices: z
      .array(
        z
          .object({
            label: safeText,
            amount: z.number().finite().nonnegative().max(1e9),
            currency: z.string().regex(/^[A-Z]{3}$/),
            unit: safeText,
          })
          .strict(),
      )
      .max(500),
    latinScriptOnly: z.boolean().default(false),
    indicativeLabel: z.string().trim().min(1).max(100).nullable(),
    links: z.record(z.string().max(100), z.string().url().max(2048)),
    previousReplies: z.array(z.string().max(150000)).max(500),
    forbiddenTerms: z.array(z.string().min(1).max(200)).max(20),
  })
  .strict();
export type DraftCheck =
  | { ok: true; text: string; factsUsed: string[]; repairs: string[] }
  | { ok: false; reason: string };
const normalized = (value: string) =>
  value.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
const internal =
  /(?:\b(?:tenant_id|quiet_until|correlation_id|api[_ -]?key|access[_ -]?token|understanding_json|decision_json|stack trace|system prompt)\b|[{}[\]]|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})/iu;
const unsafeMarkupOrLink =
  /[<>\p{Cf}\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const unsupportedLink =
  /(?:[a-z][a-z0-9+.-]*:\/\/|(?:javascript|data|mailto|tel):)/iu;
const promise =
  /\b(?:(?:booking|appointment|pickup|delivery|order).{0,25}(?:confirmed|booked|reserved|scheduled)|(?:confirmed|booked|reserved|scheduled).{0,25}(?:booking|appointment|pickup|delivery|order)|payment (?:received|confirmed)|paid in full|will (?:deliver|arrive)|guaranteed)\b/iu;

/** Numeric facts/links are filled from a code-selected plan, never repaired by guessing a model's amount. */
export function renderDraft(raw: unknown): DraftCheck {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "shape" };
  const input = parsed.data,
    used: string[] = [];
  const skeleton = input.text.replace(
    /\{\{(?:FACT:[a-zA-Z0-9_:-]+|PRICE:[0-9]+|(?:MAP_LINK:[a-zA-Z0-9_-]+|REVIEW_LINK|WHATSAPP_LINK))\}\}/gu,
    "",
  );
  if (
    unsafeMarkupOrLink.test(skeleton) ||
    unsupportedLink.test(skeleton) ||
    internal.test(skeleton) ||
    promise.test(skeleton) ||
    /\p{N}|[$€£₹]|https?:|www\./iu.test(skeleton) ||
    input.forbiddenTerms.some((term) =>
      normalized(skeleton).includes(normalized(term)),
    )
  )
    return { ok: false, reason: "unsafe_text" };
  if ((input.text.match(/[?？؟]/gu) ?? []).length > 1)
    return { ok: false, reason: "questions" };
  let missing = false;
  const text = input.text.replace(
    /\{\{([^{}]+)\}\}/gu,
    (_full, key: string) => {
      used.push(key);
      if (key.startsWith("FACT:")) {
        const value = input.facts[key.slice(5)];
        if (
          value === undefined ||
          (value !== undefined &&
            (unsafeMarkupOrLink.test(value) ||
              unsupportedLink.test(value) ||
              /https?:|www\.|[$€£₹]|\b(?:INR|USD|EUR|GBP)\s*\p{N}/iu.test(
                value,
              )))
        )
          missing = true;
        return value ?? "";
      }
      if (/^PRICE:(0|[1-9][0-9]*)$/u.test(key)) {
        const price = input.prices[Number(key.slice(6))];
        if (!price || !input.indicativeLabel) {
          missing = true;
          return "";
        }
        return (
          price.label +
          " — " +
          price.currency +
          " " +
          price.amount +
          " / " +
          price.unit +
          " (" +
          input.indicativeLabel +
          ")"
        );
      }
      const value = input.links[key];
      if (
        !/^(?:MAP_LINK:[a-zA-Z0-9_-]+|REVIEW_LINK|WHATSAPP_LINK)$/u.test(key) ||
        !value
      ) {
        missing = true;
        return "";
      }
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password)
        missing = true;
      return value;
    },
  );
  if (
    missing ||
    text.length > 6000 ||
    unsafeMarkupOrLink.test(text) ||
    (input.latinScriptOnly &&
      [...text].some(
        (letter) =>
          /\p{L}/u.test(letter) && !/\p{Script_Extensions=Latin}/u.test(letter),
      )) ||
    (text.replace(/https:\/\/[^\s]+/gu, "").match(/[?？؟]/gu) ?? []).length >
      1 ||
    /[{}[\]]/u.test(text) ||
    internal.test(text) ||
    promise.test(text) ||
    input.forbiddenTerms.some((term) =>
      normalized(text).includes(normalized(term)),
    )
  )
    return { ok: false, reason: "unfilled_or_unsafe_fact" };
  const sentences = (value: string) =>
    value
      .split(/(?<=[.!?。！？])\s+|\n+/u)
      .map((s) => s.trim())
      .filter(Boolean);
  const sentenceKey = (value: string) =>
    normalized(value).replace(/[.!?。！？]+$/u, "");
  const prior = new Set(
      input.previousReplies.flatMap(sentences).map(sentenceKey),
    ),
    seen = new Set<string>();
  let removed = false;
  const kept = sentences(text).filter((sentence) => {
    const key = sentenceKey(sentence);
    // Only exact, substantive repeats are mechanically removable. Never guess equivalence or facts.
    if (key.length > 12 && (prior.has(key) || seen.has(key))) {
      removed = true;
      return false;
    }
    seen.add(key);
    return true;
  });
  if (kept.length === 0 || (new Set(used).size !== used.length && !removed))
    return { ok: false, reason: "repeat" };
  return {
    ok: true,
    text: removed ? kept.join("\n") : text,
    factsUsed: [...new Set(used)],
    repairs: removed ? ["repeat"] : [],
  };
}
