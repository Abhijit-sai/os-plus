import "server-only";
import { z } from "zod";
import { requireChatPermission, ChatAccessError } from "../chat/module";
import { createUserCommandContext } from "@/core/command-context/server";
import { projectLead } from "./pii";
import { chatwootBrowserUrl, chatTransportSchema } from "./transport";
import { leadFiltersSchema, leadPageReadSchema } from "./read-schemas";

export async function getLeadInbox(input: unknown) {
  const filters = leadFiltersSchema.parse(input);
  const { context, db } = await requireChatPermission("leads:view");
  const result = await db.rpc("chat_crm_read", {
    p_context: { ...createUserCommandContext(context) },
    p_view: "leads",
    p_input: JSON.parse(JSON.stringify(filters)),
  });
  if (result.error)
    throw new Error("Enquiries could not be loaded. Try again.");
  const page = leadPageReadSchema.parse(result.data);
  const items = page.items.map((row) =>
    projectLead(row, { pii: page.permissions.pii, now: page.asOf }),
  );
  const tenantId = context.tenant.id;
  const [brands, branches, channels, owners] = await Promise.all([
    db
      .from("chat_brands")
      .select("id,name")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("name"),
    db
      .from("tenant_locations")
      .select("id,name")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name"),
    db
      .from("chat_channels")
      .select("id,name")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name"),
    db
      .from("tenant_users")
      .select("id,display_name,role")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .order("display_name"),
  ]);
  if ([brands, branches, channels, owners].some((r) => r.error))
    throw new Error("Enquiry filters could not be loaded.");
  const named = z.array(
    z.object({ id: z.string().uuid(), name: z.string().nullable() }),
  );
  return {
    ...page,
    items,
    filters,
    options: {
      brands: named.parse(brands.data),
      branches: named.parse(branches.data),
      channels: named.parse(channels.data),
      owners: (owners.data ?? [])
        .filter((o) => o.role === "owner_admin" || o.role === "manager")
        .map((o) => ({ id: o.id, name: o.display_name || "Team member" })),
    },
  };
}
export async function getChatEntry(leadId?: string) {
  const { context, db } = await requireChatPermission("leads:manage");
  const result = await db
    .from("chat_workspaces")
    .select("chatwoot_base_url,chatwoot_account_id,status")
    .eq("tenant_id", context.tenant.id)
    .maybeSingle();
  if (result.error) throw new Error("The chat connection could not be loaded.");
  if (
    !result.data ||
    result.data.status !== "active" ||
    !result.data.chatwoot_account_id
  )
    return null;
  if (leadId) {
    const id = z.string().uuid().parse(leadId);
    const read = await db.rpc("chat_crm_read", {
      p_context: { ...createUserCommandContext(context) },
      p_view: "lead",
      p_input: { id },
    });
    if (read.error) throw new ChatAccessError();
    const response = z
      .object({
        item: z.unknown().nullable(),
        details: z.object({ chat: chatTransportSchema.nullable() }).optional(),
      })
      .parse(read.data);
    if (!response.item) throw new ChatAccessError();
    return response.details?.chat
      ? chatwootBrowserUrl(
          response.details.chat,
          process.env.CHATWOOT_BROWSER_ORIGIN,
        )
      : null;
  }
  return chatwootBrowserUrl(
    {
      baseUrl: result.data.chatwoot_base_url,
      accountId: result.data.chatwoot_account_id,
    },
    process.env.CHATWOOT_BROWSER_ORIGIN,
  );
}
/** Additive navigation must remain absent when the module is disabled or not installed. */
export async function getChatNavigation() {
  try {
    const { context } = await requireChatPermission("leads:view");
    return {
      leads: true,
      chats:
        context.membership.role === "owner_admin" ||
        context.membership.role === "manager",
    };
  } catch (error) {
    if (error instanceof ChatAccessError) return { leads: false, chats: false };
    // A Chat dependency outage must not make the existing Boutique shell unusable.
    return { leads: false, chats: false };
  }
}

