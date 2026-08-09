import Link from "next/link";

import { createItemTypeAction, updateItemTypeAction } from "@/features/settings/actions";
import { getItemTypes } from "@/features/settings/queries";
import { ItemTypeIcon } from "@/components/item-types/item-type-icon";
import { SettingsList } from "@/components/settings/settings-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ItemTypeEditDialog } from "@/components/settings/configuration-edit-dialogs";
import { buttonVariants } from "@/components/ui/button-variants";

export default async function ItemTypesPage() {
  const itemTypes = await getItemTypes();

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Add item type</CardTitle>
          <CardDescription>Item types are tenant-owned and later map to default workflows.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createItemTypeAction} className="space-y-4" data-unsaved-guard="true">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="Sherwani" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" placeholder="Optional" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="iconEmoji">Icon emoji</Label>
              <Input id="iconEmoji" name="iconEmoji" placeholder="Optional, for example 👔" maxLength={16} />
              <p className="text-xs text-muted-foreground">One emoji used on internal order and production screens.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="defaultSlaDays">Default SLA days</Label>
              <Input id="defaultSlaDays" name="defaultSlaDays" type="number" min="0" placeholder="Optional" />
            </div>
            <Button type="submit">Add item type</Button>
          </form>
        </CardContent>
      </Card>
      <SettingsList
        title="Item types"
        description="Current tenant item type master."
        items={itemTypes}
        renderMeta={(item) => <span className="flex items-center gap-2"><ItemTypeIcon emoji={item.icon_emoji} />{item.default_sla_days ? `${item.default_sla_days} day SLA` : item.description ?? "No SLA"}</span>}
        renderActions={(item) => (
          <div className="flex flex-wrap items-center gap-2">
            <Link className={buttonVariants({ size: "sm", variant: "outline" })} href={`/settings/item-types/${item.id}/contributions`}>
              Contribution rules
            </Link>
            <ItemTypeEditDialog action={updateItemTypeAction} item={item} />
          </div>
        )}
      />
    </div>
  );
}
