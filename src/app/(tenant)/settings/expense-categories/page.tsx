import { SettingsCreateDialog } from "@/components/settings/settings-create-dialog";
import { createExpenseCategoryAction, updateExpenseCategoryAction } from "@/features/settings/actions";
import { getExpenseCategories } from "@/features/settings/queries";
import { SettingsList } from "@/components/settings/settings-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExpenseCategoryEditDialog } from "@/components/settings/configuration-edit-dialogs";

export default async function ExpenseCategoriesPage() {
  const categories = await getExpenseCategories();

  return (
    <div className="space-y-5">
      <SettingsCreateDialog title="Add expense category" description="Operational finance buckets, not GST/accounting categories." action={createExpenseCategoryAction}>
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="Repairs" required />
            </div>
            <Button type="submit">Add expense category</Button>
          </SettingsCreateDialog>
      <SettingsList
        title="Expense categories"
        description="Tenant expense category master."
        items={categories}
        renderMeta={(item) => item.is_default ? "Default category" : "Custom category"}
        renderActions={(item) => <ExpenseCategoryEditDialog action={updateExpenseCategoryAction} item={item} />}
      />
    </div>
  );
}
