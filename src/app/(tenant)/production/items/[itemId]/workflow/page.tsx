import Link from "next/link";

import { getProductionItemPageData } from "@/features/production/queries";
import { ItemWorkflowPanel } from "@/components/production/item-workflow-panel";
import { Button } from "@/components/ui/button";

export default async function ProductionItemWorkflowPage({
  params
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const data = await getProductionItemPageData(itemId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Production workflow</h2>
          <p className="text-muted-foreground">Actionable stage movement, corrections, and workflow history.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.order ? (
            <Button asChild variant="outline">
              <Link href={`/orders/${data.order.id}`}>Back to order</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/production">Back to production</Link>
          </Button>
        </div>
      </div>
      <ItemWorkflowPanel {...data} variant="page" />
    </div>
  );
}
