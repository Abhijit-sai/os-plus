import "server-only";

import { notFound } from "next/navigation";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import type {
  Customer,
  Order,
  OrderLine,
  StageMaster,
  TenantLocation,
  Workflow,
  WorkUnit,
  WorkUnitStageInstance,
  WorkUnitStageWorkLog,
  WorkUnitStatus,
  WorkUnitWorkflowInstance,
  Worker,
  Workgroup
} from "@/types/database";

function indexById<T extends { id: string }>(rows: T[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

function compactStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

async function loadLookupRows<T extends { id: string }>(
  tableName: Parameters<ReturnType<typeof createSupabaseServiceRoleClient>["from"]>[0],
  tenantId: string,
  ids: string[],
  select = "*"
) {
  if (!ids.length) {
    return [] as T[];
  }

  const supabase = createSupabaseServiceRoleClient();
  const result = await supabase
    .from(tableName)
    .select(select)
    .eq("tenant_id", tenantId)
    .in("id", ids)
    .is("deleted_at", null);

  if (result.error) {
    throw new Error(`Unable to load ${String(tableName)}: ${result.error.message}`);
  }

  return (result.data ?? []) as T[];
}

export type WorkUnitQueueItem = {
  workUnit: WorkUnit;
  order: Pick<Order, "id" | "order_number" | "customer_id" | "promised_delivery_date" | "runtime_model" | "vertical_key"> | null;
  orderLine: OrderLine | null;
  customer: Pick<Customer, "id" | "name" | "phone"> | null;
  workflow: Pick<Workflow, "id" | "name"> | null;
  currentWorkflowInstance: WorkUnitWorkflowInstance | null;
  currentStage: WorkUnitStageInstance | null;
  currentStageMaster: Pick<StageMaster, "id" | "name"> | null;
  currentLocation: Pick<TenantLocation, "id" | "name" | "code" | "location_type"> | null;
};

export async function getWorkUnitQueueData(options?: {
  statuses?: WorkUnitStatus[];
  includeProductionComplete?: boolean;
}) {
  const context = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();
  const statuses = options?.statuses;

  let workUnitQuery = supabase
    .from("work_units")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(100);

  if (statuses?.length) {
    workUnitQuery = workUnitQuery.in("status", statuses);
  } else if (!options?.includeProductionComplete) {
    workUnitQuery = workUnitQuery.neq("status", "production_complete");
  }

  const workUnits = await workUnitQuery;

  if (workUnits.error) {
    throw new Error(`Unable to load Work Units: ${workUnits.error.message}`);
  }

  const workUnitRows = workUnits.data ?? [];
  const orderIds = compactStrings(workUnitRows.map((workUnit) => workUnit.order_id));
  const orderLineIds = compactStrings(workUnitRows.map((workUnit) => workUnit.order_line_id));
  const workflowIds = compactStrings(workUnitRows.map((workUnit) => workUnit.workflow_id));
  const workflowInstanceIds = compactStrings(workUnitRows.map((workUnit) => workUnit.current_workflow_instance_id));
  const locationIds = compactStrings(workUnitRows.map((workUnit) => workUnit.current_location_id));

  const [orders, orderLines, workflows, workflowInstances, locations] = await Promise.all([
    loadLookupRows<Pick<Order, "id" | "order_number" | "customer_id" | "promised_delivery_date" | "runtime_model" | "vertical_key">>(
      "orders",
      context.tenant.id,
      orderIds,
      "id, order_number, customer_id, promised_delivery_date, runtime_model, vertical_key"
    ),
    loadLookupRows<OrderLine>("order_lines", context.tenant.id, orderLineIds),
    loadLookupRows<Pick<Workflow, "id" | "name">>("workflows", context.tenant.id, workflowIds, "id, name"),
    loadLookupRows<WorkUnitWorkflowInstance>("work_unit_workflow_instances", context.tenant.id, workflowInstanceIds),
    loadLookupRows<Pick<TenantLocation, "id" | "name" | "code" | "location_type">>(
      "tenant_locations",
      context.tenant.id,
      locationIds,
      "id, name, code, location_type"
    )
  ]);

  const currentStageIds = compactStrings(workflowInstances.map((instance) => instance.current_stage_instance_id));
  const customerIds = compactStrings(orders.map((order) => order.customer_id));
  const [currentStages, customers] = await Promise.all([
    loadLookupRows<WorkUnitStageInstance>("work_unit_stage_instances", context.tenant.id, currentStageIds),
    loadLookupRows<Pick<Customer, "id" | "name" | "phone">>("customers", context.tenant.id, customerIds, "id, name, phone")
  ]);

  const stageMasterIds = compactStrings(currentStages.map((stage) => stage.stage_master_id));
  const stageMasters = await loadLookupRows<Pick<StageMaster, "id" | "name">>(
    "stage_master",
    context.tenant.id,
    stageMasterIds,
    "id, name"
  );

  const ordersById = indexById(orders);
  const orderLinesById = indexById(orderLines);
  const workflowsById = indexById(workflows);
  const workflowInstancesById = indexById(workflowInstances);
  const currentStagesById = indexById(currentStages);
  const stageMastersById = indexById(stageMasters);
  const customersById = indexById(customers);
  const locationsById = indexById(locations);

  return {
    context,
    items: workUnitRows.map((workUnit): WorkUnitQueueItem => {
      const order = ordersById.get(workUnit.order_id) ?? null;
      const workflowInstance = workUnit.current_workflow_instance_id
        ? workflowInstancesById.get(workUnit.current_workflow_instance_id) ?? null
        : null;
      const currentStage = workflowInstance?.current_stage_instance_id
        ? currentStagesById.get(workflowInstance.current_stage_instance_id) ?? null
        : null;

      return {
        workUnit,
        order,
        orderLine: workUnit.order_line_id ? orderLinesById.get(workUnit.order_line_id) ?? null : null,
        customer: order ? customersById.get(order.customer_id) ?? null : null,
        workflow: workflowsById.get(workUnit.workflow_id) ?? null,
        currentWorkflowInstance: workflowInstance,
        currentStage,
        currentStageMaster: currentStage ? stageMastersById.get(currentStage.stage_master_id) ?? null : null,
        currentLocation: workUnit.current_location_id ? locationsById.get(workUnit.current_location_id) ?? null : null
      };
    })
  };
}

export async function getWorkUnitDetailData(workUnitId: string) {
  const context = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();

  const workUnit = await supabase
    .from("work_units")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .eq("id", workUnitId)
    .is("deleted_at", null)
    .maybeSingle();

  if (workUnit.error) {
    throw new Error(`Unable to load Work Unit: ${workUnit.error.message}`);
  }

  if (!workUnit.data) {
    notFound();
  }

  const [
    order,
    orderLine,
    workflow,
    currentWorkflowInstance,
    stageInstances,
    location,
    workLogs
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("id", workUnit.data.order_id)
      .is("deleted_at", null)
      .maybeSingle(),
    workUnit.data.order_line_id
      ? supabase
          .from("order_lines")
          .select("*")
          .eq("tenant_id", context.tenant.id)
          .eq("id", workUnit.data.order_line_id)
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("workflows")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("id", workUnit.data.workflow_id)
      .is("deleted_at", null)
      .maybeSingle(),
    workUnit.data.current_workflow_instance_id
      ? supabase
          .from("work_unit_workflow_instances")
          .select("*")
          .eq("tenant_id", context.tenant.id)
          .eq("id", workUnit.data.current_workflow_instance_id)
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("work_unit_stage_instances")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("work_unit_id", workUnit.data.id)
      .is("deleted_at", null)
      .order("sequence_number"),
    workUnit.data.current_location_id
      ? supabase
          .from("tenant_locations")
          .select("*")
          .eq("tenant_id", context.tenant.id)
          .eq("id", workUnit.data.current_location_id)
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("work_unit_stage_work_logs")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("work_unit_id", workUnit.data.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
  ]);

  for (const result of [order, orderLine, workflow, currentWorkflowInstance, stageInstances, location, workLogs]) {
    if (result.error) {
      throw new Error(`Unable to load Work Unit detail: ${result.error.message}`);
    }
  }

  const customer = order.data
    ? await supabase
        .from("customers")
        .select("*")
        .eq("tenant_id", context.tenant.id)
        .eq("id", order.data.customer_id)
        .is("deleted_at", null)
        .maybeSingle()
    : { data: null, error: null };

  if (customer.error) {
    throw new Error(`Unable to load Work Unit customer: ${customer.error.message}`);
  }

  const stageMasterIds = compactStrings((stageInstances.data ?? []).map((stage) => stage.stage_master_id));
  const workerIds = compactStrings((workLogs.data ?? []).map((log) => log.worker_id));
  const workgroupIds = compactStrings((workLogs.data ?? []).map((log) => log.workgroup_id));

  const [stageMasters, workers, workgroups] = await Promise.all([
    loadLookupRows<StageMaster>("stage_master", context.tenant.id, stageMasterIds),
    loadLookupRows<Worker>("workers", context.tenant.id, workerIds),
    loadLookupRows<Workgroup>("workgroups", context.tenant.id, workgroupIds)
  ]);

  return {
    context,
    workUnit: workUnit.data,
    order: order.data,
    orderLine: orderLine.data,
    customer: customer.data,
    workflow: workflow.data,
    currentWorkflowInstance: currentWorkflowInstance.data,
    stageInstances: stageInstances.data ?? [],
    stageMasters,
    currentLocation: location.data,
    workLogs: (workLogs.data ?? []) as WorkUnitStageWorkLog[],
    workers,
    workgroups
  };
}
