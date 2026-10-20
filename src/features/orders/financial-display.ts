// Source amounts on externally managed orders are NOT OS PLUS cash/receivables.
// Shared by operational renderers; finance still reads its local-only DB view.
export function localOrderReceivable(order: { source: string; total_amount: number; amount_paid: number }): number {
  return order.source === "shopify" ? 0 : Math.max(Number(order.total_amount) - Number(order.amount_paid), 0);
}
export function matchesLocalPayment(order: { source: string; payment_status: string }, filter: string): boolean {
  return filter === "all" || (order.source !== "shopify" && order.payment_status === filter);
}
