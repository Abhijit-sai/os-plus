import { createExpenseCategoryAction, updateExpenseCategoryAction } from "@/features/settings/actions";
import { getExpenseCategories } from "@/features/settings/queries";
import { SettingsList } from "@/components/settings/settings-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExpenseCategoryEditDialog } from "@/components/settings/configuration-edit-dialogs";

export default async function ExpenseCategoriesPage() {
  const categories = await getExpenseCategories();

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Add expense category</CardTitle>
          <CardDescription>Operational finance buckets, not GST/accounting categories.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createExpenseCategoryAction} className="space-y-4" data-unsaved-guard="true">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="Repairs" required />
            </div>
            <Button type="submit">Add expense category</Button>
          </form>
        </CardContent>
      </Card>
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
