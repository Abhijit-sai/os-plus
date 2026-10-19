import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.ts";
import type { ShopifyHydrationContext } from "./hydration-contract.ts";
import type { ShopifyJobLease } from "./queue-store.ts";
import { prepareShopifyDraft } from "./draft-preparation.ts";
import { prepareShopifyPartialDraft } from "./partial-draft.ts";
import { sealShopifySource } from "./source-crypto.ts";
import { ShopifyIntegrationError } from "./errors.ts";
import { shopifyMeaningfulSourceDigest } from "./source-change.ts";
import { projectShopifyCommercialDetails } from "./commercial-order.ts";
import {
  parseShopifyOrderSnapshot,
  shopifyTimestampInstant,
} from "./order-hydration.ts";

const resultSchema = z
  .object({
    status: z.enum(["draft", "observed"]),
    orderId: z.string().uuid(),
    sourceRevisionId: z.string().uuid(),
    tenantId: z.string().uuid(),
    customerId: z.string().uuid().nullable(),
    customerResolution: z.enum(["created", "reused", "review"]),
    reasons: z
      .array(
        z
          .string()
          .regex(/^[A-Z_]+$/)
          .max(80),
      )
      .max(60),
    releaseEligible: z.literal(false),
  })
  .strict();
export type ShopifyDraftImportResult = z.infer<typeof resultSchema>;
type ImportArguments = [
  input: unknown,
  context: ShopifyHydrationContext,
  lease: ShopifyJobLease,
  signal: AbortSignal,
  env?: NodeJS.ProcessEnv,
  now?: number,
];

