import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { handleLeadRefresh } from "@/features/leads/refresh-handler";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handleLeadRefresh(request, {
    async refresh(context, input) {
      const result = await createSupabaseServiceRoleClient().rpc(
        "chat_lead_refresh",
        { p_context: context, p_input: input },
      );
      if (result.error) throw new Error("Refresh unavailable");
      return result.data;
    },
  });
}
