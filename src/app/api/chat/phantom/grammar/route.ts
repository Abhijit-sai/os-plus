import { handlePhantomGrammar } from "@/features/chat/agent/phantom-grammar";

export const runtime = "nodejs";
export const maxDuration = 25;

export async function POST(request: Request) {
  return handlePhantomGrammar(request);
}
