import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Attachment, AttachmentEntityType } from "@/types/database";

export async function getAttachmentsForEntities({
  entityIds,
  entityType,
  tenantId
}: {
  entityIds: string[];
  entityType: AttachmentEntityType;
  tenantId: string;
}) {
  if (!entityIds.length) {
    return [] satisfies Attachment[];
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("entity_type", entityType)
    .in("entity_id", entityIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load attachments: ${error.message}`);
  }

  return data ?? [];
}

export function groupAttachmentsByEntityId(attachments: Attachment[]) {
  return attachments.reduce((groups, attachment) => {
    const rows = groups.get(attachment.entity_id) ?? [];
    rows.push(attachment);
    groups.set(attachment.entity_id, rows);
    return groups;
  }, new Map<string, Attachment[]>());
}
