import type { CommunicationChannel, CommunicationTriggerType, Customer, Order, Tenant } from "@/types/database";

export const safeCommunicationVariables = [
  "store_name",
  "customer_name",
  "order_number",
  "promised_delivery_date",
  "order_status",
  "payment_status",
  "pending_balance",
  "tracking_link"
] as const;

export type CommunicationRenderContext = {
  tenant: Tenant;
  customer: Customer;
  order: Order;
  trackingUrl: string;
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    style: "currency",
    currency: "INR"
  }).format(amount);
}

export function getCommunicationVariables({ tenant, customer, order, trackingUrl }: CommunicationRenderContext) {
  return {
    store_name: tenant.store_name,
    customer_name: customer.name,
    order_number: order.order_number,
    promised_delivery_date: order.promised_delivery_date ?? "not set",
    order_status: order.order_status.replaceAll("_", " "),
    payment_status: order.payment_status.replaceAll("_", " "),
    pending_balance: formatMoney(Math.max(order.total_amount - order.amount_paid, 0)),
    tracking_link: trackingUrl
  };
}

export function renderTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => variables[key] ?? match);
}

export function getDefaultCommunicationTemplate({
  channel,
  triggerType
}: {
  channel: CommunicationChannel;
  triggerType: CommunicationTriggerType;
}) {
  if (triggerType === "manual_payment_reminder") {
    return {
      subject: "Payment reminder for {{order_number}}",
      bodyText:
        "Hi {{customer_name}}, this is a reminder from {{store_name}}. Your pending balance for order {{order_number}} is {{pending_balance}}. You can track the order here: {{tracking_link}}"
    };
  }

  return {
    subject: "Tracking link for {{order_number}}",
    bodyText:
      "Hi {{customer_name}}, your {{store_name}} order {{order_number}} is currently {{order_status}}. Track it here: {{tracking_link}}"
  };
}

export function getRecipientForChannel({
  channel,
  customer
}: {
  channel: CommunicationChannel;
  customer: Customer;
}) {
  if (channel === "whatsapp") {
    return {
      recipientPhone: customer.phone,
      recipientEmail: null
    };
  }

  return {
    recipientPhone: null,
    recipientEmail: customer.email
  };
}
