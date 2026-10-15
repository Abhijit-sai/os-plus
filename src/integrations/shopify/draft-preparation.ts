import "server-only";

import { parsePhoneNumberFromString } from "libphonenumber-js";
import { normalizeCustomerPhone } from "../../features/customers/phone.ts";
import { ShopifyIntegrationError } from "./errors.ts";
import {
  assertShopifyHydrationContext,
  type ShopifyHydrationContext,
} from "./hydration-contract.ts";
import {
  parseShopifyOrderSnapshot,
  shopifyTimestampInstant,
  type ShopifyOrderSnapshot,
} from "./order-hydration.ts";
import { shopifyJobLeaseSchema, type ShopifyJobLease } from "./queue-store.ts";
import { inspectShopifySourceMoney } from "./source-money.ts";

type Option = {
  name: string;
  value: string;
  provenance: "order_property" | "current_variant_option";
};
type DraftReason =
  | "CUSTOMER_RESOLUTION_REQUIRED"
  | "MAPPING_REQUIRED"
  | "DELIVERY_REVIEW_REQUIRED"
  | "SOURCE_CANCELLED"
  | "SOURCE_REFUND"
  | "SOURCE_EDIT"
  | "UNVERIFIED_PHONE"
  | "PHONE_COUNTRY_CONFLICT"
  | "UNSUPPORTED_LINE_TYPE"
  | "CONTRADICTORY_COLOUR"
  | "CONTRADICTORY_SIZE"
  | "MISSING_ITEM_NAME";
function explicitOption(options: Option[], aliases: string[]) {
  const selected = options.filter(
    (option) =>
      aliases.includes(option.name.trim().toLowerCase()) && option.value.trim(),
  );
  const distinct = new Set(
    selected.map((option) => option.value.trim().toLowerCase()),
  );
  return {
    value: distinct.size === 1 ? selected[0].value.trim() : null,
    contradictory: distinct.size > 1,
    evidence: selected,
  };
}
function buyerCandidate(snapshot: ShopifyOrderSnapshot) {
  const order = snapshot.order;
  const nameParts = (
    person: { firstName: string | null; lastName: string | null } | null,
  ) =>
    person
      ? [person.firstName?.trim(), person.lastName?.trim()]
          .filter(Boolean)
          .join(" ")
      : "";
  const name =
    nameParts(order.customer) ||
    nameParts(order.shippingAddress) ||
    nameParts(order.billingAddress);
  const primaryPhone =
    order.customer?.phone?.trim() || order.phone?.trim() || null;
  const countries = [
    ...new Set(
      [
        order.shippingAddress?.countryCodeV2,
        order.billingAddress?.countryCodeV2,
      ].filter((country): country is string => !!country),
    ),
  ];
  const explicitInternational = !!primaryPhone && /^(\+|00)/.test(primaryPhone);
  const countryConflict =
    !!primaryPhone && !explicitInternational && countries.length > 1;
  const phone =
    primaryPhone && /^[+\d\s().-]+$/.test(primaryPhone) && !countryConflict
      ? normalizedSourcePhone(
          primaryPhone,
          countries.length === 1 ? countries[0] : undefined,
        )
      : null;
  return {
    proposedName: name || `Shopify guest — ${order.name}`,
    generatedName: !name,
    // A source ID is an identity candidate, not proof of a local customer link.
    shopifyCustomerGid: order.customer?.id ?? null,
    verifiedPhoneE164: phone,
    unverifiedPrimaryPhone: primaryPhone && !phone ? primaryPhone : null,
    phoneCountryConflict: countryConflict,
    emailSuggestion:
      order.customer?.email?.trim() || order.email?.trim() || null,
    alternatePhones: [
      ...new Set(
        [
          order.shippingAddress?.phone?.trim(),
          order.billingAddress?.phone?.trim(),
        ].filter((value): value is string => !!value && value !== primaryPhone),
      ),
    ],
    guestOrderKey:
      !order.customer && !phone ? `${snapshot.shopGid}/${order.id}` : null,
    messagingConsent: false as const,
  };
}

function normalizedSourcePhone(value: string, country?: string): string | null {
  if (/^(\+|00)/.test(value)) {
    // Explicit international prefixes are authoritative. The shared legacy
    // helper's Indian ten-digit fallback must not reinterpret a malformed +98
    // number as +91; retain invalid source values for review instead.
    const parsed = parsePhoneNumberFromString(
      value.startsWith("00") ? `+${value.slice(2)}` : value,
      { extract: false },
    );
    return parsed?.isValid() && parsed.country ? parsed.number : null;
  }
  return normalizeCustomerPhone(value, country)?.e164 ?? null;
}

