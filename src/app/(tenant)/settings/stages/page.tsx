import { createStageAction, updateStageAction } from "@/features/settings/actions";
import { getStages } from "@/features/settings/queries";
import { SettingsList } from "@/components/settings/settings-list";
import { StageEditDialog } from "@/components/settings/configuration-edit-dialogs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function StagesPage() {
  const stages = await getStages();

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Add stage</CardTitle>
          <CardDescription>Internal stages own their effort-tracking method; customer-facing statuses remain separate.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createStageAction} className="space-y-4" data-unsaved-guard="true">
            <div className="grid gap-2"><Label htmlFor="stage-name">Name</Label><Input id="stage-name" name="name" placeholder="Embroidery" required /></div>
            <div className="grid gap-2"><Label htmlFor="stage-description">Description</Label><Input id="stage-description" name="description" placeholder="Optional" /></div>
            <div className="grid gap-2">
              <Label htmlFor="stage-effort-mode">Effort tracking</Label>
              <select id="stage-effort-mode" name="effortTrackingMode" defaultValue="none" className="h-10 rounded-md border bg-background px-3 text-sm">
                <option value="none">Worker assignment only</option>
                <option value="units">Credited units</option>
                <option value="hours">Credited time</option>
                <option value="hybrid">Units and credited time</option>
              </select>
            </div>
            <Button type="submit">Add stage</Button>
          </form>
        </CardContent>
      </Card>
      <SettingsList
        title="Stages"
        description="Internal production stage master."
        items={stages}
        renderMeta={(item) => `${item.description ?? "Internal stage"} · ${item.effort_tracking_mode === "none" ? "Assignment only" : item.effort_tracking_mode === "units" ? "Units" : item.effort_tracking_mode === "hours" ? "Time" : "Units + time"}`}
        renderActions={(item) => <StageEditDialog action={updateStageAction} item={item} />}
      />
    </div>
  );
}
