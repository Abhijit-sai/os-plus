import "server-only";

import { assertPermission, hasPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import type { WorkerLedger } from "@/types/database";

const workerMoneyPageSize = 50;

export async function getWorkersPageData({
  workerId,
  workerMoneyPage = 1,
}: {
  workerId?: string;
  workerMoneyPage?: number;
} = {}) {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "workers:view");
  const canViewSalary = hasPermission(context.membership.role, "salary:view");
  const canManageWorkers = hasPermission(context.membership.role, "settings:manage");

  // The worker page includes wage and worker-money information throughout.
  // Fail closed if a future role receives workers:view without salary:view.
  assertPermission(context.membership.role, "salary:view");

  const supabase = createSupabaseServiceRoleClient();
  const today = new Date().toISOString().slice(0, 10);

  const [workers, workgroups, workerWorkgroups, attendance, workLogs] = await Promise.all([
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
  ]);

  for (const result of [workers, workgroups, workerWorkgroups, attendance, workLogs]) {
    if (result.error) {
      throw new Error(`Unable to load workers: ${result.error.message}`);
    }
  }

  const selectedWorkerId = workerId && workers.data?.some((worker) => worker.id === workerId)
    ? workerId
    : null;
  let resolvedWorkerMoneyPage = Number.isInteger(workerMoneyPage) && workerMoneyPage > 0
    ? workerMoneyPage
    : 1;
  let ledger: WorkerLedger[] = [];
  let ledgerCount = 0;

  if (selectedWorkerId) {
    const loadLedgerPage = (start: number) =>
      supabase
        .from("worker_ledger")
        .select("*", { count: "exact" })
        .eq("tenant_id", context.tenant.id)
        .eq("worker_id", selectedWorkerId)
        .is("deleted_at", null)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(start, start + workerMoneyPageSize - 1);
    let ledgerStart = (resolvedWorkerMoneyPage - 1) * workerMoneyPageSize;
    let ledgerResult = await loadLedgerPage(ledgerStart);

    if (ledgerResult.error) {
      throw new Error(`Unable to load worker money history: ${ledgerResult.error.message}`);
    }

    const resultCount = ledgerResult.count ?? 0;
    const lastPage = Math.max(1, Math.ceil(resultCount / workerMoneyPageSize));
    if (resolvedWorkerMoneyPage > lastPage) {
      resolvedWorkerMoneyPage = lastPage;
      ledgerStart = (lastPage - 1) * workerMoneyPageSize;
      ledgerResult = await loadLedgerPage(ledgerStart);
      if (ledgerResult.error) {
        throw new Error(`Unable to load worker money history: ${ledgerResult.error.message}`);
      }
    }

    ledger = ledgerResult.data ?? [];
    ledgerCount = ledgerResult.count ?? 0;
  }

  const summaries = await supabase.rpc("worker_money_summaries", {
    p_tenant_id: context.tenant.id,
  });

  if (summaries.error) {
    throw new Error(`Unable to load worker money summaries: ${summaries.error.message}`);
  }

  return {
    canManageWorkers,
    canViewSalary,
    context,
    today,
    workers: workers.data ?? [],
    workgroups: workgroups.data ?? [],
    workerWorkgroups: workerWorkgroups.data ?? [],
    attendance: attendance.data ?? [],
    workLogs: workLogs.data ?? [],
    ledger,
    ledgerCount,
    selectedWorkerId,
    workerMoneyPage: resolvedWorkerMoneyPage,
    workerMoneyPageSize,
    workerMoneySummaries: summaries.data ?? [],
  };
}
