import "server-only";

import { assertTenantVertical } from "@/features/verticals/queries";
import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import type {
  Customer,
  CustomerAddress,
  LaundryContainerAsset,
  LaundryCustodyEvent,
  LaundryHandlingUnit,
  LaundryPickupRequest,
  LaundryServiceCatalog,
  LaundryServiceLot,
  Order,
  Team,
  TenantLocation,
  TenantUser,
  Workflow
} from "@/types/database";

function indexById<T extends { id: string }>(rows: T[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

function compactStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export type LaundryPickupQueueItem = {
  pickup: LaundryPickupRequest;
  customer: Pick<Customer, "id" | "name" | "phone"> | null;
  address: Pick<CustomerAddress, "id" | "label" | "address_line_1" | "area" | "city"> | null;
  assignedUser: Pick<TenantUser, "id" | "display_name" | "email" | "role"> | null;
  assignedTeam: Pick<Team, "id" | "name" | "code"> | null;
  handlingUnits: LaundryHandlingUnit[];
};

export type LaundryHandlingUnitItem = {
  handlingUnit: LaundryHandlingUnit;
  customer: Pick<Customer, "id" | "name" | "phone"> | null;
  currentLocation: Pick<TenantLocation, "id" | "name" | "code" | "location_type"> | null;
  containerAsset: Pick<LaundryContainerAsset, "id" | "container_code" | "container_type" | "status"> | null;
  serviceLots: LaundryServiceLot[];
  custodyEvents: LaundryCustodyEvent[];
};

export async function getLaundryCustodyData() {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "laundry:view");
  await assertTenantVertical(context, "laundry");

  const supabase = createSupabaseServiceRoleClient();
  const [
    pickups,
    handlingUnits,
    containerAssets,
    serviceCatalog,
    customers,
    assignableUsers,
    assignableTeams,
    locations,
    laundryOrders,
    workflows
  ] = await Promise.all([
    supabase
      .from("laundry_pickup_requests")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("requested_date", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("laundry_handling_units")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("laundry_container_assets")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("container_code", { ascending: true })
      .limit(100),
    supabase
      .from("laundry_service_catalog")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("customers")
      .select("id, name, phone")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .limit(200),
    supabase
      .from("tenant_users")
      .select("id, display_name, email, role")
      .eq("tenant_id", context.tenant.id)
      .eq("status", "active")
      .order("display_name", { ascending: true }),
    supabase
      .from("teams")
      .select("id, name, code")
      .eq("tenant_id", context.tenant.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("tenant_locations")
      .select("id, name, code, location_type")
      .eq("tenant_id", context.tenant.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("orders")
      .select("id, order_number, customer_id, order_date, promised_delivery_date, runtime_model, vertical_key")
      .eq("tenant_id", context.tenant.id)
      .eq("vertical_key", "laundry")
      .eq("runtime_model", "work_unit_v2")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("workflows")
      .select("id, name, description, item_type_id, is_default, is_active")
      .eq("tenant_id", context.tenant.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .limit(100)
  ]);

  for (const result of [
    pickups,
    handlingUnits,
    containerAssets,
    serviceCatalog,
    customers,
    assignableUsers,
    assignableTeams,
    locations,
    laundryOrders,
    workflows
  ]) {
    if (result.error) {
      throw new Error(`Unable to load Laundry custody data: ${result.error.message}`);
    }
  }

  const pickupRows = (pickups.data ?? []) as LaundryPickupRequest[];
  const handlingRows = (handlingUnits.data ?? []) as LaundryHandlingUnit[];
  const customerRows = (customers.data ?? []) as Pick<Customer, "id" | "name" | "phone">[];
  const orderRows = (laundryOrders.data ?? []) as Pick<Order, "id" | "order_number" | "customer_id" | "order_date" | "promised_delivery_date" | "runtime_model" | "vertical_key">[];
  const addressIds = compactStrings(pickupRows.map((pickup) => pickup.pickup_address_id));
  const customerIds = customerRows.map((customer) => customer.id);
  const userIds = compactStrings(pickupRows.map((pickup) => pickup.assigned_user_id));
  const teamIds = compactStrings(pickupRows.map((pickup) => pickup.assigned_team_id));
  const handlingUnitIds = handlingRows.map((unit) => unit.id);

  const [addresses, pickupUsers, pickupTeams, serviceLots, custodyEvents] = await Promise.all([
    addressIds.length
      ? supabase
          .from("customer_addresses")
          .select("id, customer_id, label, address_line_1, area, city")
          .eq("tenant_id", context.tenant.id)
          .or(`id.in.(${addressIds.join(",")}),customer_id.in.(${customerIds.join(",")})`)
          .is("deleted_at", null)
      : customerIds.length
        ? supabase
            .from("customer_addresses")
            .select("id, customer_id, label, address_line_1, area, city")
            .eq("tenant_id", context.tenant.id)
            .in("customer_id", customerIds)
            .is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabase
          .from("tenant_users")
          .select("id, display_name, email, role")
          .eq("tenant_id", context.tenant.id)
          .in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length
      ? supabase
          .from("teams")
          .select("id, name, code")
          .eq("tenant_id", context.tenant.id)
          .in("id", teamIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
    handlingUnitIds.length
      ? supabase
          .from("laundry_service_lots")
          .select("*")
          .eq("tenant_id", context.tenant.id)
          .in("handling_unit_id", handlingUnitIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
    handlingUnitIds.length
      ? supabase
          .from("laundry_custody_events")
          .select("*")
          .eq("tenant_id", context.tenant.id)
          .in("handling_unit_id", handlingUnitIds)
          .order("occurred_at", { ascending: false })
      : Promise.resolve({ data: [], error: null })
  ]);

  for (const result of [addresses, pickupUsers, pickupTeams, serviceLots, custodyEvents]) {
    if (result.error) {
      throw new Error(`Unable to load Laundry custody lookup data: ${result.error.message}`);
    }
  }

  const customersById = indexById(customerRows);
  const addressesById = indexById((addresses.data ?? []) as Pick<CustomerAddress, "id" | "label" | "address_line_1" | "area" | "city">[]);
  const usersById = indexById((pickupUsers.data ?? []) as Pick<TenantUser, "id" | "display_name" | "email" | "role">[]);
  const teamsById = indexById((pickupTeams.data ?? []) as Pick<Team, "id" | "name" | "code">[]);
  const locationsById = indexById((locations.data ?? []) as Pick<TenantLocation, "id" | "name" | "code" | "location_type">[]);
  const containerAssetsById = indexById((containerAssets.data ?? []) as LaundryContainerAsset[]);

  const handlingUnitsByPickupId = new Map<string, LaundryHandlingUnit[]>();
  for (const handlingUnit of handlingRows) {
    if (!handlingUnit.created_from_pickup_id) {
      continue;
    }
    handlingUnitsByPickupId.set(handlingUnit.created_from_pickup_id, [
      ...(handlingUnitsByPickupId.get(handlingUnit.created_from_pickup_id) ?? []),
      handlingUnit
    ]);
  }

  const serviceLotsByHandlingId = new Map<string, LaundryServiceLot[]>();
  for (const serviceLot of (serviceLots.data ?? []) as LaundryServiceLot[]) {
    serviceLotsByHandlingId.set(serviceLot.handling_unit_id, [
      ...(serviceLotsByHandlingId.get(serviceLot.handling_unit_id) ?? []),
      serviceLot
    ]);
  }

  const custodyEventsByHandlingId = new Map<string, LaundryCustodyEvent[]>();
  for (const event of (custodyEvents.data ?? []) as LaundryCustodyEvent[]) {
    custodyEventsByHandlingId.set(event.handling_unit_id, [
      ...(custodyEventsByHandlingId.get(event.handling_unit_id) ?? []),
      event
    ]);
  }

  return {
    context,
    pickups: pickupRows.map(
      (pickup): LaundryPickupQueueItem => ({
        pickup,
        customer: customersById.get(pickup.customer_id) ?? null,
        address: pickup.pickup_address_id ? addressesById.get(pickup.pickup_address_id) ?? null : null,
        assignedUser: pickup.assigned_user_id ? usersById.get(pickup.assigned_user_id) ?? null : null,
        assignedTeam: pickup.assigned_team_id ? teamsById.get(pickup.assigned_team_id) ?? null : null,
        handlingUnits: handlingUnitsByPickupId.get(pickup.id) ?? []
      })
    ),
    handlingUnits: handlingRows.map(
      (handlingUnit): LaundryHandlingUnitItem => ({
        handlingUnit,
        customer: customersById.get(handlingUnit.customer_id) ?? null,
        currentLocation: handlingUnit.current_location_id ? locationsById.get(handlingUnit.current_location_id) ?? null : null,
        containerAsset: handlingUnit.container_asset_id ? containerAssetsById.get(handlingUnit.container_asset_id) ?? null : null,
        serviceLots: serviceLotsByHandlingId.get(handlingUnit.id) ?? [],
        custodyEvents: custodyEventsByHandlingId.get(handlingUnit.id) ?? []
      })
    ),
    containerAssets: (containerAssets.data ?? []) as LaundryContainerAsset[],
    serviceCatalog: (serviceCatalog.data ?? []) as LaundryServiceCatalog[],
    customers: customerRows,
    addresses: (addresses.data ?? []) as Array<Pick<CustomerAddress, "id" | "customer_id" | "label" | "address_line_1" | "area" | "city">>,
    assignableUsers: (assignableUsers.data ?? []) as Pick<TenantUser, "id" | "display_name" | "email" | "role">[],
    assignableTeams: (assignableTeams.data ?? []) as Pick<Team, "id" | "name" | "code">[],
    locations: (locations.data ?? []) as Pick<TenantLocation, "id" | "name" | "code" | "location_type">[],
    laundryOrders: orderRows,
    workflows: (workflows.data ?? []) as Pick<Workflow, "id" | "name" | "description" | "is_default" | "is_active">[]
  };
}
