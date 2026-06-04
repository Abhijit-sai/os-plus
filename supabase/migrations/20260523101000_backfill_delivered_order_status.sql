update orders
set
  order_status = 'delivered',
  updated_at = now()
where
  deleted_at is null
  and order_status <> 'cancelled'
  and exists (
    select 1
    from order_items
    where order_items.tenant_id = orders.tenant_id
      and order_items.order_id = orders.id
      and order_items.deleted_at is null
  )
  and not exists (
    select 1
    from order_items
    where order_items.tenant_id = orders.tenant_id
      and order_items.order_id = orders.id
      and order_items.deleted_at is null
      and order_items.item_status <> 'delivered'
  );
