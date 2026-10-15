import "server-only";

import { z } from "zod";
import { canonicalShopDomain } from "./config.ts";
import { ShopifyIntegrationError } from "./errors.ts";

// Server attestations, not user inputs. The worker-context adapter constructs
// this from current scoped DB state; verified setup/privacy remain activation gates.
export const hydrationContextSchema = z
  .object({
    tenantId: z.string().uuid(),
    connectionId: z.string().uuid(),
    shopGid: z.string().regex(/^gid:\/\/shopify\/Shop\/[1-9][0-9]{0,31}$/),
    shopDomain: z.string(),
    appRef: z.string().regex(/^[A-Za-z0-9_-]{1,256}$/),
    environment: z.literal("production"),
    apiVersion: z.literal("2026-10"),
    revision: z.number().int().positive().safe(),
    status: z.literal("verified"),
    tenantStatus: z.literal("active"),
    intakeEnabled: z.literal(true),
    processingEnabled: z.literal(true),
    requiredScopesVerified: z.literal(true),
    protectedCustomerFieldsVerified: z.literal(true),
    importCreatedAtCutoff: z.string().datetime({ offset: true }),
  })
  .strict();
export type ShopifyHydrationContext = z.infer<typeof hydrationContextSchema>;

export function assertShopifyHydrationContext(
  context: ShopifyHydrationContext,
  env: NodeJS.ProcessEnv,
) {
  const parsed = hydrationContextSchema.safeParse(context);
  if (!parsed.success) throw new ShopifyIntegrationError("ACCESS_DENIED");
  if (
    env.SHOPIFY_HYDRATION_ENABLED !== "true" ||
    env.SHOPIFY_SYNC_ENABLED !== "true" ||
    env.VERCEL_ENV !== "production" ||
    env.SHOPIFY_DEPLOYMENT_ENV !== "production" ||
    env.SHOPIFY_API_VERSION !== "2026-10"
  ) {
    throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
  }
  if (canonicalShopDomain(context.shopDomain) !== context.shopDomain)
    throw new ShopifyIntegrationError("ACCESS_DENIED");
}