export async function getLeadDetail(input: unknown) {
  const id = z.string().uuid().parse(input);
  const { context, db } = await requireChatPermission("leads:view");
  if (
    context.membership.role === "owner_admin" ||
    context.membership.role === "manager"
  ) {
    const { refreshLeadOnView } = await import("./commands");
    await refreshLeadOnView(id);
  }
  const result = await db.rpc("chat_crm_read", {
    p_context: { ...createUserCommandContext(context) },
    p_view: "lead",
    p_input: { id },
  });
  if (result.error) throw new Error("This enquiry could not be loaded.");
  const raw = z.object({ item: z.unknown().nullable() }).parse(result.data);
  if (raw.item === null) return null;
  const page = leadPageReadSchema.parse(result.data);
  const details = z
    .object({
      details: z.object({
        messages: z.array(z.unknown()).max(50),
        messageCount: z.number().int().nonnegative(),
        history: z.array(z.unknown()).max(50),
        historyCount: z.number().int().nonnegative(),
        owners: z.array(
          z.object({ id: z.string().uuid(), name: z.string().max(200) }),
        ),
        draft: z
          .object({
            text: z.string().max(150000),
            knowledgeVersion: z.number().int().positive().nullable(),
          })
          .nullable(),
      }),
    })
    .parse(result.data).details;
  const { projectMessage, projectHistory } = await import("./pii");
  return {
    lead: projectLead(raw.item, { pii: page.permissions.pii, now: page.asOf }),
    permissions: page.permissions,
    messages: details.messages
      .map((row) => projectMessage(row, page.permissions.pii))
      .filter((row) => row !== null),
    messageCount: details.messageCount,
    history: details.history.map(projectHistory),
    historyCount: details.historyCount,
    owners: details.owners,
    draft: page.permissions.pii ? details.draft : null,
    asOf: page.asOf,
  };
}

export async function getContacts(input: unknown = {}) {
  const { contactFiltersSchema, contactPageReadSchema } =
    await import("./read-schemas");
  const { projectContact } = await import("./pii");
  const filters = contactFiltersSchema.parse(input),
    { context, db } = await requireChatPermission("leads:view");
  const result = await db.rpc("chat_crm_read", {
    p_context: { ...createUserCommandContext(context) },
    p_view: "contacts",
    p_input: JSON.parse(JSON.stringify(filters)),
  });
  if (result.error) throw new Error("Contacts could not be loaded.");
  const page = contactPageReadSchema.parse(result.data);
  return {
    ...page,
    filters,
    items: page.items.map((raw) => {
      const identities = z
        .object({ identities: z.array(z.unknown()) })
        .parse(raw).identities;
      return projectContact(raw, identities, page.permissions.pii);
    }),
  };
}
export async function getContactDetail(input: unknown, mergeQuery?: string) {
  const id = z.string().uuid().parse(input),
    { context, db } = await requireChatPermission("leads:view");
  const { projectContact } = await import("./pii");
  const { contactPageReadSchema } = await import("./read-schemas");
  const result = await db.rpc("chat_crm_read", {
    p_context: { ...createUserCommandContext(context) },
    p_view: "contact",
    p_input: { id },
  });
  if (result.error) throw new Error("This contact could not be loaded.");
  const raw = z.object({ item: z.unknown().nullable() }).parse(result.data);
  if (raw.item === null) return null;
  const page = contactPageReadSchema.parse(result.data);
  const details = z
    .object({
      details: z.object({
        identities: z.array(z.unknown()),
        customer: z
          .object({
            id: z.string().uuid(),
            name: z.string(),
            phone: z.string().nullable(),
            email: z.string().nullable(),
          })
          .nullable(),
        matchingCustomers: z.array(
          z.object({ id: z.string().uuid(), name: z.string() }),
        ),
        orders: z
          .array(
            z.object({
              id: z.string().uuid(),
              order_number: z.string(),
              order_date: z.string(),
              status: z.string(),
              total: z.coerce.number().finite().nonnegative(),
              paid: z.coerce.number().finite().nonnegative(),
              currency: z.string().regex(/^[A-Z]{3}$/),
            }),
          )
          .max(20),
        orderCount: z.number().int().nonnegative(),
        lifetime: z.array(
          z.object({
            currency: z.string().regex(/^[A-Z]{3}$/),
            amount: z.coerce.number().finite().nonnegative(),
          }),
        ),
        merges: z
          .array(
            z.object({
              id: z.string().uuid(),
              at: z.string().datetime({ offset: true }),
              splitAt: z.string().datetime({ offset: true }).nullable(),
            }),
          )
          .max(20),
        language: z.string().max(35).nullable(),
      }),
    })
    .parse(result.data).details;
  const { hasPermission } = await import("@/lib/permissions/roles");
  const native =
    page.permissions.pii &&
    hasPermission(context.membership.role, "customers:view") &&
    hasPermission(context.membership.role, "orders:view");
  const related = await getLeadInbox({ contactId: id, page: 1 });
  const candidates = page.permissions.manage
    ? await getContacts({ q: mergeQuery, page: 1 })
    : null;
  return {
    contact: projectContact(raw.item, details.identities, page.permissions.pii),
    permissions: page.permissions,
    customer: native ? details.customer : null,
    matchingCustomers: page.permissions.manage ? details.matchingCustomers : [],
    orders: native ? details.orders : [],
    orderCount: native ? details.orderCount : 0,
    lifetime: native ? details.lifetime : [],
    merges: page.permissions.manage ? details.merges : [],
    language: page.permissions.pii ? details.language : null,
    leads: related.items,
    leadCount: related.total,
    candidates: candidates
      ? candidates.items.filter((c) => c.id !== id && !c.merged)
      : [],
    candidateTotal: candidates?.total ?? 0,
  };
}

