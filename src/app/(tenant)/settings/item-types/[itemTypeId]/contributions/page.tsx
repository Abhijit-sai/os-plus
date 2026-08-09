import Link from "next/link";

import { buttonVariants } from "@/components/ui/button-variants";
import { ContributionRuleList } from "@/components/settings/contribution-rule-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateItemTypeStageContributionRuleAction } from "@/features/settings/actions";
import { getItemTypeContributionSettings } from "@/features/settings/queries";

export default async function ItemTypeContributionsPage({ params }: { params: Promise<{ itemTypeId: string }> }) {
  const { itemTypeId } = await params;
  const { itemType, rules, stages } = await getItemTypeContributionSettings(itemTypeId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm text-muted-foreground">Item types / {itemType.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Contribution rules</h1>
          <p className="mt-2 max-w-[70ch] text-sm text-muted-foreground">Optional analytics values by stage. These amounts never change salary, order totals, GST, payments, or finance.</p>
        </div>
        <Link className={buttonVariants({ variant: "outline" })} href="/settings/item-types">Back to item types</Link>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        New values apply only when a stage starts. Active and completed stages keep their saved rate and item-value snapshot.
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{itemType.name} stages</CardTitle>
          <CardDescription>Choose a compatible rule or leave the stage unpriced. Production never stops because a rate is missing.</CardDescription>
        </CardHeader>
        <CardContent>
          <ContributionRuleList action={updateItemTypeStageContributionRuleAction} itemType={itemType} rules={rules} stages={stages} />
        </CardContent>
      </Card>
    </div>
  );
}
