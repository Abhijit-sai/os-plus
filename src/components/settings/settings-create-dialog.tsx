import { Plus } from "lucide-react";
import { AutoCloseActionDialog, type AutoCloseDialogAction } from "@/components/ui/auto-close-action-dialog";
import { buttonVariants } from "@/components/ui/button-variants";

export function SettingsCreateDialog({ title, description, action, children }: {
  title: string;
  description?: string;
  action: AutoCloseDialogAction;
  children: React.ReactNode;
}) {
  return <div className="flex justify-end">
    <AutoCloseActionDialog action={action} title={title} description={description}
      className="max-w-xl" successMessage={`${title.replace(/^(Add|Create) /, "")} saved.`}
      trigger={<span className={buttonVariants({ className: "gap-2" })}><Plus className="h-4 w-4" />{title}</span>}>
      {children}
    </AutoCloseActionDialog>
  </div>;
}