// Private, server-side draft INPUT only: no service client, database writes,
// profile matching/creation, local overrides, auto-release or notifications.
// The eventual import transaction must recheck these fences against live rows.
export function prepareShopifyDraft(
  input: unknown,
  context: ShopifyHydrationContext,
  lease: ShopifyJobLease,
  env: NodeJS.ProcessEnv = process.env,
  now = Date.now(),
) {
  assertShopifyHydrationContext(context, env);
  const parsedLease = shopifyJobLeaseSchema.safeParse(lease);
  if (!parsedLease.success || !Number.isFinite(now))
    throw new ShopifyIntegrationError("ACCESS_DENIED");
  const snapshot = parseShopifyOrderSnapshot(input);
  if (
    snapshot.tenantId !== context.tenantId ||
    snapshot.connectionId !== context.connectionId ||
    snapshot.shopGid !== context.shopGid ||
    snapshot.connectionRevision !== context.revision ||
    lease.tenantId !== context.tenantId ||
    lease.connectionId !== context.connectionId ||
    lease.connectionRevision !== context.revision ||
    lease.jobId !== snapshot.jobId ||
    lease.generation !== snapshot.generation ||
    lease.orderGid !== snapshot.order.id ||
    Date.parse(lease.leaseExpiresAt) <= now
  )
    throw new ShopifyIntegrationError("ACCESS_DENIED");
  const observed = shopifyTimestampInstant(snapshot.observedAt);
  if (
    observed > BigInt(Math.floor(now)) * BigInt(1_000_000) ||
    now - Date.parse(snapshot.observedAt) > 120_000 ||
    shopifyTimestampInstant(snapshot.order.createdAt) <
      shopifyTimestampInstant(context.importCreatedAtCutoff) ||
    shopifyTimestampInstant(snapshot.order.updatedAt) <
      shopifyTimestampInstant(snapshot.order.createdAt)
  )
    throw new ShopifyIntegrationError("SOURCE_CHANGED", 60);
  const reasons = new Set<DraftReason>([
    "CUSTOMER_RESOLUTION_REQUIRED",
    "MAPPING_REQUIRED",
    "DELIVERY_REVIEW_REQUIRED",
  ]);
  const customer = buyerCandidate(snapshot);
  if (customer.unverifiedPrimaryPhone) reasons.add("UNVERIFIED_PHONE");
  if (customer.phoneCountryConflict) reasons.add("PHONE_COUNTRY_CONFLICT");
  if (snapshot.order.cancelledAt) reasons.add("SOURCE_CANCELLED");
  if (
    /[1-9]/.test(snapshot.order.totalRefundedSet.shopMoney.amount) ||
    ["REFUNDED", "PARTIALLY_REFUNDED"].includes(
      snapshot.order.displayFinancialStatus ?? "",
    )
  )
    reasons.add("SOURCE_REFUND");
  if (
    snapshot.order.edited ||
    snapshot.lines.some((line) => line.currentQuantity !== line.quantity)
  )
    reasons.add("SOURCE_EDIT");
  const details = normalizeShopifyDraftLines(snapshot);
  for (const reason of details.reasons) reasons.add(reason);
  const money = inspectShopifySourceMoney(snapshot);
  return {
    kind: "shopify_draft_input" as const,
    schemaVersion: 1 as const,
    tenantId: snapshot.tenantId,
    connectionId: snapshot.connectionId,
    shopGid: snapshot.shopGid,
    jobId: snapshot.jobId,
    generation: snapshot.generation,
    connectionRevision: snapshot.connectionRevision,
    sourceOrderGid: snapshot.order.id,
    sourceUpdatedAt: snapshot.order.updatedAt,
    observedAt: snapshot.observedAt,
    customerId: null,
    customer,
    lines: details.lines,
    deliveryType: null,
    money,
    reasons: [...reasons, ...money.reasons],
    releaseEligible: false as const,
    // Private server-only DTO; not a role-facing response.
    sourceSnapshot: snapshot,
  };
}

// Reused at release from the authenticated source, without inventing a new
// queue lease or trusting stored/browser-derived production values.
export function normalizeShopifyDraftLines(snapshot: ShopifyOrderSnapshot) {
  const reasons = new Set<DraftReason>();
  const lines = snapshot.lines.map((line) => {
    const options: Option[] = [
      ...line.customAttributes.map((attribute) => ({
        name: attribute.key,
        value: attribute.value,
        provenance: "order_property" as const,
      })),
      ...(line.catalogue.variant?.selectedOptions ?? []).map((option) => ({
        ...option,
        provenance: "current_variant_option" as const,
      })),
    ];
    const colour = explicitOption(options, ["color", "colour", "shade"]);
    const size = explicitOption(options, ["size"]);
    if (colour.contradictory) reasons.add("CONTRADICTORY_COLOUR");
    if (size.contradictory) reasons.add("CONTRADICTORY_SIZE");
    if (line.isGiftCard || !line.requiresShipping)
      reasons.add("UNSUPPORTED_LINE_TYPE");
    if (!line.title.trim()) reasons.add("MISSING_ITEM_NAME");
    const image =
      line.image ??
      line.catalogue.variant?.image ??
      line.catalogue.product?.image ??
      null;
    return {
      lineGid: line.id,
      productGid: line.product?.id ?? null,
      variantGid: line.variant?.id ?? null,
      title: line.title,
      variantTitle: line.variantTitle,
      originalSku: line.sku,
      skuLookup: line.sku?.trim() || null,
      quantity: line.quantity,
      currentQuantity: line.currentQuantity,
      description: line.catalogue.product?.description ?? null,
      descriptionProvenance: line.catalogue.product
        ? ("current_catalogue" as const)
        : null,
      options,
      colour,
      size,
      image,
      imageProvenance: line.image
        ? ("source_line" as const)
        : line.catalogue.variant?.image
          ? ("current_variant" as const)
          : line.catalogue.product?.image
            ? ("current_product_fallback" as const)
            : null,
      warnings: [
        ...line.warnings,
        ...(!image ? ["IMAGE_UNAVAILABLE"] : []),
        ...(!colour.value && !colour.contradictory
          ? ["COLOUR_UNAVAILABLE"]
          : []),
      ],
      itemTypeId: null,
      workflowId: null,
      standardSizeId: null,
    };
  });
  return { lines, reasons: [...reasons] };
}
