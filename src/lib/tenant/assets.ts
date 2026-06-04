import "server-only";

import { randomBytes } from "crypto";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const TENANT_ASSETS_BUCKET = "tenant-assets";
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function sanitizeFileName(fileName: string) {
  const cleanName = fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleanName || "logo";
}

export function getTenantLogoFile(formData: FormData) {
  const file = formData.get("logo");

  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  if (file.size > MAX_LOGO_SIZE_BYTES) {
    throw new Error("Logo must be 2 MB or smaller.");
  }

  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    throw new Error("Upload a PNG, JPG, or WEBP logo.");
  }

  return file;
}

export async function uploadTenantLogo({
  file,
  slug
}: {
  file: File;
  slug: string;
}) {
  const supabase = createSupabaseServiceRoleClient();
  const storagePath = `${slug}/logo/${randomBytes(8).toString("hex")}-${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage.from(TENANT_ASSETS_BUCKET).upload(storagePath, file, {
    contentType: file.type,
    upsert: false
  });

  if (error) {
    throw new Error(`Unable to upload tenant logo: ${error.message}`);
  }

  return supabase.storage.from(TENANT_ASSETS_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}
