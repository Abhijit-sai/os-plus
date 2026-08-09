import { notFound } from "next/navigation";

import { deleteWorkflowAction, replaceWorkflowStagesAction, updateWorkflowAction } from "@/features/workflows/actions";
import { getWorkflowDetailPageData } from "@/features/workflows/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AutoCloseActionDialog } from "@/components/ui/auto-close-action-dialog";
import { Input } from "@/components/ui/input";

export default async function WorkflowDetailPage({
  params
}: {
  params: Promise<{ workflowId: string }>;
}) {
  const { workflowId } = await params;
  const { workflow, workflowStages, stages, customerStatuses, itemTypes } = await getWorkflowDetailPageData(workflowId);

  if (!workflow) {
    notFound();
  }

  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const statusById = new Map(customerStatuses.map((status) => [status.id, status]));

  return (
    <div className="space-y-6">
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
      <Card>
        <CardHeader>
          <CardTitle>Replace sequence</CardTitle>
          <CardDescription>
            Use this to fix a workflow created in the wrong order. Empty steps are ignored.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={replaceWorkflowStagesAction} className="space-y-4" data-unsaved-guard="true">
            <input type="hidden" name="workflowId" value={workflow.id} />
            <div className="space-y-3">
              {Array.from({ length: Math.max(stages.length, workflowStages.length, 1) }).map((_, index) => {
                const existingStage = workflowStages[index];
                return (
                  <div key={index} className="grid gap-3 rounded-md border p-3 lg:grid-cols-[90px_1fr_1fr] lg:items-center">
                    <Label htmlFor={`edit-stage-${index + 1}`}>Step {index + 1}</Label>
                    <select
                      id={`edit-stage-${index + 1}`}
                      name={`stageId_${index + 1}`}
                      defaultValue={existingStage?.stage_master_id ?? ""}
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                      required={index === 0}
                    >
                      <option value="">Skip this step</option>
                      {stages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.name}
                        </option>
                      ))}
                    </select>
                    <select
                      name={`customerStatusId_${index + 1}`}
                      defaultValue={existingStage?.customer_status_id ?? ""}
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="">No customer status</option>
                      {customerStatuses.map((status) => (
                        <option key={status.id} value={status.id}>
                          {status.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
            <Button type="submit">Save sequence</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
