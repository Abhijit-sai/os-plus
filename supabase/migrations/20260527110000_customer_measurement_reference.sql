alter table customer_measurements
add column reference_name text;

create index customer_measurements_tenant_reference_idx
on customer_measurements(tenant_id, lower(reference_name))
where deleted_at is null and reference_name is not null;

comment on column customer_measurements.reference_name is
'Human-friendly label for identifying multiple measurement records for the same customer, such as Trial blouse May 2026 or Wedding sherwani.';
