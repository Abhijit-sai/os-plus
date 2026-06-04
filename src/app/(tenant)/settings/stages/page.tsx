import { createStageAction } from "@/features/settings/actions";
import { getStages } from "@/features/settings/queries";
import { SettingsList } from "@/components/settings/settings-list";
import { TextMasterForm } from "@/components/settings/text-master-form";

export default async function StagesPage() {
  const stages = await getStages();

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <TextMasterForm
        title="Add stage"
        description="Internal production stages stay separate from customer-facing statuses."
        action={createStageAction}
        namePlaceholder="Embroidery"
      />
      <SettingsList
        title="Stages"
        description="Internal production stage master."
        items={stages}
        renderMeta={(item) => item.description ?? "Internal stage"}
      />
    </div>
  );
}
