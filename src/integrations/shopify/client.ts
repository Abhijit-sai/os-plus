import "server-only";

import { z } from "zod";
import { canonicalShopDomain, SHOPIFY_API_VERSION } from "./config.ts";
import { ShopifyIntegrationError } from "./errors.ts";
import { readBoundedBody } from "./bounded-body.ts";
import { getShopifyApplicationConfig } from "./application-config.ts";
import {
  getShopifyProbeConfig,
  type ShopifyProbeActor,
} from "./probe-config.ts";
import {
  assertShopifyHydrationContext,
  type ShopifyHydrationContext,
} from "./hydration-contract.ts";

const envelopeSchema = z.object({
  data: z.unknown().optional(),
  errors: z
    .array(
      z
        .object({
          extensions: z
            .object({ code: z.string().optional() })
            .passthrough()
            .optional(),
        })
        .passthrough(),
    )
    .optional(),
  extensions: z
    .object({
      cost: z
        .object({
          requestedQueryCost: z.number().nonnegative().optional(),
          actualQueryCost: z.number().nonnegative().nullable().optional(),
          throttleStatus: z
            .object({
              currentlyAvailable: z.number().nonnegative(),
              restoreRate: z.number().nonnegative(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

export type ShopifyGraphQLRequest<T> = {
  shopDomain: string;
  connectionEnvironment: "production";
  accessToken: string;
  query: string;
  variables?: Record<string, unknown>;
  // Callers must supply their actual query schema; never cast partial API data.
  schema: z.ZodType<T>;
  timeoutMs?: number;
  signal?: AbortSignal;
};

function retryAfter(header: string | null): number {
  if (!header) return 60;
  const numeric = Number(header);
  const seconds = Number.isFinite(numeric)
    ? numeric
    : (Date.parse(header) - Date.now()) / 1000;
  return Number.isFinite(seconds)
    ? Math.max(1, Math.min(86_400, Math.ceil(seconds)))
    : 60;
}

// Diagnostics have their own opt-in fence. Never enable order sync to test auth.
export async function readShopifyProbeGraphQL<T>(
  input: ShopifyGraphQLRequest<T>,
  actor: ShopifyProbeActor,
  transport: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
) {
  const config = getShopifyProbeConfig(actor, env);
  if (
    input.shopDomain !== config.shopDomain ||
    input.connectionEnvironment !== "production"
  ) {
    throw new ShopifyIntegrationError("ACCESS_DENIED");
  }
  return executeShopifyGraphQL(input, transport);
}

// Separate opt-in from the metadata probe. Context and token are trusted server
// values; no route exposes this transport or accepts a browser-provided query.
export async function readShopifyHydrationGraphQL<T>(
  input: ShopifyGraphQLRequest<T>,
  context: ShopifyHydrationContext,
  transport: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
) {
  assertShopifyHydrationContext(context, env);
  if (
    input.shopDomain !== context.shopDomain ||
    input.connectionEnvironment !== context.environment
  ) {
    throw new ShopifyIntegrationError("ACCESS_DENIED");
  }
  return executeShopifyGraphQL(input, transport);
}

// Owner-only setup has its own gate. It does not forge a verified hydration
// context or relax the older diagnostic's SYNC=false contract.
export async function readShopifyApplicationGraphQL<T>(input:ShopifyGraphQLRequest<T>,actor:ShopifyProbeActor,
  transport:typeof fetch=fetch,env:NodeJS.ProcessEnv=process.env){
  const config=getShopifyApplicationConfig(actor,env);
  if(input.shopDomain!==config.shopDomain||input.connectionEnvironment!=="production")throw new ShopifyIntegrationError("ACCESS_DENIED");
  return executeShopifyGraphQL(input,transport);
}

const webhookCreateQuery=`mutation OSPlusCreatePilotWebhook($topic: WebhookSubscriptionTopic!, $subscription: WebhookSubscriptionInput!) {
  webhookSubscriptionCreate(topic: $topic, webhookSubscription: $subscription) {
    webhookSubscription { id topic uri filter format includeFields apiVersion { handle } }
    userErrors { field message }
  }
}`;
// Deliberately not a generic mutation transport. This is the sole allowed
// Shopify write: subscription configuration, never order/customer mutations.
export async function createShopifyApplicationWebhook<T>(input:Omit<ShopifyGraphQLRequest<T>,"query"|"variables"> & {
  topic:"ORDERS_CREATE"|"ORDERS_UPDATED"|"ORDERS_CANCELLED";orderGid:string;
},actor:ShopifyProbeActor,transport:typeof fetch=fetch,env:NodeJS.ProcessEnv=process.env){
  const config=getShopifyApplicationConfig(actor,env);
  if(input.shopDomain!==config.shopDomain||input.connectionEnvironment!=="production"||
    !["ORDERS_CREATE","ORDERS_UPDATED","ORDERS_CANCELLED"].includes(input.topic)||
    !/^gid:\/\/shopify\/Order\/[1-9][0-9]{0,31}$/.test(input.orderGid))throw new ShopifyIntegrationError("ACCESS_DENIED");
  return executeShopifyGraphQL({...input,query:webhookCreateQuery,variables:{topic:input.topic,subscription:{
    uri:`${config.origin}/api/integrations/shopify/orders-webhook`,format:"JSON",
    filter:`id:${input.orderGid.split("/").at(-1)}`,includeFields:["id","admin_graphql_api_id","updated_at"]}}},transport,true);
}

async function executeShopifyGraphQL<T>(
  input: ShopifyGraphQLRequest<T>,
  transport: typeof fetch,
  allowWebhookCreate=false,
): Promise<{
  data: T;
  apiVersion: typeof SHOPIFY_API_VERSION;
  availableQueryCost: number | null;
}> {
  const shop = canonicalShopDomain(input.shopDomain);
  const timeoutMs = input.timeoutMs ?? 15_000;
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 30_000 ||
    !input.accessToken ||
    input.accessToken.length > 16_384 ||
    /[\r\n]/.test(input.accessToken) ||
    // The diagnostic transport is read-only and accepts internal named queries.
    // The handler never accepts a query from the browser.
    !(allowWebhookCreate?input.query===webhookCreateQuery:/^\s*query\s+[A-Za-z_][A-Za-z0-9_]*\s*[(\{]/.test(input.query))
  )
    throw new ShopifyIntegrationError("CONFIGURATION_INVALID");

  let requestBody: string;
  try {
    requestBody = JSON.stringify({
      query: input.query,
      variables: input.variables ?? {},
    });
    if (Buffer.byteLength(requestBody) > 128 * 1024) throw new Error();
  } catch {
    throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  const deadline = setTimeout(abort, timeoutMs);
  input.signal?.addEventListener("abort", abort, { once: true });
  if (input.signal?.aborted) controller.abort();
  let rejectOnAbort = () => {};
  const aborted = new Promise<never>((_, reject) => {
    rejectOnAbort = () =>
      reject(new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE", 60));
    controller.signal.addEventListener("abort", rejectOnAbort, { once: true });
  });
  try {
    if (controller.signal.aborted)
      throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE", 60);
    const run = async (): Promise<{
      data: T;
      apiVersion: typeof SHOPIFY_API_VERSION;
      availableQueryCost: number | null;
    }> => {
      const response = await transport(
        `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
        {
          method: "POST",
          redirect: "error",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": input.accessToken,
          },
          body: requestBody,
          signal: controller.signal,
        },
      );
      if (controller.signal.aborted) {
        void response.body?.cancel().catch(() => undefined);
        throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE", 60);
      }
      if (!response.ok) {
        void response.body?.cancel().catch(() => undefined);
        if (response.status === 401)
          throw new ShopifyIntegrationError("AUTHENTICATION_REQUIRED");
        if (response.status === 403)
          throw new ShopifyIntegrationError("ACCESS_DENIED");
        if ([402, 423].includes(response.status))
          throw new ShopifyIntegrationError("SHOP_INACTIVE");
        if (response.status === 429)
          throw new ShopifyIntegrationError(
            "THROTTLED",
            retryAfter(response.headers.get("Retry-After")),
          );
        if (response.status >= 500)
          throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE", 60);
        throw new ShopifyIntegrationError("UPSTREAM_REJECTED");
      }
      if (
        response.headers.get("X-Shopify-API-Version") !== SHOPIFY_API_VERSION
      ) {
        void response.body?.cancel().catch(() => undefined);
        throw new ShopifyIntegrationError("API_VERSION_MISMATCH");
      }

      const bytes = await readBoundedBody(
        response.body,
        2 * 1024 * 1024,
        controller.signal,
      );
      let json: unknown;
      try {
        json = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        );
      } catch {
        throw new ShopifyIntegrationError("RESPONSE_INVALID");
      }
      const envelope = envelopeSchema.safeParse(json);
      if (!envelope.success)
        throw new ShopifyIntegrationError("RESPONSE_INVALID");
      const result = envelope.data;
      if (result.errors?.length) {
        const codes = result.errors.map((error) => error.extensions?.code);
        if (codes.includes("ACCESS_DENIED"))
          throw new ShopifyIntegrationError("ACCESS_DENIED");
        if (codes.includes("SHOP_INACTIVE"))
          throw new ShopifyIntegrationError("SHOP_INACTIVE");
        if (codes.includes("MAX_COST_EXCEEDED"))
          throw new ShopifyIntegrationError("UPSTREAM_REJECTED");
        if (codes.includes("THROTTLED")) {
          const cost = result.extensions?.cost;
          const status = cost?.throttleStatus;
          const seconds =
            status && status.restoreRate > 0
              ? Math.ceil(
                  Math.max(
                    0,
                    (cost?.requestedQueryCost ?? 0) - status.currentlyAvailable,
                  ) / status.restoreRate,
                )
              : 60;
          throw new ShopifyIntegrationError(
            "THROTTLED",
            Math.max(1, Math.min(86_400, seconds)),
          );
        }
        if (codes.includes("INTERNAL_SERVER_ERROR"))
          throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE", 60);
        // Even HTTP 200 + partial data must not turn redacted fields into guests.
        throw new ShopifyIntegrationError("GRAPHQL_INCOMPLETE");
      }
      const data = input.schema.safeParse(result.data);
      if (!data.success || result.data == null)
        throw new ShopifyIntegrationError("RESPONSE_INVALID");
      return {
        data: data.data,
        apiVersion: SHOPIFY_API_VERSION,
        availableQueryCost:
          result.extensions?.cost?.throttleStatus?.currentlyAvailable ?? null,
      };
    };
    return await Promise.race([run(), aborted]);
  } catch (error) {
    if (error instanceof ShopifyIntegrationError) throw error;
    // Network/abort errors may embed a URL, headers or a response body.
    throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE", 60);
  } finally {
    clearTimeout(deadline);
    input.signal?.removeEventListener("abort", abort);
    controller.signal.removeEventListener("abort", rejectOnAbort);
  }
}
