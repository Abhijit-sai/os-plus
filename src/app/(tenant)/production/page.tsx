import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  Circle,
  GitBranch,
  PlayCircle,
  UserRound,
  X
} from "lucide-react";

import { getProductionItemPageData, getProductionPageData } from "@/features/production/queries";
import { StatusBadge } from "@/components/design-system/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { ItemTypeIcon } from "@/components/item-types/item-type-icon";
import { ProductionFilterBar } from "@/components/production/production-filter-bar";
import { ItemWorkflowPanel } from "@/components/production/item-workflow-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function daysUntil(date: string | null) {
  if (!date) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function getDueLabel(days: number | null) {
  if (days === null) {
    return "No due date";
  }

  if (days < 0) {
    return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} late`;
  }

  if (days === 0) {
    return "Due today";
  }

  return `Due in ${days} day${days === 1 ? "" : "s"}`;
}

function getCurrentStepLabel(stageName: string | undefined, isDelivered: boolean) {
  if (!stageName) {
    return "Workflow not initialized";
  }

  if (!isDelivered && stageName.toLowerCase() === "delivered") {
    return "Delivery / handoff";
  }

  return stageName;
}

function isDeliveryStageName(stageName: string | undefined) {
  const normalized = stageName?.toLowerCase() ?? "";
  return normalized.includes("deliver") || normalized.includes("handoff");
}

function getDueProgress(days: number | null) {
  if (days === null) {
    return 20;
  }

  if (days < 0) {
    return 100;
  }

  return Math.max(10, Math.min(100, 100 - days * 12));
}

function normalizeFilterValues(value: string | string[] | undefined) {
  if (!value) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];

  return values
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase("en-IN");
}

export default async function ProductionPage({
  searchParams
}: {
  searchParams?: Promise<{
    q?: string;
    queue?: string;
    workflowItemId?: string;
    view?: string;
    itemTypeId?: string | string[];
    workflowId?: string | string[];
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const search = resolvedSearchParams?.q?.trim() ?? "";
  const queueFilter = resolvedSearchParams?.queue ?? "active";
  const activeView = resolvedSearchParams?.view === "board" ? "board" : "list";
  const selectedWorkflowIds = normalizeFilterValues(resolvedSearchParams?.workflowId).filter((id) => id !== "all");
  const selectedItemTypeIds = normalizeFilterValues(resolvedSearchParams?.itemTypeId).filter((id) => id !== "all");
  const selectedWorkflowSet = new Set(selectedWorkflowIds);
  const selectedItemTypeSet = new Set(selectedItemTypeIds);
  const selectedWorkflowItemId = resolvedSearchParams?.workflowItemId;
  const selectedWorkflowData = selectedWorkflowItemId ? await getProductionItemPageData(selectedWorkflowItemId) : null;
  const { items, orders, customers, itemTypes, workflows, workflowStages, workflowInstances, stageInstances, stages, workLogs, workers } = await getProductionPageData({ itemTypeIds: selectedItemTypeIds, workflowIds: selectedWorkflowIds });
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const itemTypeById = new Map(itemTypes.map((itemType) => [itemType.id, itemType]));
  const workflowById = new Map(workflows.map((workflow) => [workflow.id, workflow]));
  const workflowInstanceByItemId = new Map(workflowInstances.map((instance) => [instance.order_item_id, instance]));
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const workerById = new Map(workers.map((worker) => [worker.id, worker]));
  const activeLogByStageId = new Map(workLogs.filter((log) => log.status === "in_progress").map((log) => [log.stage_instance_id, log]));
  const stageInstancesByWorkflowInstanceId = new Map<string, typeof stageInstances>();

  stageInstances.forEach((stageInstance) => {
    const existing = stageInstancesByWorkflowInstanceId.get(stageInstance.workflow_instance_id) ?? [];
    existing.push(stageInstance);
    stageInstancesByWorkflowInstanceId.set(stageInstance.workflow_instance_id, existing);
  });

  const currentStageByWorkflowInstanceId = new Map(
    stageInstances
      .filter((stage) => ["ready_to_start", "in_progress", "paused", "blocked"].includes(stage.status))
      .sort((a, b) => a.sequence_number - b.sequence_number)
      .map((stage) => [stage.workflow_instance_id, stage])
  );
  const productionRows = items.map((item) => {
    const order = orderById.get(item.order_id);
    const customer = order ? customerById.get(order.customer_id) : null;
    const workflow = workflowById.get(item.workflow_id);
    const itemType = itemTypeById.get(item.item_type_id);
    const workflowInstance = workflowInstanceByItemId.get(item.id);
    const currentStage = workflowInstance ? currentStageByWorkflowInstanceId.get(workflowInstance.id) : null;
    const stage = currentStage ? stageById.get(currentStage.stage_master_id) : null;
    const activeLog = currentStage ? activeLogByStageId.get(currentStage.id) : null;
    const activeWorker = activeLog ? workerById.get(activeLog.worker_id) : null;
    const itemStageInstances = workflowInstance
      ? (stageInstancesByWorkflowInstanceId.get(workflowInstance.id) ?? []).sort((a, b) => a.sequence_number - b.sequence_number)
      : [];
    const completedStageCount = itemStageInstances.filter((stageInstance) => stageInstance.status === "completed").length;
    const finalStageInstance = itemStageInstances.at(-1);
    const finalStage = finalStageInstance ? stageById.get(finalStageInstance.stage_master_id) : null;
    const dueInDays = daysUntil(item.expected_completion_date);
    const isWorkflowDeliveryComplete =
      Boolean(itemStageInstances.length) &&
      itemStageInstances.every((stageInstance) => ["completed", "skipped"].includes(stageInstance.status)) &&
      finalStageInstance?.status === "completed" &&
      isDeliveryStageName(finalStage?.name);
    const isDelivered = item.item_status === "delivered" || isWorkflowDeliveryComplete;
    const isAtRisk = dueInDays !== null && dueInDays <= 2 && !isDelivered;
    const isDelayed = dueInDays !== null && dueInDays < 0 && !isDelivered;

    return {
      item,
      order,
      customer,
      workflow,
      itemType,
      workflowInstance,
      currentStage,
      stage,
      activeWorker,
      completedStageCount,
      totalStageCount: itemStageInstances.length,
      dueInDays,
      isAtRisk,
      isDelayed,
      isDelivered
    };
  });

  const activeRows = productionRows.filter((row) => !row.isDelivered);
  const deliveredRows = productionRows.filter((row) => row.isDelivered);
  const rowsByOrderId = new Map<string, typeof productionRows>();

  productionRows.forEach((row) => {
    if (!row.order) {
      return;
    }

    rowsByOrderId.set(row.order.id, [...(rowsByOrderId.get(row.order.id) ?? []), row]);
  });

  const readyRows = activeRows.filter((row) => row.currentStage?.status === "ready_to_start");
  const inProgressRows = activeRows.filter((row) => row.currentStage?.status === "in_progress");
  const blockedRows = activeRows.filter((row) => row.currentStage?.status === "blocked" || row.item.item_status === "blocked");
  const uninitializedRows = activeRows.filter((row) => !row.workflowInstance);
  const dueSoonRows = activeRows.filter((row) => row.isAtRisk);
  const delayedRows = activeRows.filter((row) => row.isDelayed);
  const matchesQueueFilter = (row: (typeof productionRows)[number]) =>
    (queueFilter === "active" && !row.isDelivered) ||
    (queueFilter === "ready" && row.currentStage?.status === "ready_to_start") ||
    (queueFilter === "in_progress" && row.currentStage?.status === "in_progress") ||
    (queueFilter === "blocked" && (row.currentStage?.status === "blocked" || row.item.item_status === "blocked")) ||
    (queueFilter === "due_soon" && row.isAtRisk) ||
    (queueFilter === "delayed" && row.isDelayed) ||
    (queueFilter === "uninitialized" && !row.workflowInstance) ||
    (queueFilter === "delivered" && row.isDelivered);
  const orderDependencyRows = activeRows.filter((row) => {
    if (!row.order || !["completed", "ready_for_dispatch", "dispatched"].includes(row.item.item_status)) {
      return false;
    }

    return (rowsByOrderId.get(row.order.id) ?? []).some(
      (siblingRow) =>
        siblingRow.item.id !== row.item.id &&
        !["completed", "ready_for_dispatch", "dispatched", "delivered", "cancelled"].includes(siblingRow.item.item_status)
    );
  });
  const attentionRows = Array.from(
    new Map([...delayedRows, ...blockedRows, ...readyRows, ...orderDependencyRows].map((row) => [row.item.id, row])).values()
  );
  const searchLower = normalizeSearchText(search);
  const filteredRows = productionRows.filter((row) => {
    const matchesSearch = searchLower
      ? normalizeSearchText(
          `${row.item.name} ${row.item.description ?? ""} ${row.order?.order_number ?? ""} ${row.customer?.name ?? ""} ${
            row.workflow?.name ?? ""
          } ${row.stage?.name ?? ""}`
        ).includes(searchLower)
      : true;
    const matchesWorkflow = selectedWorkflowIds.length === 0 || selectedWorkflowSet.has(row.item.workflow_id);
    const matchesItemType = selectedItemTypeIds.length === 0 || selectedItemTypeSet.has(row.item.item_type_id);

    return matchesSearch && matchesQueueFilter(row) && matchesWorkflow && matchesItemType;
  });
  const queueOptions = [
    { value: "active", label: "Active workshop", count: activeRows.length, hint: "Excludes delivered" },
    { value: "ready", label: "Ready", count: readyRows.length },
    { value: "in_progress", label: "In progress", count: inProgressRows.length },
    { value: "blocked", label: "Blocked", count: blockedRows.length },
    { value: "due_soon", label: "Due soon", count: dueSoonRows.length },
    { value: "delayed", label: "Delayed", count: delayedRows.length },
    { value: "uninitialized", label: "Uninitialized", count: uninitializedRows.length },
    { value: "delivered", label: "Delivered", count: deliveredRows.length, hint: "Completed handoff" }
  ];
  const gridClassName = "grid gap-3 lg:grid-cols-[1.2fr_0.9fr_0.9fr_0.85fr_0.85fr_0.75fr_44px]";
  const addWorkflowParams = (params: URLSearchParams, workflowIds = selectedWorkflowIds) => {
    workflowIds.forEach((workflowId) => params.append("workflowId", workflowId));
  };
  const addItemTypeParams = (params: URLSearchParams, itemTypeIds = selectedItemTypeIds) => {
    itemTypeIds.forEach((itemTypeId) => params.append("itemTypeId", itemTypeId));
  };
  const queueHref = (queue: string) => {
    const params = new URLSearchParams();

    if (activeView !== "list") {
      params.set("view", activeView);
    }

    if (search) {
      params.set("q", search);
    }

    if (queue !== "active") {
      params.set("queue", queue);
    }

    if (selectedWorkflowIds.length) {
      addWorkflowParams(params);
    }

    if (selectedItemTypeIds.length) {
      addItemTypeParams(params);
    }

    const query = params.toString();
    return query ? `/production?${query}` : "/production";
  };
  const workflowPaneHref = (itemId: string) => {
    const params = new URLSearchParams();

    if (activeView !== "list") {
      params.set("view", activeView);
    }

    if (search) {
      params.set("q", search);
    }

    if (queueFilter !== "active") {
      params.set("queue", queueFilter);
    }

    if (selectedWorkflowIds.length) {
      addWorkflowParams(params);
    }

    if (selectedItemTypeIds.length) {
      addItemTypeParams(params);
    }

    params.set("workflowItemId", itemId);
    return `/production?${params.toString()}`;
  };
  const closePaneHref = queueHref(queueFilter);
  const viewHref = (view: "list" | "board") => {
    const params = new URLSearchParams();

    if (view === "board") {
      params.set("view", "board");
    }

    if (search) {
      params.set("q", search);
    }

    if (queueFilter !== "active") {
      params.set("queue", queueFilter);
    }

    if (selectedWorkflowIds.length) {
      addWorkflowParams(params);
    }

    if (selectedItemTypeIds.length) {
      addItemTypeParams(params);
    }

    const query = params.toString();
    return query ? `/production?${query}` : "/production";
  };
  const workflowHref = (workflowIds: string[]) => {
    const params = new URLSearchParams();

    if (activeView === "board") {
      params.set("view", "board");
    }

    if (search) {
      params.set("q", search);
    }

    if (queueFilter !== "active") {
      params.set("queue", queueFilter);
    }

    if (workflowIds.length) {
      addWorkflowParams(params, workflowIds);
    }
    if (selectedItemTypeIds.length) {
      addItemTypeParams(params);
    }

    return `/production?${params.toString()}`;
  };
  const itemTypeHref = (itemTypeIds: string[]) => {
    const params = new URLSearchParams();
    if (activeView === "board") params.set("view", "board");
    if (search) params.set("q", search);
    if (queueFilter !== "active") params.set("queue", queueFilter);
    if (selectedWorkflowIds.length) addWorkflowParams(params);
    if (itemTypeIds.length) addItemTypeParams(params, itemTypeIds);
    return `/production?${params.toString()}`;
  };
  const clearSearchHref = () => {
    const params = new URLSearchParams();

    if (activeView === "board") {
      params.set("view", "board");
    }

    if (queueFilter !== "active") {
      params.set("queue", queueFilter);
    }

    if (selectedWorkflowIds.length) {
      addWorkflowParams(params);
    }

    if (selectedItemTypeIds.length) {
      addItemTypeParams(params);
    }

    const query = params.toString();
    return query ? `/production?${query}` : "/production";
  };
  const selectedWorkflowLabel = selectedWorkflowIds.length
    ? selectedWorkflowIds.length === 1
      ? (workflowById.get(selectedWorkflowIds[0])?.name ?? "1 workflow")
      : `${selectedWorkflowIds.length} workflows`
    : "All workflows";
  const selectedItemTypeLabel = selectedItemTypeIds.length
    ? selectedItemTypeIds.length === 1
      ? (itemTypeById.get(selectedItemTypeIds[0])?.name ?? "1 garment type")
      : `${selectedItemTypeIds.length} garment types`
    : "All garment types";
  const workflowStageRows = selectedWorkflowIds.length === 0
    ? workflowStages
    : workflowStages.filter((stage) => selectedWorkflowSet.has(stage.workflow_id));
  const stageColumnSeed = Array.from(
    workflowStageRows.reduce((columns, workflowStage) => {
      const existing = columns.get(workflowStage.stage_master_id);

      if (!existing || workflowStage.sequence_number < existing.sequenceNumber) {
        columns.set(workflowStage.stage_master_id, {
          id: workflowStage.stage_master_id,
          title: stageById.get(workflowStage.stage_master_id)?.name ?? "Unknown stage",
          sequenceNumber: workflowStage.sequence_number
        });
      }

      return columns;
    }, new Map<string, { id: string; title: string; sequenceNumber: number }>())
  )
    .map(([, column]) => column)
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber || a.title.localeCompare(b.title));
  const showUninitializedColumn = queueFilter === "uninitialized" || productionRows.some((row) => !row.workflowInstance);
  const boardColumns = [
    ...(showUninitializedColumn ? [{ id: "uninitialized", title: "Uninitialized", sequenceNumber: -1 }] : []),
    ...stageColumnSeed,
    { id: "completed", title: "Completed", sequenceNumber: Number.MAX_SAFE_INTEGER }
  ];
  const boardRows = productionRows
    .filter((row) => {
      const matchesSearch = searchLower
        ? normalizeSearchText(
            `${row.item.name} ${row.item.description ?? ""} ${row.order?.order_number ?? ""} ${row.customer?.name ?? ""} ${
              row.workflow?.name ?? ""
            } ${row.stage?.name ?? ""}`
          ).includes(searchLower)
        : true;
      const matchesWorkflow = selectedWorkflowIds.length === 0 || selectedWorkflowSet.has(row.item.workflow_id);
      const matchesItemType = selectedItemTypeIds.length === 0 || selectedItemTypeSet.has(row.item.item_type_id);
      const isBoardVisibleState =
        row.isDelivered ||
        !row.workflowInstance ||
        ["ready_to_start", "in_progress", "blocked", "paused"].includes(row.currentStage?.status ?? "");

      return matchesSearch && matchesQueueFilter(row) && matchesWorkflow && matchesItemType && isBoardVisibleState;
    })
    .sort((a, b) => {
      if (a.isDelayed !== b.isDelayed) {
        return a.isDelayed ? -1 : 1;
      }

      if (a.dueInDays === null && b.dueInDays === null) {
        return a.item.name.localeCompare(b.item.name);
      }

      if (a.dueInDays === null) {
        return 1;
      }

      if (b.dueInDays === null) {
        return -1;
      }

      return a.dueInDays - b.dueInDays;
    });
  const rowsByBoardColumnId = new Map<string, typeof boardRows>();

  for (const row of boardRows) {
    const columnId = row.isDelivered ? "completed" : row.currentStage?.stage_master_id ?? "uninitialized";
    rowsByBoardColumnId.set(columnId, [...(rowsByBoardColumnId.get(columnId) ?? []), row]);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Production"
        description="Item-level workflow queue. Orders are commercial; these items are production units."
        actions={<Button asChild variant="outline"><Link href="/worker-contributions">Worker contributions</Link></Button>}
      />

      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        {queueOptions.map((option) => {
          const selected = queueFilter === option.value || (!resolvedSearchParams?.queue && option.value === "active");

          return (
            <Link
              key={option.value}
              href={queueHref(option.value)}
              className={`rounded-[14px] border bg-card p-4 text-card-foreground shadow-sm transition-colors hover:bg-muted/40 ${
                selected ? "border-primary ring-2 ring-primary/10" : ""
              }`}
            >
              <div className={`mb-3 h-1.5 w-10 rounded-full ${selected ? "bg-primary" : "bg-muted"}`} />
              <p className="text-xs font-medium text-muted-foreground">{option.label}</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{option.count}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {option.hint ??
                  (option.value === "ready"
                    ? "Waiting for worker"
                    : option.value === "in_progress"
                      ? "Currently worked"
                      : option.value === "blocked"
                        ? "Needs attention"
                        : option.value === "due_soon"
                          ? "Within 2 days"
                          : option.value === "delayed"
                            ? "Past expected date"
                            : "Needs setup")}
              </p>
            </Link>
          );
        })}
      </div>

      <ProductionFilterBar
        activeView={activeView}
        allItemTypesHref={itemTypeHref([])}
        allWorkflowsHref={workflowHref([])}
        boardHref={viewHref("board")}
        clearSearchHref={clearSearchHref()}
        listHref={viewHref("list")}
        queueFilter={queueFilter}
        resetHref={activeView === "board" ? "/production?view=board" : "/production"}
        search={search}
        itemTypes={itemTypes}
        selectedItemTypeIds={selectedItemTypeIds}
        selectedItemTypeLabel={selectedItemTypeLabel}
        selectedWorkflowIds={selectedWorkflowIds}
        selectedWorkflowLabel={selectedWorkflowLabel}
        workflows={workflows}
      />

      {activeView === "list" ? (
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Production queue</CardTitle>
            <CardDescription>Filtered items across workflow stages and risk states.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className={`${gridClassName} border-y px-4 py-3 text-xs font-medium uppercase text-muted-foreground`}>
              <span>Item</span>
              <span>Current step</span>
              <span>Progress</span>
              <span>Due</span>
              <span>Status</span>
              <span>Order</span>
              <span className="sr-only">Open</span>
            </div>
            <div className="divide-y">
              {filteredRows.map((row) => {
                const progress = row.totalStageCount ? Math.round((row.completedStageCount / row.totalStageCount) * 100) : 0;
                const riskStatus = row.isDelayed ? "delayed" : row.isAtRisk ? "at risk" : row.item.item_status;

                return (
                  <Link
                    key={row.item.id}
                    href={workflowPaneHref(row.item.id)}
                    className={`${gridClassName} px-4 py-4 text-sm transition-colors hover:bg-muted/40 lg:items-center`}
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate font-medium"><ItemTypeIcon emoji={row.itemType?.icon_emoji} kind={row.itemType?.icon_kind} name={row.itemType?.icon_name} color={row.itemType?.icon_color} />{row.item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.itemType?.name ?? "Unknown garment"} · {row.customer?.name ?? "Unknown customer"} · {row.workflow?.name ?? "Unknown workflow"}
                      </p>
                      <p className="sr-only">
                        {row.customer?.name ?? "Unknown customer"} · {row.workflow?.name ?? "Unknown workflow"}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{getCurrentStepLabel(row.stage?.name, row.isDelivered)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.currentStage?.status.replace("_", " ") ?? "No active step"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {row.completedStageCount}/{row.totalStageCount || 0} stages
                      </p>
                    </div>
                    <div>
                      <p className={row.isDelayed ? "font-medium text-destructive" : row.isAtRisk ? "font-medium text-amber-700" : "font-medium"}>
                        {getDueLabel(row.dueInDays)}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(row.item.expected_completion_date)}</p>
                    </div>
                    <StatusBadge value={riskStatus} />
                    <p className="text-muted-foreground">{row.order?.order_number ?? "Unknown"}</p>
                    <div className="hidden justify-end lg:flex">
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
            </div>
            {!filteredRows.length ? (
              <div className="p-8 text-center">
                <p className="font-medium">No production items found</p>
                <p className="mt-1 text-sm text-muted-foreground">Try changing the search or queue filter.</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Attention board</CardTitle>
              <CardDescription>Ready, blocked, delayed, or order-blocking items.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {attentionRows.slice(0, 8).map((row) => {
                const attentionStatus = row.isDelayed
                  ? "delayed"
                  : row.currentStage?.status === "blocked" || row.item.item_status === "blocked"
                    ? "blocked"
                    : row.currentStage?.status === "ready_to_start"
                      ? "ready_to_start"
                      : "order blocked";

                return (
                  <Link
                    key={`${row.item.id}-${attentionStatus}`}
                    href={workflowPaneHref(row.item.id)}
                    className="block rounded-md border p-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.item.name}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {row.order?.order_number ?? "Unknown order"} · {getCurrentStepLabel(row.stage?.name, row.isDelivered)}
                        </p>
                      </div>
                      <StatusBadge value={attentionStatus} />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {attentionStatus === "order blocked"
                        ? "Another item in this order is not ready yet"
                        : `${getDueLabel(row.dueInDays)} · ${formatDate(row.item.expected_completion_date)}`}
                    </p>
                  </Link>
                );
              })}
              {!attentionRows.length ? (
                <p className="text-sm text-muted-foreground">No urgent production items right now.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
      ) : (
        <div className="overflow-x-auto rounded-[14px] border bg-muted/20 p-3">
          <div className="flex min-w-max gap-3">
            {boardColumns.map((column) => {
              const columnRows = rowsByBoardColumnId.get(column.id) ?? [];
              const readyCount = columnRows.filter((row) => row.currentStage?.status === "ready_to_start").length;
              const inProgressCount = columnRows.filter((row) => row.currentStage?.status === "in_progress").length;
              const delayedCount = columnRows.filter((row) => row.isDelayed).length;

              return (
                <section key={column.id} className="flex max-h-[calc(100vh-260px)] w-[320px] flex-col rounded-[12px] border bg-background shadow-sm">
                  <div className="border-b p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-foreground" />
                          <h3 className="truncate text-sm font-semibold">{column.title}</h3>
                          <span className="text-sm text-muted-foreground">{columnRows.length}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Circle className="h-3 w-3" />
                            {readyCount} ready
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <PlayCircle className="h-3 w-3" />
                            {inProgressCount} active
                          </span>
                          {delayedCount ? (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <AlertCircle className="h-3 w-3" />
                              {delayedCount} late
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto p-3">
                    {columnRows.map((row) => {
                      const dueProgress = getDueProgress(row.dueInDays);
                      const status = row.isDelivered ? "completed" : row.currentStage?.status ?? row.item.item_status;

                      return (
                        <Link
                          key={row.item.id}
                          href={workflowPaneHref(row.item.id)}
                          className={`block rounded-[10px] border p-3 shadow-sm transition-colors hover:bg-muted/40 ${
                            row.isDelayed ? "border-destructive/40 bg-destructive/5" : "bg-card"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                {row.isDelayed ? <span className="h-2 w-2 rounded-full bg-destructive" aria-label="Delayed" /> : null}
                                <ItemTypeIcon emoji={row.itemType?.icon_emoji} kind={row.itemType?.icon_kind} name={row.itemType?.icon_name} color={row.itemType?.icon_color} />
                                <p className="line-clamp-2 text-sm font-semibold leading-snug">{row.item.name}</p>
                              </div>
                            </div>
                            <StatusBadge value={status} />
                          </div>
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center justify-between gap-3 text-xs">
                              <span className={row.isDelayed ? "font-medium text-destructive" : "text-muted-foreground"}>{getDueLabel(row.dueInDays)}</span>
                              <span className="text-muted-foreground">{row.dueInDays ?? "-"}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div className={`h-full rounded-full ${row.isDelayed ? "bg-destructive" : row.isAtRisk ? "bg-amber-500" : "bg-foreground"}`} style={{ width: `${dueProgress}%` }} />
                            </div>
                          </div>
                          <div className="mt-2 min-w-0 text-xs text-muted-foreground">
                            <p className="truncate">
                              {row.order?.order_number ?? "Unknown"} · {row.customer?.name ?? "Unknown customer"}
                            </p>
                            <div className="mt-1 flex min-w-0 items-center gap-3">
                              <span className="inline-flex min-w-0 items-center gap-1">
                                <UserRound className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{row.activeWorker?.name ?? "None"}</span>
                              </span>
                              <span className="inline-flex min-w-0 items-center gap-1">
                                <GitBranch className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{row.workflow?.name ?? "Unknown workflow"}</span>
                              </span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                    {!columnRows.length ? (
                      <div className="rounded-[10px] border border-dashed p-4 text-center text-sm text-muted-foreground">
                        No items
                      </div>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
      {selectedWorkflowData ? (
        <div className="fixed inset-0 z-50 flex justify-end p-4">
          <Link href={closePaneHref} aria-label="Close workflow pane" className="absolute inset-0 cursor-default bg-black/30" />
          <div className="relative z-10 h-full w-full max-w-5xl overflow-y-auto rounded-[14px] border bg-background p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold leading-tight">Workflow</h2>
                <p className="mt-1 text-sm text-muted-foreground">Actionable production workflow pane.</p>
              </div>
              <Button asChild type="button" variant="ghost" size="icon" aria-label="Close">
                <Link href={closePaneHref}>
                  <X className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <ItemWorkflowPanel {...selectedWorkflowData} variant="pane" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
