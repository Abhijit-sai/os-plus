"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertPermission, hasPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import type { AttachmentEntityType, TenantUserRole } from "@/types/database";

const ATTACHMENT_BUCKET = "os-plus-attachments";
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]);

const optionalText = z.preprocess(
  (value) => (typeof value === "string" ? value : ""),
  z
    .string()
    .trim()
    .transform((value) => (value.length ? value : null))
);

const attachmentEntityTypeSchema = z.enum(["customer", "measurement", "order", "order_item", "stage_instance", "worker", "expense"]);

const attachmentSchema = z.object({
  entityType: attachmentEntityTypeSchema,
  entityId: z.string().uuid(),
  fileUrl: optionalText,
  fileType: optionalText,
  label: optionalText,
  notes: optionalText,
  isCustomerVisible: z.boolean()
});

const attachmentIdSchema = z.object({
  attachmentId: z.string().uuid()
});

function sanitizeFileName(fileName: string) {
  const cleanName = fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleanName || "attachment";
}

function getAttachmentFile(formData: FormData) {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error("Attachment must be 10 MB or smaller.");
  }

  if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
    throw new Error("Upload a JPG, PNG, WEBP, HEIC, or PDF file.");
  }

  return file;
}

async function uploadAttachmentFile({
  entityId,
  entityType,
  file,
  tenantId
}: {
  entityId: string;
  entityType: AttachmentEntityType;
  file: File;
  tenantId: string;
}) {
  const supabase = createSupabaseServiceRoleClient();
  const storagePath = `${tenantId}/${entityType}/${entityId}/${randomBytes(10).toString("hex")}-${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(storagePath, file, {
    contentType: file.type,
    upsert: false
  });

  if (error) {
    throw new Error(`Unable to upload attachment: ${error.message}`);
  }

  return {
    fileUrl: `supabase://${ATTACHMENT_BUCKET}/${storagePath}`,
    storageBucket: ATTACHMENT_BUCKET,
    storagePath
  };
}

function assertAttachmentPermission(role: TenantUserRole, entityType: AttachmentEntityType) {
  if (["customer", "measurement"].includes(entityType)) {
    assertPermission(role, "customers:manage");
    return;
  }

  if (["order", "order_item", "stage_instance"].includes(entityType)) {
    assertPermission(role, "orders:manage");
    return;
  }

  if (entityType === "worker") {
    if (!hasPermission(role, "workers:view") && !hasPermission(role, "production:manage")) {
      throw new Error("Permission denied: workers:view");
    }
    return;
  }

  if (entityType === "expense") {
    assertPermission(role, "finance:manage");
  }
}

async function validateEntityAndGetPaths({
  entityId,
  entityType,
  tenantId
}: {
  entityId: string;
  entityType: AttachmentEntityType;
  tenantId: string;
}) {
  const supabase = createSupabaseServiceRoleClient();

  if (entityType === "customer") {
    const { data, error } = await supabase
      .from("customers")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", entityId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to validate customer: ${error.message}`);
    }

    if (!data) {
      throw new Error("Customer does not belong to this tenant.");
    }

    return [`/customers/${entityId}`, "/customers"];
  }

  if (entityType === "measurement") {
    const { data, error } = await supabase
      .from("customer_measurements")
      .select("id, customer_id")
      .eq("tenant_id", tenantId)
      .eq("id", entityId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to validate measurement: ${error.message}`);
    }

    if (!data) {
      throw new Error("Measurement does not belong to this tenant.");
    }

    return [`/customers/${data.customer_id}`];
  }

  if (entityType === "order") {
    const { data, error } = await supabase
      .from("orders")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", entityId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to validate order: ${error.message}`);
    }

    if (!data) {
      throw new Error("Order does not belong to this tenant.");
    }

    return [`/orders/${entityId}`, "/orders"];
  }

  if (entityType === "order_item") {
    const { data, error } = await supabase
      .from("order_items")
      .select("id, order_id")
      .eq("tenant_id", tenantId)
      .eq("id", entityId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to validate order item: ${error.message}`);
    }

    if (!data) {
      throw new Error("Order item does not belong to this tenant.");
    }

    return [`/orders/${data.order_id}`, `/production/items/${entityId}/workflow`];
  }

  if (entityType === "stage_instance") {
    const { data, error } = await supabase
      .from("item_stage_instances")
      .select("id, order_item_id")
      .eq("tenant_id", tenantId)
      .eq("id", entityId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to validate workflow stage: ${error.message}`);
    }

    if (!data) {
      throw new Error("Workflow stage does not belong to this tenant.");
    }

    return [`/production/items/${data.order_item_id}/workflow`];
  }

  if (entityType === "worker") {
    const { data, error } = await supabase
      .from("workers")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", entityId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to validate worker: ${error.message}`);
    }

    if (!data) {
      throw new Error("Worker does not belong to this tenant.");
    }

    return ["/workers"];
  }

  const { data, error } = await supabase
    .from("expenses")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", entityId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to validate expense: ${error.message}`);
  }

  if (!data) {
    throw new Error("Expense does not belong to this tenant.");
  }

  return ["/finance"];
}

