import { Button } from "@/components/ui/button";
import { SettingsCreateDialog } from "@/components/settings/settings-create-dialog";
import type { AutoCloseDialogAction } from "@/components/ui/auto-close-action-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TextMasterForm({
  title,
  description,
  action,
  namePlaceholder
}: {
  title: string;
  description: string;
  action: AutoCloseDialogAction;
  namePlaceholder: string;
}) {
  return (
    <SettingsCreateDialog title={title} description={description} action={action}>
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder={namePlaceholder} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" placeholder="Optional" />
          </div>
          <Button type="submit">Add</Button>
    </SettingsCreateDialog>
  );
}
