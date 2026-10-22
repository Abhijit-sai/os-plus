import { notFound } from "next/navigation";
import { ChatAccessError, requireChatPermission } from "@/features/chat/module";
import { isMockPreviewEnabled } from "@/features/chat/agent/preview-server";
import { BotPreview } from "@/components/chat/bot-preview";

export default async function BotPreviewPage() {
  if (!isMockPreviewEnabled()) notFound();
  let data: { tenantId: string; brands: { id: string; name: string }[] };
  try {
    const { context, db } = await requireChatPermission("chat_settings:manage");
    const brands = await db
      .from("chat_brands")
      .select("id,name")
      .eq("tenant_id", context.tenant.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name");
    if (brands.error) throw new Error("Preview could not be loaded.");
    data = { tenantId: context.tenant.id, brands: brands.data ?? [] };
  } catch (error) {
    if (error instanceof ChatAccessError) notFound();
    throw error;
  }
  return <BotPreview key={data.tenantId} brands={data.brands} />;
}