async function validateAttachmentAndGetPaths(attachmentId: string, tenantId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("attachments")
    .select("id, entity_type, entity_id, storage_bucket, storage_path")
    .eq("tenant_id", tenantId)
    .eq("id", attachmentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to validate attachment: ${error.message}`);
  }

  if (!data) {
    throw new Error("Attachment does not belong to this tenant.");
  }

  return {
    attachment: data,
    paths: await validateEntityAndGetPaths({
      entityId: data.entity_id,
      entityType: data.entity_type as AttachmentEntityType,
      tenantId
    })
  };
}

function revalidateAttachmentPaths(paths: string[]) {
  paths.forEach((path) => revalidatePath(path));
}

export async function createAttachmentAction(formData: FormData) {
  const context = await requireTenantContext();
  const file = getAttachmentFile(formData);
  const parsed = attachmentSchema.parse({
    entityType: formData.get("entityType"),
    entityId: formData.get("entityId"),
    fileUrl: formData.get("fileUrl"),
    fileType: formData.get("fileType"),
    label: formData.get("label"),
    notes: formData.get("notes"),
    isCustomerVisible: formData.get("isCustomerVisible") === "on"
  });

  if (!file && !parsed.fileUrl) {
    throw new Error("Upload a file or enter a file URL.");
  }

  if (parsed.fileUrl && !z.string().url().safeParse(parsed.fileUrl).success) {
    throw new Error("Enter a valid file URL.");
  }

  assertAttachmentPermission(context.membership.role, parsed.entityType);

  const paths = await validateEntityAndGetPaths({
    entityId: parsed.entityId,
    entityType: parsed.entityType,
    tenantId: context.tenant.id
  });

  const uploadedFile = file
    ? await uploadAttachmentFile({
        entityId: parsed.entityId,
        entityType: parsed.entityType,
        file,
        tenantId: context.tenant.id
      })
    : null;
  const finalFileUrl = uploadedFile?.fileUrl ?? parsed.fileUrl;

  if (!finalFileUrl) {
    throw new Error("Upload a file or enter a file URL.");
  }

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("attachments").insert({
    tenant_id: context.tenant.id,
    entity_type: parsed.entityType,
    entity_id: parsed.entityId,
    file_url: finalFileUrl,
    file_type: parsed.fileType ?? file?.type ?? null,
    storage_bucket: uploadedFile?.storageBucket ?? null,
    storage_path: uploadedFile?.storagePath ?? null,
    file_size_bytes: file?.size ?? null,
    label: parsed.label ?? file?.name ?? null,
    notes: parsed.notes,
    is_customer_visible: parsed.isCustomerVisible,
    uploaded_by: context.membership.clerk_user_id,
    created_by: context.membership.clerk_user_id,
    updated_by: context.membership.clerk_user_id
  });

  if (error) {
    throw new Error(`Unable to add attachment: ${error.message}`);
  }

  revalidateAttachmentPaths(paths);
}

export async function archiveAttachmentAction(formData: FormData) {
  const context = await requireTenantContext();
  const parsed = attachmentIdSchema.parse({
    attachmentId: formData.get("attachmentId")
  });
  const { attachment, paths } = await validateAttachmentAndGetPaths(parsed.attachmentId, context.tenant.id);

  assertAttachmentPermission(context.membership.role, attachment.entity_type as AttachmentEntityType);

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("attachments")
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.attachmentId);

  if (error) {
    throw new Error(`Unable to archive attachment: ${error.message}`);
  }

  if (attachment.storage_bucket && attachment.storage_path) {
    await supabase.storage.from(attachment.storage_bucket).remove([attachment.storage_path]);
  }

  revalidateAttachmentPaths(paths);
}
