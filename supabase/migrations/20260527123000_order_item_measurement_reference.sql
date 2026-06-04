alter table public.order_items
  add column if not exists customer_measurement_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_items_customer_measurement_id_fkey'
  ) then
    alter table public.order_items
      add constraint order_items_customer_measurement_id_fkey
      foreign key (customer_measurement_id)
      references public.customer_measurements(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_order_items_customer_measurement_id
  on public.order_items(customer_measurement_id)
  where deleted_at is null;
