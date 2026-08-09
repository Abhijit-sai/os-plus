import { Button } from "@/components/ui/button";
import { AutoCloseActionDialog } from "@/components/ui/auto-close-action-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CustomerStatus, ExpenseCategory, ItemType, PaymentMode, StageMaster, Workgroup } from "@/types/database";

type FormAction = (formData: FormData) => void | Promise<void>;
type TextRecord = StageMaster | Workgroup | PaymentMode;

function EditTrigger() {
  return <span className="inline-flex h-8 items-center rounded-md border px-2 text-xs font-medium hover:bg-accent">Edit</span>;
}

export function TextMasterEditDialog({ action, idField, item, title }: { action: FormAction; idField: string; item: TextRecord; title: string }) {
  return (
    <Dialog title={`Edit ${title}`} description="Existing history keeps this record ID; only its current configuration changes." trigger={<EditTrigger />}>
      <form action={action} className="space-y-4" data-unsaved-guard="true">
        <input type="hidden" name={idField} value={item.id} />
        <div className="grid gap-2">
          <Label htmlFor={`${idField}-name-${item.id}`}>Name</Label>
          <Input id={`${idField}-name-${item.id}`} name="name" defaultValue={item.name} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idField}-description-${item.id}`}>Description</Label>
          <Input id={`${idField}-description-${item.id}`} name="description" defaultValue={item.description ?? ""} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="isActive" type="checkbox" defaultChecked={item.is_active} className="h-4 w-4" />
          Active
        </label>
        <Button type="submit">Save changes</Button>
      </form>
    </Dialog>
  );
}

export function StageEditDialog({ action, item }: { action: FormAction; item: StageMaster }) {
  return (
    <AutoCloseActionDialog action={action} title="Edit stage" description="Newly started stages use this effort mode; active and completed stages keep their saved snapshot." successMessage="Stage saved." trigger={<EditTrigger />}>
        <input type="hidden" name="stageId" value={item.id} />
        <div className="grid gap-2">
          <Label htmlFor={`stage-name-${item.id}`}>Name</Label>
          <Input id={`stage-name-${item.id}`} name="name" defaultValue={item.name} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`stage-description-${item.id}`}>Description</Label>
          <Input id={`stage-description-${item.id}`} name="description" defaultValue={item.description ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`stage-effort-${item.id}`}>Effort tracking</Label>
          <select id={`stage-effort-${item.id}`} name="effortTrackingMode" defaultValue={item.effort_tracking_mode} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="none">Worker assignment only</option>
            <option value="units">Credited units</option>
            <option value="hours">Credited time</option>
            <option value="hybrid">Units and credited time</option>
          </select>
          <p className="text-xs text-muted-foreground">Credited time is manual man-hours, separate from elapsed stage time.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="isActive" type="checkbox" defaultChecked={item.is_active} className="h-4 w-4" />
          Active
        </label>
        <Button type="submit">Save stage</Button>
    </AutoCloseActionDialog>
  );
}

export function ItemTypeEditDialog({ action, item }: { action: FormAction; item: ItemType }) {
  return (
    <Dialog title="Edit item type" description="Existing orders keep their item-type reference." trigger={<EditTrigger />}>
      <form action={action} className="space-y-4" data-unsaved-guard="true">
        <input type="hidden" name="itemTypeId" value={item.id} />
        <div className="grid gap-2"><Label htmlFor={`item-name-${item.id}`}>Name</Label><Input id={`item-name-${item.id}`} name="name" defaultValue={item.name} required /></div>
        <div className="grid gap-2"><Label htmlFor={`item-description-${item.id}`}>Description</Label><Input id={`item-description-${item.id}`} name="description" defaultValue={item.description ?? ""} /></div>
        <div className="grid gap-2"><Label htmlFor={`item-emoji-${item.id}`}>Icon emoji</Label><Input id={`item-emoji-${item.id}`} name="iconEmoji" defaultValue={item.icon_emoji ?? ""} maxLength={16} placeholder="Optional, for example 👔" /></div>
        <div className="grid gap-2"><Label htmlFor={`item-sla-${item.id}`}>Default SLA days</Label><Input id={`item-sla-${item.id}`} name="defaultSlaDays" type="number" min="0" defaultValue={item.default_sla_days ?? ""} /></div>
        <label className="flex items-center gap-2 text-sm"><input name="isActive" type="checkbox" defaultChecked={item.is_active} className="h-4 w-4" />Active</label>
        <Button type="submit">Save item type</Button>
      </form>
    </Dialog>
  );
}

export function CustomerStatusEditDialog({ action, item }: { action: FormAction; item: CustomerStatus }) {
  return (
    <Dialog title="Edit customer status" description="Keep this label customer-safe; internal stages remain separate." trigger={<EditTrigger />}>
      <form action={action} className="space-y-4" data-unsaved-guard="true">
        <input type="hidden" name="customerStatusId" value={item.id} />
        <div className="grid gap-2"><Label htmlFor={`status-name-${item.id}`}>Name</Label><Input id={`status-name-${item.id}`} name="name" defaultValue={item.name} required /></div>
        <div className="grid gap-2"><Label htmlFor={`status-description-${item.id}`}>Description</Label><Input id={`status-description-${item.id}`} name="description" defaultValue={item.description ?? ""} /></div>
        <div className="grid gap-2"><Label htmlFor={`status-sort-${item.id}`}>Sort order</Label><Input id={`status-sort-${item.id}`} name="sortOrder" type="number" min="0" defaultValue={item.sort_order} required /></div>
        <label className="flex items-center gap-2 text-sm"><input name="isFinalStatus" type="checkbox" defaultChecked={item.is_final_status} className="h-4 w-4" />Final status</label>
        <label className="flex items-center gap-2 text-sm"><input name="isActive" type="checkbox" defaultChecked={item.is_active} className="h-4 w-4" />Active</label>
        <Button type="submit">Save customer status</Button>
      </form>
    </Dialog>
  );
}

export function ExpenseCategoryEditDialog({ action, item }: { action: FormAction; item: ExpenseCategory }) {
  return (
    <Dialog title="Edit expense category" description="Existing expenses keep their category reference." trigger={<EditTrigger />}>
      <form action={action} className="space-y-4" data-unsaved-guard="true">
        <input type="hidden" name="expenseCategoryId" value={item.id} />
        <div className="grid gap-2"><Label htmlFor={`expense-category-${item.id}`}>Name</Label><Input id={`expense-category-${item.id}`} name="name" defaultValue={item.name} required /></div>
        <label className="flex items-center gap-2 text-sm"><input name="isActive" type="checkbox" defaultChecked={item.is_active} className="h-4 w-4" />Active</label>
        <Button type="submit">Save expense category</Button>
      </form>
    </Dialog>
  );
}
