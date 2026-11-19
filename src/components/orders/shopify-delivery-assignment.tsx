"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { assignShopifyOrderDelivery } from "@/features/orders/shopify-setup-actions";

export function ShopifyDeliveryAssignment({orderId}:{orderId:string}) {
  const id=useId();
  const [message,action,pending]=useActionState(assignShopifyOrderDelivery.bind(null,orderId),"");

  return <form action={action} className="mt-2 space-y-2">
    <label htmlFor={id} className="sr-only">Delivery method</label>
    <select id={id} name="deliveryType" defaultValue="" required disabled={pending}
      className="min-h-11 w-full rounded-md border border-amber-500 bg-background px-3 py-2 text-sm">
      <option value="" disabled>Not assigned</option>
      <option value="store_pickup">Store pickup</option>
      <option value="self_delivery">Self delivery</option>
      <option value="courier">Courier</option>
    </select>
    <Button type="submit" size="sm" variant="outline" disabled={pending}>{pending?"Assigning delivery":"Assign delivery"}</Button>
    {message&&<p role="status">{message}</p>}
  </form>;
}
