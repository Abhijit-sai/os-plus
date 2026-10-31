import { after } from "next/server";
import { handleNotificationCron } from "@/features/chat/notifications/handlers";
import {
  notificationTick,
  notifyPlatformFailure,
} from "@/features/chat/notifications/engine";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  return handleNotificationCron(request, {
    after,
    tick: notificationTick,
    platformFailure: notifyPlatformFailure,
  });
}
