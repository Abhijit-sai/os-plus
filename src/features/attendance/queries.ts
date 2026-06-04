import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";

function todayIsoDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

type AttendancePageDataOptions = {
  dashboardEndDate?: string | null;
  dashboardStartDate?: string | null;
  selectedDate?: string | null;
};

export async function getAttendancePageData(options: AttendancePageDataOptions = {}) {
  const context = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();
  const today = todayIsoDate();
  const selectedDate = options.selectedDate?.trim() || today;
  const dashboardEndDate = options.dashboardEndDate?.trim() || today;
  const dashboardStartDate = options.dashboardStartDate?.trim() || shiftDate(dashboardEndDate, -13);

  const [workers, attendance, recentAttendance] = await Promise.all([
    supabase
      .from("workers")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("attendance")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("attendance_date", selectedDate)
      .is("deleted_at", null)
      .order("created_at"),
    supabase
      .from("attendance")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .gte("attendance_date", dashboardStartDate)
      .lte("attendance_date", dashboardEndDate)
      .is("deleted_at", null)
      .order("attendance_date", { ascending: false })
  ]);

  for (const result of [workers, attendance, recentAttendance]) {
    if (result.error) {
      throw new Error(`Unable to load attendance: ${result.error.message}`);
    }
  }

  return {
    context,
    dashboardEndDate,
    dashboardStartDate,
    selectedDate,
    workers: workers.data ?? [],
    attendance: attendance.data ?? [],
    recentAttendance: recentAttendance.data ?? []
  };
}
