import { after } from "next/server";
import { handleChatwootWebhook } from "@/features/chat/ingress";
import { chatCaptureDependencies } from "@/features/chat/capture";
import { processCapturedAgent } from "@/features/chat/agent/worker";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request, context: { params: Promise<{ workspaceKey: string }> }) {
  const { workspaceKey } = await context.params;
  return handleChatwootWebhook(request, workspaceKey, "events", chatCaptureDependencies(after, processCapturedAgent));
}
