import { after } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { handleTelegramLink } from "@/features/chat/notifications/handlers";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handleTelegramLink(request, {
    after,
    async resolve(hash) {
      const result = await createSupabaseServiceRoleClient().rpc(
        "chat_notification_resolve",
        { p_hash: hash },
      );
      if (result.error) throw new Error("Link lookup unavailable.");
      return result.data;
    },
    async claim(context, input) {
      const result = await createSupabaseServiceRoleClient().rpc(
        "chat_notification_link",
        { p_context: context, p_input: input },
      );
      if (result.error) throw new Error("Link claim unavailable.");
      return result.data;
    },
  });
}
