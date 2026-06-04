"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import {
  getCommunicationVariables,
  getDefaultCommunicationTemplate,
  getRecipientForChannel,
  renderTemplate,
  safeCommunicationVariables
} from "@/features/communications/rendering";
import type { CommunicationChannel, CommunicationTemplatePurpose, CommunicationTriggerType, Json } from "@/types/database";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" ? value : ""),
  z
    .string()
    .trim()
    .transform((value) => (value.length ? value : null))
);

const channelSchema = z.object({
  channel: z.enum(["whatsapp", "email"]),
  provider: optionalText,
  mode: z.enum(["disabled", "sandbox", "live"]).default("disabled"),
  isEnabled: z.boolean().default(false),
  senderName: optionalText,
  senderAddress: optionalText,
  replyTo: optionalText
});

const templateSchema = z.object({
  channel: z.enum(["whatsapp", "email"]),
  purpose: z.enum([
    "order_update",
    "tracking_link",
    "payment_received",
    "payment_reminder",
    "pickup_ready",
    "dispatch_ready",
    "delivery_update",
    "custom_safe_note"
  ]),
  name: z.string().trim().min(2, "Template name is required."),
  subject: optionalText,
  bodyText: z.string().trim().min(5, "Message body is required."),
  providerTemplateName: optionalText,
  isActive: z.boolean().default(true)
});

const updateTemplateSchema = templateSchema.extend({
  templateId: z.string().uuid()
});

const templateIdSchema = z.object({
  templateId: z.string().uuid()
});

const triggerRuleSchema = z.object({
  triggerType: z.enum([
    "order_confirmed",
    "customer_status_changed",
    "pickup_ready",
    "dispatch_ready",
    "order_partially_delivered",
    "order_delivered",
    "payment_received",
    "balance_pending",
    "payment_reminder_before_delivery",
    "payment_overdue",
    "manual_tracking_link",
    "manual_payment_reminder"
  ]),
  channel: z.enum(["whatsapp", "email"]),
  templateId: z.string().uuid(),
  delayMinutes: z.coerce.number().int().min(0).default(0),
  isEnabled: z.boolean().default(false)
});

const updateTriggerRuleSchema = triggerRuleSchema.extend({
  triggerRuleId: z.string().uuid()
});

const triggerRuleIdSchema = z.object({
  triggerRuleId: z.string().uuid()
});

const manualOrderMessageSchema = z.object({
  orderId: z.string().uuid(),
  channel: z.enum(["whatsapp", "email"]),
  triggerType: z.enum(["manual_tracking_link", "manual_payment_reminder"])
});

async function getSettingsManageContext() {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "settings:manage");
  return context;
}

async function getOrderManageContext() {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "orders:manage");
  return context;
}

