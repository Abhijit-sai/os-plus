import { z } from "zod";
import { parseKnowledgePack } from "../knowledge-pack.ts";
import { agentMessageSchema } from "./rules.ts";
import { sliceSession } from "./session.ts";
import { inquiryLedger } from "./ledger.ts";
import { backgroundSchema, locationsSchema } from "./background.ts";
export { ledgerSchema } from "./ledger.ts";

const uuid = z.string().uuid();
export const agentScopeSchema = z
  .object({
    tenantId: uuid,
    workspaceId: uuid,
    channelId: uuid,
    conversationId: uuid,
    triggerMessageId: uuid,
  })
  .strict();
export type AgentScope = z.infer<typeof agentScopeSchema>;

const dataSchema = agentScopeSchema
  .extend({
    background: backgroundSchema,
    locations: locationsSchema,
    brandId: uuid,
    active: z.literal(true),
    moduleEnabled: z.literal(true),
    channelKind: z.enum(["website", "whatsapp", "instagram", "facebook"]),
    agentMode: z.enum(["draft", "auto"]),
    quietUntil: z.string().datetime({ offset: true }).nullable(),
    ledger: z.unknown(),
    quietMinutes: z.number().int().min(1).max(10080).default(60),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable()
      .default(null),
    historyComplete: z.literal(true),
    pack: z
      .object({
        tenantId: uuid,
        brandId: uuid,
        version: z.number().int().positive(),
        body: z.unknown(),
      })
      .strict(),
    messages: z
      .array(
        agentMessageSchema
          .extend({ tenantId: uuid, conversationId: uuid })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict();

/** Every row is independently scoped before projection; an incomplete or malformed history is unavailable, not empty. */
export function buildAgentContext(scopeInput: unknown, raw: unknown) {
  const scope = agentScopeSchema.parse(scopeInput),
    data = dataSchema.parse(raw);
  for (const key of Object.keys(scope) as (keyof AgentScope)[])
    if (data[key] !== scope[key]) throw new Error("Agent context unavailable.");
  if (
    data.pack.tenantId !== scope.tenantId ||
    data.pack.brandId !== data.brandId ||
    (data.background !== null &&
      (data.background.tenantId !== scope.tenantId ||
        (data.background.customer !== null &&
          data.background.customer.tenantId !== scope.tenantId))) ||
    data.locations.some(
      (location) =>
        location.tenantId !== scope.tenantId ||
        location.brandId !== data.brandId,
    ) ||
    data.messages.some(
      (m) =>
        m.tenantId !== scope.tenantId ||
        m.conversationId !== scope.conversationId,
    )
  )
    throw new Error("Agent context unavailable.");
  const pack = parseKnowledgePack(data.pack.body);
  const publicMessages = data.messages
    .filter((m) => !m.private)
    .map(
      ({ tenantId: _tenant, conversationId: _conversation, ...message }) =>
        message,
    );
  const session = sliceSession({
    triggerId: scope.triggerMessageId,
    messages: publicMessages,
    policy: pack.agent?.session,
  });
  const ledger = inquiryLedger(
    data.ledger,
    session,
    pack.locked.vendorReply,
    data.quietMinutes,
  );
  return {
    scope,
    brandId: data.brandId,
    channelKind: data.channelKind,
    pack,
    packVersion: data.pack.version,
    quietUntil: data.quietUntil,
    currency: data.currency,
    background: data.background,
    locations: data.locations,
    ledger,
    session,
    allPublicMessages: publicMessages,
    modelContext: {
      // Native addresses and order details stay server-side until a separately approved capability needs them.
      background: data.background
        ? {
            displayName: data.background.displayName,
            preferredLanguage: pack.brand.languages.includes(
              data.background.preferredLanguage ?? "",
            )
              ? data.background.preferredLanguage
              : null,
            returningCustomer: data.background.customer !== null,
            recentOrders: data.background.customer?.orders.length ?? 0,
            openTasks: data.background.customer?.openTasks ?? 0,
          }
        : null,
      locations: data.locations.map(
        ({ tenantId: _tenant, brandId: _brand, ...location }) => location,
      ),
      brand: pack.brand,
      knowledge: pack,
      messages: session.messages,
      sessionBand: session.band,
      requestOpen: ledger.requestOpen,
    },
  };
}
export type AgentContext = ReturnType<typeof buildAgentContext>;
