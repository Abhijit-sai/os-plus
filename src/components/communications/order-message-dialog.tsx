import { queueManualOrderMessageAction } from "@/features/communications/actions";
import {
  getCommunicationVariables,
  getDefaultCommunicationTemplate,
  getRecipientForChannel,
  renderTemplate
} from "@/features/communications/rendering";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { CommunicationChannel, CommunicationTriggerType, Customer, Order, Tenant } from "@/types/database";

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function OrderMessageDialog({
  channel,
  customer,
  order,
  tenant,
  trackingUrl,
  triggerType
}: {
  channel: CommunicationChannel;
  customer: Customer | null;
  order: Order;
  tenant: Tenant;
  trackingUrl: string;
  triggerType: Extract<CommunicationTriggerType, "manual_tracking_link" | "manual_payment_reminder">;
}) {
  if (!customer) {
    return null;
  }

  const recipient = getRecipientForChannel({ channel, customer });
  const template = getDefaultCommunicationTemplate({ channel, triggerType });
  const variables = getCommunicationVariables({ tenant, customer, order, trackingUrl });
  const subject = renderTemplate(template.subject, variables);
  const bodyText = renderTemplate(template.bodyText, variables);
  const recipientValue = channel === "whatsapp" ? recipient.recipientPhone : recipient.recipientEmail;
  const isContactMissing = !recipientValue;

  return (
    <Dialog
      title={`Queue ${formatLabel(triggerType)}`}
      description="This creates a dry-run message record only. It will not contact the customer yet."
      trigger={
        <span className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent">
          {channel === "whatsapp" ? "WhatsApp" : "Email"}
        </span>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md border bg-muted/20 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{customer.name}</p>
            <Badge variant={isContactMissing ? "warning" : "neutral"}>{channel}</Badge>
          </div>
          <p className="mt-1 text-muted-foreground">
            {recipientValue ?? `No ${channel === "whatsapp" ? "phone number" : "email address"} saved`}
          </p>
        </div>

        <div className="rounded-md border p-3 text-sm">
          {channel === "email" ? (
            <>
              <p className="text-xs font-medium text-muted-foreground">Subject</p>
              <p className="mt-1 font-medium">{subject}</p>
            </>
          ) : null}
          <p className="mt-3 text-xs font-medium text-muted-foreground">Preview</p>
          <p className="mt-1 whitespace-pre-wrap">{bodyText}</p>
        </div>

        <form action={queueManualOrderMessageAction}>
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="channel" value={channel} />
          <input type="hidden" name="triggerType" value={triggerType} />
          <Button type="submit" disabled={isContactMissing}>
            Queue dry-run message
          </Button>
        </form>
      </div>
    </Dialog>
  );
}
