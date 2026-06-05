alter table public.orders
add column if not exists gst_treatment gst_treatment not null default 'not_applicable',
add column if not exists gst_rate numeric(5, 2) not null default 0,
add column if not exists taxable_amount numeric(12, 2) not null default 0,
add column if not exists gst_amount numeric(12, 2) not null default 0;

alter table public.orders
drop constraint if exists orders_gst_amounts_non_negative;

alter table public.orders
add constraint orders_gst_amounts_non_negative check (
  gst_rate >= 0
  and gst_rate <= 100
  and taxable_amount >= 0
  and gst_amount >= 0
);

create index if not exists orders_tenant_gst_treatment_idx
on public.orders(tenant_id, gst_treatment)
where deleted_at is null;

comment on column public.orders.gst_treatment is 'Order-level GST treatment selected at order creation for accountant-handoff reports.';
comment on column public.orders.gst_rate is 'Order-level GST rate percentage used for calculated GST amount.';
comment on column public.orders.taxable_amount is 'Calculated taxable base for this order after discounts, based on GST treatment.';
comment on column public.orders.gst_amount is 'Calculated output GST collected on this order.';
