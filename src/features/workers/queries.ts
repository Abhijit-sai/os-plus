import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";

export async function getWorkersPageData() {
  const context = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();
  const today = new Date().toISOString().slice(0, 10);

  const [workers, workgroups, workerWorkgroups, attendance, workLogs, ledger] = await Promise.all([
    supabase
      .from("workers")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("workgroups")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name"),
    supabase.from("worker_workgroups").select("*").eq("tenant_id", context.tenant.id),
    supabase
      .from("attendance")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("attendance_date", today)
      .is("deleted_at", null),
    supabase
      .from("item_stage_work_logs")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("started_at", { ascending: false })
      .limit(200),
    supabase
      .from("worker_ledger")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false })
      .limit(200)
  ]);

  for (const result of [workers, workgroups, workerWorkgroups, attendance, workLogs, ledger]) {
    if (result.error) {
      throw new Error(`Unable to load workers: ${result.error.message}`);
    }
  }

  return {
    context,
    today,
    workers: workers.data ?? [],
    workgroups: workgroups.data ?? [],
    workerWorkgroups: workerWorkgroups.data ?? [],
    attendance: attendance.data ?? [],
    workLogs: workLogs.data ?? [],
    ledger: ledger.data ?? []
  };
}