export async function getLeadPerformance(input: unknown = {}) {
  const filters = leadFiltersSchema.parse(input),
    { context, db } = await requireChatPermission("chat_reports:view");
  const result = await db.rpc("chat_crm_read", {
    p_context: { ...createUserCommandContext(context) },
    p_view: "performance",
    p_input: JSON.parse(JSON.stringify(filters)),
  });
  if (result.error) throw new Error("Enquiry performance could not be loaded.");
  const page = leadPageReadSchema.parse(result.data),
    count = z.number().int().nonnegative().safe();
  const report = z
    .object({
      performance: z.object({
        medianFirstHumanSeconds: z.number().finite().nonnegative().nullable(),
        publicStaffReplies: count,
        unmappedStaffReplies: count,
        afterHoursUnknownReplies: count,
        people: z
          .array(
            z.object({
              id: z.string().uuid(),
              name: z.string().max(200),
              status: z.string(),
              replies: count,
              owned: count,
              won: count,
              afterHours: count.nullable(),
            }),
          )
          .max(50),
        peopleCount: count,
        needsLook: z.array(z.unknown()).max(20),
        needsLookCount: count,
      }),
    })
    .parse(result.data).performance;
  const options = (await getLeadInbox(filters)).options;
  return {
    filters,
    options,
    permissions: page.permissions,
    counters: page.counters,
    total: page.total,
    pipeline: page.pipeline,
    page: page.page,
    asOf: page.asOf,
    ...report,
    needsLook: report.needsLook.map((row) =>
      projectLead(row, { pii: true, now: page.asOf }),
    ),
  };
}
export async function getWaitingLeadCount(): Promise<{
  waiting: number | null;
} | null> {
  try {
    const { context, db } = await requireChatPermission("leads:view");
    const result = await db.rpc("chat_crm_read", {
      p_context: { ...createUserCommandContext(context) },
      p_view: "leads",
      p_input: {},
    });
    if (result.error) return { waiting: null };
    return { waiting: leadPageReadSchema.parse(result.data).counters.waiting };
  } catch (error) {
    return error instanceof ChatAccessError ? null : { waiting: null };
  }
}

export async function getChatPanelConfig() {
  const { context, db } = await requireChatPermission("leads:manage");
  const result = await db
    .from("chat_workspaces")
    .select("chatwoot_base_url,chatwoot_account_id,status")
    .eq("tenant_id", context.tenant.id)
    .maybeSingle();
  if (
    result.error ||
    !result.data ||
    result.data.status !== "active" ||
    !result.data.chatwoot_account_id
  )
    throw new ChatAccessError();
  const url = chatwootBrowserUrl(
    {
      baseUrl: result.data.chatwoot_base_url,
      accountId: result.data.chatwoot_account_id,
    },
    process.env.CHATWOOT_BROWSER_ORIGIN,
  );
  return {
    origin: new URL(url).origin,
    accountId: result.data.chatwoot_account_id,
  };
}
export async function getPanelLead(input: unknown) {
  const { panelLookupSchema } = await import("./panel");
  const request = panelLookupSchema.parse(input),
    { context, db } = await requireChatPermission("leads:manage");
  const result = await db.rpc("chat_crm_read", {
    p_context: { ...createUserCommandContext(context) },
    p_view: "panel",
    p_input: request,
  });
  if (result.error) throw new ChatAccessError();
  const { leadId } = z
    .object({ leadId: z.string().uuid().nullable() })
    .strict()
    .parse(result.data);
  if (!leadId) return null;
  const detail = await getLeadDetail(leadId);
  if (!detail) return null;
  return { lead: detail.lead, owners: detail.owners };
}
