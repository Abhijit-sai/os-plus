alter table teams
drop constraint if exists teams_location_tenant_fkey;

alter table teams
add constraint teams_location_tenant_fkey
foreign key (tenant_id, location_id)
references tenant_locations(tenant_id, id)
on delete restrict;
