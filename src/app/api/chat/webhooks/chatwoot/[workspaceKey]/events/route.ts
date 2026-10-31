import { after } from "next/server";
import { handleChatwootWebhook } from "@/features/chat/ingress";
import { chatCaptureDependencies } from "@/features/chat/capture";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request, context: { params: Promise<{ workspaceKey: string }> }) {
  const { workspaceKey } = await context.params;
  return handleChatwootWebhook(request, workspaceKey, "events", chatCaptureDependencies(after));
}
