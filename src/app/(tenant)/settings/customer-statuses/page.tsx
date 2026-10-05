import { SettingsCreateDialog } from "@/components/settings/settings-create-dialog";
import { createCustomerStatusAction, updateCustomerStatusAction } from "@/features/settings/actions";
import { getCustomerStatuses } from "@/features/settings/queries";
import { SettingsList } from "@/components/settings/settings-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomerStatusEditDialog } from "@/components/settings/configuration-edit-dialogs";

export default async function CustomerStatusesPage() {
  const statuses = await getCustomerStatuses();

  return (
    <div className="space-y-5">
      <SettingsCreateDialog title="Add customer status" description="Only safe customer-facing labels should live here." action={createCustomerStatusAction}>
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="Ready for pickup" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" placeholder="Optional" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sortOrder">Sort order</Label>
              <Input id="sortOrder" name="sortOrder" type="number" min="0" defaultValue="0" required />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input name="isFinalStatus" type="checkbox" className="h-4 w-4" />
              Final status
            </label>
            <Button type="submit">Add customer status</Button>
          </SettingsCreateDialog>
      <SettingsList
        title="Customer statuses"
        description="Customer-safe status labels."
        items={statuses}
        renderMeta={(item) => `Sort ${item.sort_order}${item.is_final_status ? " · Final" : ""}`}
        renderActions={(item) => <CustomerStatusEditDialog action={updateCustomerStatusAction} item={item} />}
      />
    </div>
  );
}
