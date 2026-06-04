import { createPaymentModeAction } from "@/features/settings/actions";
import { getPaymentModes } from "@/features/settings/queries";
import { SettingsList } from "@/components/settings/settings-list";
import { TextMasterForm } from "@/components/settings/text-master-form";

export default async function PaymentModesPage() {
  const paymentModes = await getPaymentModes();

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <TextMasterForm
        title="Add payment mode"
        description="Payment modes are used later for order payments and expenses."
        action={createPaymentModeAction}
        namePlaceholder="Cheque"
      />
      <SettingsList
        title="Payment modes"
        description="Tenant payment mode master."
        items={paymentModes}
        renderMeta={(item) => item.description ?? "Payment mode"}
      />
    </div>
  );
}
