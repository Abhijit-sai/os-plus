import { NextResponse } from "next/server";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";

export async function GET(
  _request: Request,
  {
    params
  }: {
    params: Promise<{ attachmentId: string }>;
  }
) {
  const context = await requireTenantContext();
  const { attachmentId } = await params;
  const supabase = createSupabaseServiceRoleClient();
  const { data: attachment, error } = await supabase
    .from("attachments")
    .select("id, file_url, storage_bucket, storage_path")
    .eq("tenant_id", context.tenant.id)
    .eq("id", attachmentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: `Unable to load attachment: ${error.message}` }, { status: 500 });
  }

  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }

  if (!attachment.storage_bucket || !attachment.storage_path) {
    return NextResponse.redirect(attachment.file_url);
  }

  const { data, error: signedUrlError } = await supabase.storage
    .from(attachment.storage_bucket)
    .createSignedUrl(attachment.storage_path, 60);

  if (signedUrlError || !data?.signedUrl) {
    return NextResponse.json({ error: signedUrlError?.message ?? "Unable to create attachment link." }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