function normalizeTemplateVariables(bodyText: string) {
  const allowedVariables = new Set<string>(safeCommunicationVariables);
  const variables = [...bodyText.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((match) => match[1]);
  const blockedVariables = variables.filter((variable) => !allowedVariables.has(variable));

  if (blockedVariables.length) {
    throw new Error(`These variables are not allowed in customer messages: ${blockedVariables.join(", ")}.`);
  }

  return [...new Set(variables)];
}

export async function upsertCommunicationChannelSettingAction(formData: FormData) {
  const context = await getSettingsManageContext();
  const parsed = channelSchema.parse({
    channel: formData.get("channel"),
    provider: formData.get("provider"),
    mode: formData.get("mode") ?? "disabled",
    isEnabled: formData.get("isEnabled") === "on",
    senderName: formData.get("senderName"),
    senderAddress: formData.get("senderAddress"),
    replyTo: formData.get("replyTo")
  });

  if (parsed.mode === "live") {
    throw new Error("Live sending is intentionally disabled in this slice. Use sandbox until provider setup is reviewed.");
  }

  const supabase = createSupabaseServiceRoleClient();
  const existing = await supabase
    .from("communication_channel_settings")
    .select("id")
    .eq("tenant_id", context.tenant.id)
    .eq("channel", parsed.channel)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Unable to inspect communication channel: ${existing.error.message}`);
  }

  const payload = {
    provider: parsed.provider,
    mode: parsed.mode,
    is_enabled: parsed.isEnabled && parsed.mode !== "disabled",
    sender_name: parsed.senderName,
    sender_address: parsed.senderAddress,
    reply_to: parsed.replyTo,
    provider_config_json: {},
    updated_by: context.membership.clerk_user_id
  };

  const result = existing.data
    ? await supabase
        .from("communication_channel_settings")
        .update(payload)
        .eq("tenant_id", context.tenant.id)
        .eq("id", existing.data.id)
        .is("deleted_at", null)
    : await supabase.from("communication_channel_settings").insert({
        tenant_id: context.tenant.id,
        channel: parsed.channel,
        ...payload,
        created_by: context.membership.clerk_user_id
      });

  if (result.error) {
    throw new Error(`Unable to save communication channel: ${result.error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/communications");
}

export async function createCommunicationTemplateAction(formData: FormData) {
  const context = await getSettingsManageContext();
  const parsed = templateSchema.parse({
    channel: formData.get("channel"),
    purpose: formData.get("purpose"),
    name: formData.get("name"),
    subject: formData.get("subject"),
    bodyText: formData.get("bodyText"),
    providerTemplateName: formData.get("providerTemplateName"),
    isActive: formData.get("isActive") === "on"
  });
  const safeVariables = normalizeTemplateVariables(`${parsed.subject ?? ""} ${parsed.bodyText}`);

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("communication_templates").insert({
    tenant_id: context.tenant.id,
    channel: parsed.channel,
    purpose: parsed.purpose,
    name: parsed.name,
    subject: parsed.subject,
    body_text: parsed.bodyText,
    provider_template_name: parsed.providerTemplateName,
    safe_variables: safeVariables as Json,
    is_active: parsed.isActive,
    created_by: context.membership.clerk_user_id,
    updated_by: context.membership.clerk_user_id
  });

  if (error) {
    throw new Error(`Unable to create communication template: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/communications");
}

export async function updateCommunicationTemplateAction(formData: FormData) {
  const context = await getSettingsManageContext();
  const parsed = updateTemplateSchema.parse({
    templateId: formData.get("templateId"),
    channel: formData.get("channel"),
    purpose: formData.get("purpose"),
    name: formData.get("name"),
    subject: formData.get("subject"),
    bodyText: formData.get("bodyText"),
    providerTemplateName: formData.get("providerTemplateName"),
    isActive: formData.get("isActive") === "on"
  });
  const safeVariables = normalizeTemplateVariables(`${parsed.subject ?? ""} ${parsed.bodyText}`);
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("communication_templates")
    .update({
      channel: parsed.channel,
      purpose: parsed.purpose,
      name: parsed.name,
      subject: parsed.subject,
      body_text: parsed.bodyText,
      provider_template_name: parsed.providerTemplateName,
      safe_variables: safeVariables as Json,
      is_active: parsed.isActive,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.templateId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to update communication template: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/communications");
}

export async function archiveCommunicationTemplateAction(formData: FormData) {
  const context = await getSettingsManageContext();
  const parsed = templateIdSchema.parse({
    templateId: formData.get("templateId")
  });
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("communication_templates")
    .update({
      deleted_at: new Date().toISOString(),
      is_active: false,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.templateId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to archive communication template: ${error.message}`);
  }

  await supabase
    .from("communication_trigger_rules")
    .update({
      is_enabled: false,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("template_id", parsed.templateId)
    .is("deleted_at", null);

  revalidatePath("/settings");
  revalidatePath("/settings/communications");
}

export async function createCommunicationTriggerRuleAction(formData: FormData) {
  const context = await getSettingsManageContext();
  const parsed = triggerRuleSchema.parse({
    triggerType: formData.get("triggerType"),
    channel: formData.get("channel"),
    templateId: formData.get("templateId"),
    delayMinutes: formData.get("delayMinutes") || 0,
    isEnabled: formData.get("isEnabled") === "on"
  });
  const supabase = createSupabaseServiceRoleClient();

  const template = await supabase
    .from("communication_templates")
    .select("id, channel")
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.templateId)
    .eq("channel", parsed.channel)
    .is("deleted_at", null)
    .maybeSingle();

  if (template.error) {
    throw new Error(`Unable to validate template: ${template.error.message}`);
  }

  if (!template.data) {
    throw new Error("Template does not belong to this tenant or channel.");
  }

  const { error } = await supabase.from("communication_trigger_rules").insert({
    tenant_id: context.tenant.id,
    trigger_type: parsed.triggerType,
    channel: parsed.channel,
    template_id: parsed.templateId,
    delay_minutes: parsed.delayMinutes,
    is_enabled: parsed.isEnabled,
    created_by: context.membership.clerk_user_id,
    updated_by: context.membership.clerk_user_id
  });

  if (error) {
    throw new Error(`Unable to create communication trigger: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/communications");
}

export async function updateCommunicationTriggerRuleAction(formData: FormData) {
  const context = await getSettingsManageContext();
  const parsed = updateTriggerRuleSchema.parse({
    triggerRuleId: formData.get("triggerRuleId"),
    triggerType: formData.get("triggerType"),
    channel: formData.get("channel"),
    templateId: formData.get("templateId"),
    delayMinutes: formData.get("delayMinutes") || 0,
    isEnabled: formData.get("isEnabled") === "on"
  });
  const supabase = createSupabaseServiceRoleClient();
  const template = await supabase
    .from("communication_templates")
    .select("id, channel")
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.templateId)
    .eq("channel", parsed.channel)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (template.error) {
    throw new Error(`Unable to validate template: ${template.error.message}`);
  }

  if (!template.data) {
    throw new Error("Template does not belong to this tenant, is inactive, or does not match the selected channel.");
  }

  const { error } = await supabase
    .from("communication_trigger_rules")
    .update({
      trigger_type: parsed.triggerType,
      channel: parsed.channel,
      template_id: parsed.templateId,
      delay_minutes: parsed.delayMinutes,
      is_enabled: parsed.isEnabled,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.triggerRuleId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to update communication trigger: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/communications");
}

export async function archiveCommunicationTriggerRuleAction(formData: FormData) {
  const context = await getSettingsManageContext();
  const parsed = triggerRuleIdSchema.parse({
    triggerRuleId: formData.get("triggerRuleId")
  });
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("communication_trigger_rules")
    .update({
      deleted_at: new Date().toISOString(),
      is_enabled: false,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.triggerRuleId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to archive communication trigger: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/communications");
}

async function getOrigin() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getActiveTemplate({
  channel,
  purpose,
  tenantId
}: {
  channel: CommunicationChannel;
  purpose: CommunicationTemplatePurpose;
  tenantId: string;
}) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("communication_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("channel", channel)
    .eq("purpose", purpose)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load communication template: ${error.message}`);
  }

  return data;
}

export async function queueManualOrderMessageAction(formData: FormData) {
  const context = await getOrderManageContext();
  const parsed = manualOrderMessageSchema.parse({
    orderId: formData.get("orderId"),
    channel: formData.get("channel"),
    triggerType: formData.get("triggerType")
  });
  const supabase = createSupabaseServiceRoleClient();

  const order = await supabase
    .from("orders")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.orderId)
    .is("deleted_at", null)
    .maybeSingle();

  if (order.error) {
    throw new Error(`Unable to load order for message: ${order.error.message}`);
  }

  if (!order.data) {
    throw new Error("Order does not belong to this tenant.");
  }

  const customer = await supabase
    .from("customers")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .eq("id", order.data.customer_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (customer.error) {
    throw new Error(`Unable to load customer for message: ${customer.error.message}`);
  }

  if (!customer.data) {
    throw new Error("Customer does not belong to this tenant.");
  }

  const recipient = getRecipientForChannel({ channel: parsed.channel, customer: customer.data });

  if (parsed.channel === "whatsapp" && !recipient.recipientPhone) {
    throw new Error("This customer has no phone number for WhatsApp.");
  }

  if (parsed.channel === "email" && !recipient.recipientEmail) {
    throw new Error("This customer has no email address.");
  }

  const purpose = parsed.triggerType === "manual_payment_reminder" ? "payment_reminder" : "tracking_link";
  const activeTemplate = await getActiveTemplate({ channel: parsed.channel, purpose, tenantId: context.tenant.id });
  const fallbackTemplate = getDefaultCommunicationTemplate({
    channel: parsed.channel,
    triggerType: parsed.triggerType
  });
  const origin = await getOrigin();
  const variables = getCommunicationVariables({
    tenant: context.tenant,
    customer: customer.data,
    order: order.data,
    trackingUrl: `${origin}/track/${order.data.tracking_token}`
  });
  const subject = renderTemplate(activeTemplate?.subject ?? fallbackTemplate.subject, variables);
  const bodyText = renderTemplate(activeTemplate?.body_text ?? fallbackTemplate.bodyText, variables);
  const triggerEventKey = `${parsed.triggerType}:${parsed.channel}:${order.data.id}:${Date.now()}`;

  const inserted = await supabase
    .from("communication_message_queue")
    .insert({
      tenant_id: context.tenant.id,
      channel: parsed.channel,
      customer_id: customer.data.id,
      order_id: order.data.id,
      template_id: activeTemplate?.id ?? null,
      trigger_type: parsed.triggerType,
      trigger_event_key: triggerEventKey,
      recipient_name: customer.data.name,
      recipient_phone: recipient.recipientPhone,
      recipient_email: recipient.recipientEmail,
      subject,
      body_text: bodyText,
      status: "queued",
      provider_response_json: { dryRun: true },
      created_by: context.membership.clerk_user_id,
      updated_by: context.membership.clerk_user_id
    })
    .select("id")
    .single();

  if (inserted.error) {
    throw new Error(`Unable to queue message: ${inserted.error.message}`);
  }

  const log = await supabase.from("communication_message_logs").insert({
    tenant_id: context.tenant.id,
    message_queue_id: inserted.data.id,
    event_type: "queued",
    new_status: "queued",
    notes: "Dry-run message queued from order detail.",
    provider_response_json: { dryRun: true },
    created_by: context.membership.clerk_user_id
  });

  if (log.error) {
    throw new Error(`Message queued, but audit log failed: ${log.error.message}`);
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${order.data.id}`);
  revalidatePath("/settings/communications");
}
