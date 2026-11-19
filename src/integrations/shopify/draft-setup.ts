import { z } from "zod";

const id = z.string().uuid().nullable();
const date = z.string().date().nullable();

// Team choices only. Browser input cannot supply tenant, source quantities,
// prices, payment status or an implicit global variant mapping. Null values are
// intentional: managers can save an incomplete draft without starting work.
export const shopifyDraftSetupSchema = z.object({
  customerId: id,
  deliveryType: z.enum(["store_pickup", "self_delivery", "courier"]).nullable(),
  promisedDeliveryDate: date,
  note: z.string().trim().max(1000),
  lines: z.array(z.object({
    lineGid: z.string().regex(/^gid:\/\/shopify\/LineItem\/[1-9][0-9]{0,31}$/),
    itemTypeId: id,
    workflowId: id,
    standardSizeId: id,
    expectedCompletionDate: date,
    productionName: z.string().trim().max(2000).transform(value => value || null).nullable().optional(),
  }).strict()).min(1).max(500),
}).strict().refine(value => new Set(value.lines.map(line => line.lineGid)).size === value.lines.length,
  { message: "Each Shopify line must appear once." });

export type ShopifyDraftSetup = z.infer<typeof shopifyDraftSetupSchema>;

export const shopifyCompleteDraftSetupSchema = z.object({
  orderId: z.string().uuid(), connectionId: z.string().uuid(),
  setupId: z.string().uuid(), requestKey: z.string().uuid(),
}).strict();

const option = z.object({id: z.string().uuid(), name: z.string()}).strict();
export const shopifyDraftSetupViewSchema = z.object({
  tenantId: z.string().uuid(), orderId: z.string().uuid(), connectionId: z.string().uuid(),
  shopGid: z.string(), sourceOrderId: z.string().uuid(), sourceOrderGid: z.string(),
  sourceRevisionId: z.string().uuid(), sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
  sourceUpdatedAt: z.string().datetime({offset:true}), setupId: z.string().uuid().nullable(),
  version: z.number().int().nonnegative().safe(), current: z.boolean(),
  choices: shopifyDraftSetupSchema.nullable(), customerId: z.string().uuid().nullable(),
  itemTypes: z.array(option.extend({defaultWorkflowId: id.optional()}).strict()).max(500), customers: z.array(option).max(100),
  workflows: z.array(option.extend({itemTypeId: z.string().uuid().nullable()}).strict()).max(500),
  sizes: z.array(option.extend({itemTypeId: z.string().uuid()}).strict()).max(500),
  customerSearchRequired: z.boolean(),
}).strict();
export type ShopifyDraftSetupView = z.infer<typeof shopifyDraftSetupViewSchema>;

function garmentWords(name: string) {
  return (name.toLowerCase().match(/[a-z0-9]+/g) ?? []).join(" ")
    .replace(/\bt shirts?\b|\btshirts?\b/g, "tshirt")
    .replace(/\bshirts\b/g, "shirt")
    .replace(/\b(?:pants|trouser|trousers)\b/g, "pant");
}

export function shopifyGarmentType(title: string, itemTypes: ShopifyDraftSetupView["itemTypes"]) {
  const words = garmentWords(title);
  if (!words) return null;
  const itemNames = itemTypes.map(type => ({id:type.id,name:garmentWords(type.name)}));
  const families = [...new Set(words.match(/\b(?:pant|shirt|tshirt)\b/g))];
  if (families.length > 1) return null;

  const matches = itemNames.filter(type => type.name && ` ${words} `.includes(` ${type.name} `));
  const mostSpecific = matches.filter(type => !matches.some(other =>
    type.name !== other.name && ` ${other.name} `.includes(` ${type.name} `),
  ));
  if (mostSpecific.length) return mostSpecific.length === 1 ? mostSpecific[0].id : null;

  const [family] = families;
  if (!family) return null;
  const familyMatches = itemNames.filter(type => {
    const typeFamilies = new Set(type.name.match(/\b(?:pant|shirt|tshirt)\b/g));
    return typeFamilies.size === 1 && typeFamilies.has(family);
  });
  return familyMatches.length === 1 ? familyMatches[0].id : null;
}

export function shopifyDefaultWorkflow(itemTypeId: string | null, view: Pick<ShopifyDraftSetupView, "itemTypes" | "workflows">) {
  const defaultId = view.itemTypes.find(type => type.id === itemTypeId)?.defaultWorkflowId;
  return view.workflows.find(workflow => workflow.id === defaultId &&
    (!workflow.itemTypeId || workflow.itemTypeId === itemTypeId))?.id ?? null;
}

export type ShopifyDraftActionState = {status: "idle" | "saved" | "complete" | "error"; message: string;
  setupId?: string; version?: number; orderId?: string};

export const shopifySaveDraftSetupSchema = z.object({
  orderId: z.string().uuid(),
  sourceRevisionId: z.string().uuid(),
  expectedVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1),
  requestKey: z.string().uuid(),
  choices: shopifyDraftSetupSchema,
}).strict();

export const shopifyStartDraftSetupSchema = shopifySaveDraftSetupSchema.extend({
  connectionId: z.string().uuid(),
  completionRequestKey: z.string().uuid(),
});

// This is a display checklist, never production authorization. Completion must
// recheck live source/configuration/permissions in the database transaction.
export function shopifyDraftSetupMissing(choices: ShopifyDraftSetup) {
  const parsed = shopifyDraftSetupSchema.parse(choices);
  return [
    ...(!parsed.customerId ? ["Choose a customer"] : []),
    ...parsed.lines.flatMap((line, index) => [
      ...(!line.itemTypeId ? [`Item ${index + 1}: choose garment type`] : []),
      ...(!line.workflowId ? [`Item ${index + 1}: choose workflow`] : []),
    ]),
  ];
}
