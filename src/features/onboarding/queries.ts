import "server-only";

import { requireBoutiqueOwner } from "@/features/onboarding/access";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

async function readWorkflowStages(
  db: ReturnType<typeof createSupabaseServiceRoleClient>,
  tenantId: string,
) {
  const stages: { workflow_id: string; stage_master_id: string }[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db
      .from("workflow_stages")
      .select("workflow_id,stage_master_id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sequence_number")
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error("Unable to load production stages. Try again.");
    stages.push(...data);
    if (data.length < pageSize) return stages;
  }
}

export async function getBoutiqueSetup() {
  const context = await requireBoutiqueOwner();
  const tenantId = context.tenant.id;
  const db = createSupabaseServiceRoleClient();
  const [
    setup,
    garments,
    groups,
    workers,
    workerGroups,
    stages,
    stageGroups,
    workflows,
    flowStages,
  ] = await Promise.all([
    db
      .from("boutique_onboarding")
      .select("profile,last_step")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    db
      .from("item_types")
      .select("id,name,default_workflow_id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name"),
    db
      .from("workgroups")
      .select("id,name")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name"),
    db
      .from("workers")
      .select("id,name")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("name"),
    db
      .from("worker_workgroups")
      .select("worker_id,workgroup_id")
      .eq("tenant_id", tenantId),
    db
      .from("stage_master")
      .select("id,name")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name"),
    db
      .from("stage_workgroups")
      .select("stage_master_id,workgroup_id")
      .eq("tenant_id", tenantId),
    db
      .from("workflows")
      .select("id,name,item_type_id,is_default")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name"),
    readWorkflowStages(db, tenantId),
  ]);
  for (const result of [
    setup,
    garments,
    groups,
    workers,
    workerGroups,
    stages,
    stageGroups,
    workflows,
  ]) {
    if (result.error)
      throw new Error("Unable to load boutique setup. Try again.");
  }

  const activeWorkers = new Set(
    (workers.data ?? []).map((worker) => worker.id),
  );
  const staffed = new Set(
    (workerGroups.data ?? [])
      .filter((entry) => activeWorkers.has(entry.worker_id))
      .map((entry) => entry.workgroup_id),
  );
  const groupById = new Map(
    (groups.data ?? []).map((group) => [group.id, group]),
  );
  const stageCatalog = (stages.data ?? []).map((stage) => ({
    ...stage,
    groups: (stageGroups.data ?? [])
      .filter((entry) => entry.stage_master_id === stage.id)
      .flatMap((entry) => groupById.get(entry.workgroup_id) ?? []),
  }));
  const stageById = new Map(stageCatalog.map((stage) => [stage.id, stage]));
  const flows = (workflows.data ?? []).map((flow) => {
    const stageIds = flowStages
      .filter((row) => row.workflow_id === flow.id)
      .map((row) => row.stage_master_id);
    const names = stageIds.map(
      (id) => stageById.get(id)?.name ?? "Unavailable stage",
    );
    let issue: { step: "flows" | "teams"; text: string } | null =
      stageIds.length
        ? null
        : { step: "flows", text: "Add a stage to this workflow." };
    for (const id of stageIds) {
      const stage = stageById.get(id);
      if (!stage || !stage.groups.length) {
        issue = {
          step: "flows",
          text: stage
            ? `Choose a workgroup for ${stage.name}.`
            : "Replace the unavailable stage in this workflow.",
        };
        break;
      }
      if (!stage.groups.some((group) => staffed.has(group.id))) {
        issue ??= {
          step: "teams",
          text: `Assign an active worker to ${stage.groups.map((group) => group.name).join(" or ")} for ${stage.name}.`,
        };
      }
    }
    return { ...flow, stageNames: names, issue };
  });

  const catalog = (garments.data ?? []).map((garment) => {
    const applicable = flows.filter(
      (flow) => flow.item_type_id === garment.id || flow.item_type_id === null,
    );
    const preferred = applicable.find(
      (flow) => flow.id === garment.default_workflow_id,
    );
    return {
      ...garment,
      workflows: applicable,
      ready:
        preferred && !preferred.issue
          ? preferred
          : applicable.find((flow) => !flow.issue),
      blocker: preferred?.issue ??
        applicable[0]?.issue ?? {
          step: "flows" as const,
          text: "Add a production workflow for this garment.",
        },
    };
  });

  return {
    tenantId,
    storeName: context.tenant.store_name,
    setup: setup.data,
    garments: catalog,
    groups: groups.data ?? [],
    workers: (workers.data ?? []).map((worker) => ({
      ...worker,
      groups: (workerGroups.data ?? [])
        .filter((entry) => entry.worker_id === worker.id)
        .flatMap((entry) => groupById.get(entry.workgroup_id) ?? []),
    })),
    stages: stageCatalog,
  };
}
