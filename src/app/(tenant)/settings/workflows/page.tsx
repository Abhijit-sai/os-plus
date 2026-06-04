import Link from "next/link";

import { addStageWorkgroupAction, createWorkflowAction } from "@/features/workflows/actions";
import { getWorkflowConfigurationPageData } from "@/features/workflows/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function WorkflowsPage() {
  const { workflows, stages, itemTypes, workgroups, stageWorkgroups } = await getWorkflowConfigurationPageData();

  const workgroupNameById = new Map(workgroups.map((workgroup) => [workgroup.id, workgroup.name]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Workflows</h2>
        <p className="text-muted-foreground">
          Build sequential item-level workflows from internal stages. Workflow order is configured here, not in the stage master.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[460px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create workflow</CardTitle>
            <CardDescription>Choose one stage per step. Empty steps are ignored.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createWorkflowAction} className="space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="name">Workflow name</Label>
                <Input id="name" name="name" placeholder="Standard blouse production" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" placeholder="Optional" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="itemTypeId">Item type</Label>
                <select id="itemTypeId" name="itemTypeId" className="h-10 rounded-md border bg-background px-3 text-sm">
                  <option value="">No default item type</option>
                  {itemTypes.map((itemType) => (
                    <option key={itemType.id} value={itemType.id}>
                      {itemType.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input name="isDefault" type="checkbox" className="h-4 w-4" />
                Make default for selected item type
              </label>
              <div className="space-y-3">
                <p className="text-sm font-medium">Stage sequence</p>
                <div className="space-y-2 rounded-md border p-3">
                  {Array.from({ length: Math.max(stages.length, 1) }).map((_, index) => (
                    <div key={index} className="grid gap-2 md:grid-cols-[80px_1fr] md:items-center">
                      <Label htmlFor={`stage-${index + 1}`}>Step {index + 1}</Label>
                      <select
                        id={`stage-${index + 1}`}
                        name={`stageId_${index + 1}`}
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
                    </div>
                  ))}
                  {!stages.length ? <p className="text-sm text-muted-foreground">Add stages before creating workflows.</p> : null}
                </div>
              </div>
              <Button type="submit" disabled={!stages.length}>
                Create workflow
              </Button>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Existing workflows</CardTitle>
              <CardDescription>Tenant-owned workflow definitions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {workflows.map((workflow) => (
                <Link key={workflow.id} href={`/settings/workflows/${workflow.id}`} className="block rounded-md border p-3 hover:bg-accent">
                  <p className="font-medium">{workflow.name}</p>
                  <p className="text-sm text-muted-foreground">{workflow.description ?? "Sequential workflow"}</p>
                </Link>
              ))}
              {!workflows.length ? <p className="text-sm text-muted-foreground">No workflows yet.</p> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Stage workgroup mapping</CardTitle>
              <CardDescription>Allowed workgroups will restrict worker assignment when production starts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form action={addStageWorkgroupAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <select name="stageMasterId" className="h-10 rounded-md border bg-background px-3 text-sm" required>
                  <option value="">Stage</option>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
                <select name="workgroupId" className="h-10 rounded-md border bg-background px-3 text-sm" required>
                  <option value="">Workgroup</option>
                  {workgroups.map((workgroup) => (
                    <option key={workgroup.id} value={workgroup.id}>
                      {workgroup.name}
                    </option>
                  ))}
                </select>
                <Button type="submit">Map</Button>
              </form>
              <div className="space-y-2">
                {stages.map((stage) => {
                  const mapped = stageWorkgroups.filter((row) => row.stage_master_id === stage.id);
                  return (
                    <div key={stage.id} className="rounded-md border p-3">
                      <p className="font-medium">{stage.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {mapped.length
                          ? mapped.map((row) => workgroupNameById.get(row.workgroup_id) ?? "Unknown").join(", ")
                          : "No workgroups mapped yet"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
