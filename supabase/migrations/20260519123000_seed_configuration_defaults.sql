insert into customer_statuses (
  tenant_id,
  name,
  sort_order,
  is_final_status,
  is_active,
  created_by,
  updated_by
)
select
  tenants.id,
  defaults.name,
  defaults.sort_order,
  defaults.is_final_status,
  true,
  'system',
  'system'
from tenants
cross join (
  values
    ('Order confirmed', 10, false),
    ('Design confirmation', 20, false),
    ('In production', 30, false),
    ('Finishing', 40, false),
    ('Quality check', 50, false),
    ('Packing', 60, false),
    ('Ready for pickup', 70, false),
    ('Ready for dispatch', 80, false),
    ('Dispatched', 90, false),
    ('Delivered', 100, true)
) as defaults(name, sort_order, is_final_status)
where not exists (
  select 1
  from customer_statuses existing
  where existing.tenant_id = tenants.id
    and lower(existing.name) = lower(defaults.name)
    and existing.deleted_at is null
);

insert into item_types (
  tenant_id,
  name,
  is_active,
  created_by,
  updated_by
)
select
  tenants.id,
  defaults.name,
  true,
  'system',
  'system'
from tenants
cross join (
  values
    ('Shirt'),
    ('Pant'),
    ('Kurtha'),
    ('Blazer')
) as defaults(name)
where not exists (
  select 1
  from item_types existing
  where existing.tenant_id = tenants.id
    and lower(existing.name) = lower(defaults.name)
    and existing.deleted_at is null
);

insert into stage_master (
  tenant_id,
  name,
  is_active,
  created_by,
  updated_by
)
select
  tenants.id,
  defaults.name,
  true,
  'system',
  'system'
from tenants
cross join (
  values
    ('Marking'),
    ('Cutting'),
    ('Design work'),
    ('Stitching'),
    ('Finishing'),
    ('QC'),
    ('Packing')
) as defaults(name)
where not exists (
  select 1
  from stage_master existing
  where existing.tenant_id = tenants.id
    and lower(existing.name) = lower(defaults.name)
    and existing.deleted_at is null
);

insert into workgroups (
  tenant_id,
  name,
  is_active,
  created_by,
  updated_by
)
select
  tenants.id,
  defaults.name,
  true,
  'system',
  'system'
from tenants
cross join (
  values
    ('Master'),
    ('Tailor'),
    ('Designer'),
    ('Finisher'),
    ('Packer'),
    ('QC')
) as defaults(name)
where not exists (
  select 1
  from workgroups existing
  where existing.tenant_id = tenants.id
    and lower(existing.name) = lower(defaults.name)
    and existing.deleted_at is null
);

insert into payment_modes (
  tenant_id,
  name,
  is_active,
  created_by,
  updated_by
)
select
  tenants.id,
  defaults.name,
  true,
  'system',
  'system'
from tenants
cross join (
  values
    ('Cash'),
    ('UPI'),
    ('Shopify'),
    ('Bank Transfer'),
    ('Card'),
    ('Other')
) as defaults(name)
where not exists (
  select 1
  from payment_modes existing
  where existing.tenant_id = tenants.id
    and lower(existing.name) = lower(defaults.name)
    and existing.deleted_at is null
);

insert into expense_categories (
  tenant_id,
  name,
  is_default,
  is_active,
  created_by,
  updated_by
)
select
  tenants.id,
  defaults.name,
  true,
  true,
  'system',
  'system'
from tenants
cross join (
  values
    ('Raw material'),
    ('Salary'),
    ('Marketing'),
    ('Rent'),
    ('Travel'),
    ('Utilities'),
    ('Packaging'),
    ('Courier'),
    ('Maintenance'),
    ('Miscellaneous')
) as defaults(name)
where not exists (
  select 1
  from expense_categories existing
  where existing.tenant_id = tenants.id
    and lower(existing.name) = lower(defaults.name)
    and existing.deleted_at is null
);
