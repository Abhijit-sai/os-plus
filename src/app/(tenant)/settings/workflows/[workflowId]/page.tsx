import Link from "next/link";
import { WorkflowSequenceFields } from "@/components/settings/workflow-sequence-fields";
import { notFound } from "next/navigation";

import { deleteWorkflowAction, replaceWorkflowStagesAction, updateWorkflowAction } from "@/features/workflows/actions";
import { getWorkflowDetailPageData } from "@/features/workflows/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AutoCloseActionDialog } from "@/components/ui/auto-close-action-dialog";
import { Input } from "@/components/ui/input";

export default async function WorkflowDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ workflowId: string }>;
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const [{ workflowId }, { onboarding }] = await Promise.all([params, searchParams]);
  const returnToOnboarding = typeof onboarding === "string" && /^[a-f0-9-]{36}$/i.test(onboarding);
  const { workflow, workflowStages, stages, customerStatuses, itemTypes } = await getWorkflowDetailPageData(workflowId);

  if (!workflow) {
    notFound();
  }

  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const statusById = new Map(customerStatuses.map((status) => [status.id, status]));

  return (
    <div className="space-y-6">
      {returnToOnboarding ? <Button asChild variant="outline"><Link href={`/onboarding?step=flows&garment=${onboarding}`}>Back to onboarding</Link></Button> : null}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{workflow.name}</h2>
          <p className="text-muted-foreground">{workflow.description ?? "Sequential item-level workflow"}</p>
        </div>
        <div className="flex items-center gap-2">
          <AutoCloseActionDialog action={updateWorkflowAction} title="Edit workflow" description="Existing item workflow instances keep their copied production history." successMessage="Workflow saved." trigger={<span className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent">Edit workflow</span>}>
              <input type="hidden" name="workflowId" value={workflow.id} />
              <div className="grid gap-2"><Label htmlFor="workflow-name">Name</Label><Input id="workflow-name" name="name" defaultValue={workflow.name} required /></div>
              <div className="grid gap-2"><Label htmlFor="workflow-description">Description</Label><Input id="workflow-description" name="description" defaultValue={workflow.description ?? ""} /></div>
              <div className="grid gap-2"><Label htmlFor="workflow-item-type">Item type</Label><select id="workflow-item-type" name="itemTypeId" defaultValue={workflow.item_type_id ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">General workflow</option>{itemTypes.map((itemType) => <option key={itemType.id} value={itemType.id}>{itemType.name}</option>)}</select></div>
              <label className="flex items-center gap-2 text-sm"><input name="isDefault" type="checkbox" defaultChecked={workflow.is_default} className="h-4 w-4" />Default for selected item type</label>
              <label className="flex items-center gap-2 text-sm"><input name="isActive" type="checkbox" defaultChecked={workflow.is_active} className="h-4 w-4" />Active</label>
              <Button type="submit">Save workflow</Button>
          </AutoCloseActionDialog>
          <form action={deleteWorkflowAction}><input type="hidden" name="workflowId" value={workflow.id} /><Button type="submit" variant="destructive">Delete workflow</Button></form>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Workflow stages</CardTitle>
          <CardDescription>MVP execution will follow this sequence from top to bottom.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {workflowStages.map((workflowStage) => {
            const stage = stageById.get(workflowStage.stage_master_id);
            const status = workflowStage.customer_status_id ? statusById.get(workflowStage.customer_status_id) : null;
            return (
              <div key={workflowStage.id} className="grid gap-3 rounded-md border p-4 md:grid-cols-[80px_1fr]">
                <div className="text-sm font-semibold text-muted-foreground">Step {workflowStage.sequence_number}</div>
                <div>
                  <p className="font-medium">{stage?.name ?? "Unknown stage"}</p>
                  <p className="text-sm text-muted-foreground">
                    {status ? `Customer sees: ${status.name}` : "No customer status mapped yet"}
                  </p>
                </div>
              </div>
            );
          })}
          {!workflowStages.length ? <p className="text-sm text-muted-foreground">No stages configured.</p> : null}
        </CardContent>
      </Card>
      <AutoCloseActionDialog action={replaceWorkflowStagesAction} title="Edit stage sequence" description="Drag stages or use the arrow buttons. Customer statuses move with their stages." className="max-w-3xl" trigger={<span className="inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium">Edit stage sequence</span>}>
            <input type="hidden" name="workflowId" value={workflow.id} />
            <WorkflowSequenceFields
              key={workflowStages.map((stage) => [stage.id, stage.stage_master_id, stage.customer_status_id].join(":")).join(",")}
              initialRows={workflowStages.map((stage) => ({ key: stage.id, stageId: stage.stage_master_id, customerStatusId: stage.customer_status_id ?? "" }))}
              stages={stages}
              statuses={customerStatuses}
            />
            <Button type="submit">Save sequence</Button>
          </AutoCloseActionDialog>
    </div>
  );
}
