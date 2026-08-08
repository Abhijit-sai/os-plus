import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { GstTreatment, Json, OrderLineType, TenantVerticalKey, WorkUnit, WorkUnitStageInstance } from "@/types/database";

export type CreatedWorkUnitRuntime = {
  orderLineId: string;
  workUnitId: string;
  workflowInstanceId: string;
};

export type CreateWorkUnitRuntimeInput = {
  tenantId: string;
  orderId: string;
  verticalKey: TenantVerticalKey;
  workflowId: string;
  displayCode: string;
  lineName: string;
  lineType?: OrderLineType;
  lineDescription?: string | null;
  quantity?: number;
  quantityUnit?: string;
  unitPrice?: number;
  discountAmount?: number;
  gstTreatment?: GstTreatment;
  gstRate?: number;
  currentLocationId?: string | null;
  verticalObjectType?: string | null;
  verticalObjectId?: string | null;
  actorId: string | null;
};

function parseCreatedWorkUnitRuntime(value: Json): CreatedWorkUnitRuntime {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Work Unit runtime creation returned an invalid result.");
  }

  const orderLineId = value.order_line_id;
  const workUnitId = value.work_unit_id;
  const workflowInstanceId = value.workflow_instance_id;

  if (typeof orderLineId !== "string" || typeof workUnitId !== "string" || typeof workflowInstanceId !== "string") {
    throw new Error("Work Unit runtime creation returned incomplete identifiers.");
  }

  return {
    orderLineId,
    workUnitId,
    workflowInstanceId
  };
}

export async function createWorkUnitRuntime(input: CreateWorkUnitRuntimeInput): Promise<CreatedWorkUnitRuntime> {
  const supabase = createSupabaseServiceRoleClient();

  const result = await supabase.rpc("create_work_unit_runtime", {
    p_tenant_id: input.tenantId,
    p_order_id: input.orderId,
    p_vertical_key: input.verticalKey,
    p_workflow_id: input.workflowId,
    p_display_code: input.displayCode,
    p_line_name: input.lineName,
    p_line_type: input.lineType ?? "service",
    p_line_description: input.lineDescription ?? null,
    p_quantity: input.quantity ?? 1,
    p_quantity_unit: input.quantityUnit ?? "unit",
    p_unit_price: input.unitPrice ?? 0,
    p_discount_amount: input.discountAmount ?? 0,
    p_gst_treatment: input.gstTreatment ?? "not_applicable",
    p_gst_rate: input.gstRate ?? 0,
    p_current_location_id: input.currentLocationId ?? null,
    p_vertical_object_type: input.verticalObjectType ?? null,
    p_vertical_object_id: input.verticalObjectId ?? null,
    p_actor: input.actorId
  });

  if (result.error) {
    throw new Error(`Unable to create Work Unit runtime: ${result.error.message}`);
  }

  return parseCreatedWorkUnitRuntime(result.data);
}

export async function initializeWorkUnitWorkflow(
  workUnit: Pick<WorkUnit, "id" | "tenant_id">,
  actorId: string | null
) {
  const supabase = createSupabaseServiceRoleClient();

  const result = await supabase.rpc("initialize_work_unit_workflow", {
    p_tenant_id: workUnit.tenant_id,
    p_work_unit_id: workUnit.id,
    p_actor: actorId
  });

  if (result.error) {
    throw new Error(`Unable to initialize Work Unit workflow: ${result.error.message}`);
  }

  return result.data;
}

export async function startWorkUnitStage(
  stage: Pick<WorkUnitStageInstance, "id" | "tenant_id">,
  input: {
    workerId: string;
    actorId: string | null;
    notes?: string | null;
  }
) {
  const supabase = createSupabaseServiceRoleClient();

  const result = await supabase.rpc("start_work_unit_stage", {
    p_tenant_id: stage.tenant_id,
    p_stage_instance_id: stage.id,
    p_worker_id: input.workerId,
    p_actor: input.actorId,
    p_notes: input.notes ?? null
  });

  if (result.error) {
    throw new Error(`Unable to start Work Unit stage: ${result.error.message}`);
  }

  return result.data;
}

export async function completeWorkUnitStage(
  stage: Pick<WorkUnitStageInstance, "id" | "tenant_id">,
  input: {
    actorId: string | null;
    notes?: string | null;
  }
) {
  const supabase = createSupabaseServiceRoleClient();

  const result = await supabase.rpc("complete_work_unit_stage", {
    p_tenant_id: stage.tenant_id,
    p_stage_instance_id: stage.id,
    p_actor: input.actorId,
    p_notes: input.notes ?? null
  });

  if (result.error) {
    throw new Error(`Unable to complete Work Unit stage: ${result.error.message}`);
  }

  return result.data;
}