// Server-only; there is deliberately no caller-accessible route or scheduler.
// The future executor must construct fresh DB/credential-bound attestations;
// passing a synthetic context cannot attest a live store's privacy permissions.
export function createShopifyDraftStore(
  db: Pick<SupabaseClient<Database>, "rpc">,
  options: { retainBusinessDetails: boolean } = { retainBusinessDetails: false },
) {
  async function send(
    recoveryOnly: boolean,
    input: unknown,
    context: ShopifyHydrationContext,
    lease: ShopifyJobLease,
    signal: AbortSignal,
    env: NodeJS.ProcessEnv = process.env,
    now = Date.now(),
    partialObservedAt?: string,
  ): Promise<ShopifyDraftImportResult | null> {
    if (signal.aborted)
      throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
    if (env.SHOPIFY_DRAFT_IMPORT_ENABLED !== "true")
      throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
    let validationTime = now;
    if (recoveryOnly) {
      const originalObservation = partialObservedAt ?? parseShopifyOrderSnapshot(input).observedAt;
      const observed = shopifyTimestampInstant(originalObservation);
      if (
        !Number.isFinite(now) ||
        observed > BigInt(Math.floor(now)) * BigInt(1_000_000)
      )
        throw new ShopifyIntegrationError("ACCESS_DENIED");
      // Reconstruct the ORIGINAL bounded intent as of its observation, not a
      // fabricated fresh lease. Only the read-only receipt RPC gets this DTO.
      // Binding/schema/cutoff/original lease agreement still must validate.
      validationTime = Number((observed + BigInt(999_999)) / BigInt(1_000_000));
    }
    const draft = partialObservedAt ? prepareShopifyPartialDraft(input, context, lease, env, validationTime, partialObservedAt) : prepareShopifyDraft(
      input,
      context,
      lease,
      env,
      validationTime,
    );
    const snapshot = draft.sourceSnapshot;
    // Include normalized options/provenance AND source facts in one encrypted
    // immutable revision. Only minimal source IDs/quantities are indexed in SQL.
    const plaintext = JSON.stringify(draft);
    if (Buffer.byteLength(plaintext, "utf8") > 8_000_000)
      throw new ShopifyIntegrationError("RESPONSE_INVALID");
    const sourceDigest = createHash("sha256").update(plaintext).digest("hex");
    const aad = JSON.stringify([
      draft.tenantId,
      draft.connectionId,
      draft.shopGid,
      draft.sourceOrderGid,
      sourceDigest,
    ]);
    const sealedSource = sealShopifySource(plaintext, aad, env);
    const payload = {
      tenantId: draft.tenantId,
      connectionId: draft.connectionId,
      environment: context.environment,
      appRef: context.appRef,
      shopGid: draft.shopGid,
      shopDomain: context.shopDomain,
      apiVersion: context.apiVersion,
      jobId: draft.jobId,
      generation: draft.generation,
      leaseToken: lease.leaseToken,
      connectionRevision: draft.connectionRevision,
      sourceOrderGid: draft.sourceOrderGid,
      sourceCreatedAt: snapshot.order.createdAt,
      sourceUpdatedAt: draft.sourceUpdatedAt,
      observedAt: draft.observedAt,
      sourceCurrency: snapshot.order.currencyCode,
      sourceDigest,
      meaningfulDigest: partialObservedAt ? null : shopifyMeaningfulSourceDigest(input),
      completeness: partialObservedAt ? "partial" : "complete",
      ...(options.retainBusinessDetails && !partialObservedAt ? { commercialDetails: projectShopifyCommercialDetails(input) } : {}),
      addresses: partialObservedAt ? [] : [
        (snapshot as ReturnType<typeof prepareShopifyDraft>["sourceSnapshot"]).order.shippingAddress,
        (snapshot as ReturnType<typeof prepareShopifyDraft>["sourceSnapshot"]).order.billingAddress,
      ].filter((value) => value && value.address1?.trim() && value.countryCodeV2),
      customer: {
        proposedName: draft.customer.proposedName,
        generatedName: draft.customer.generatedName,
        shopifyCustomerGid: draft.customer.shopifyCustomerGid,
        verifiedPhoneE164: draft.customer.verifiedPhoneE164,
        emailSuggestion: draft.customer.emailSuggestion,
        unverifiedPrimaryPhone: draft.customer.unverifiedPrimaryPhone,
        phoneCountryConflict: draft.customer.phoneCountryConflict,
      },
      reasons: draft.reasons.filter(
        (reason) => reason !== "CUSTOMER_RESOLUTION_REQUIRED",
      ),
      sealedSource,
      lines: draft.lines.map((line) => ({
        lineGid: line.lineGid,
        quantity: line.quantity,
        currentQuantity: line.currentQuantity,
      })),
    };
    if (signal.aborted)
      throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
    const pending = options.retainBusinessDetails && !partialObservedAt
      ? db.rpc("import_shopify_retained_draft", { p_input: payload, p_recovery_only: recoveryOnly })
      : db.rpc(recoveryOnly ? "recover_shopify_draft" : "import_shopify_draft", { p_input: payload });
    const { data, error } = await pending.abortSignal(signal);
    // Never forward SQL details/parameters/customer data or raw error objects.
    // On timeout retain the SAME source/lease. Once expired/stale use the
    // read-only recovery method, not a fresh claim or invented observation.
    if (error) throw new ShopifyIntegrationError(error.message === "SHOPIFY_REFERENCE_CONFLICT" ? "REFERENCE_MATCH_REQUIRED" : "UPSTREAM_UNAVAILABLE");
    if (recoveryOnly && data === null) return null;
    const parsed = resultSchema.safeParse(data);
    if (!parsed.success || parsed.data.tenantId !== draft.tenantId)
      throw new ShopifyIntegrationError("RESPONSE_INVALID");
    return parsed.data;
  }
  return {
    // The observation must be captured when hydration returned this envelope,
    // not invented on a delayed retry. Partial data never creates a customer.
    importPartialEnvelope(input: unknown, context: ShopifyHydrationContext, lease: ShopifyJobLease,
      signal: AbortSignal, observedAt: string, env: NodeJS.ProcessEnv = process.env, now = Date.now()) {
      return send(false, input, context, lease, signal, env, now, observedAt);
    },
    recoverPartialEnvelope(input: unknown, context: ShopifyHydrationContext, lease: ShopifyJobLease,
      signal: AbortSignal, observedAt: string, env: NodeJS.ProcessEnv = process.env, now = Date.now()) {
      return send(true, input, context, lease, signal, env, now, observedAt);
    },
    async importSnapshot(
      ...args: ImportArguments
    ): Promise<ShopifyDraftImportResult> {
      const result = await send(false, ...args);
      if (!result) throw new ShopifyIntegrationError("RESPONSE_INVALID");
      return result;
    },
    // Null means no committed exact-intent receipt. It does NOT authorize a new
    // commit; the executor must rehydrate/reclaim under normal live fences.
    recoverCommittedSnapshot(...args: ImportArguments) {
      return send(true, ...args);
    },
  };
}
