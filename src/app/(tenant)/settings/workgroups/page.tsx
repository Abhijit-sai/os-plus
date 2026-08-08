import { createWorkgroupAction, updateWorkgroupAction } from "@/features/settings/actions";
import { getWorkgroups } from "@/features/settings/queries";
import { SettingsList } from "@/components/settings/settings-list";
import { TextMasterForm } from "@/components/settings/text-master-form";
import { TextMasterEditDialog } from "@/components/settings/configuration-edit-dialogs";

export default async function WorkgroupsPage() {
  const workgroups = await getWorkgroups();

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <TextMasterForm
        title="Add workgroup"
        description="Workgroups define which workers can be assigned to future workflow stages."
        action={createWorkgroupAction}
        namePlaceholder="Alteration specialist"
      />
      <SettingsList
        title="Workgroups"
        description="Worker capability groups."
        items={workgroups}
        renderMeta={(item) => item.description ?? "Worker group"}
        renderActions={(item) => <TextMasterEditDialog action={updateWorkgroupAction} idField="workgroupId" item={item} title="workgroup" />}
      />
    </div>
  );
}
