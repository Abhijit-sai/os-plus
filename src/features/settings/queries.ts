import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";

export async function getSettingsOverview() {
  const context = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();

  const [
    itemTypes,
    stages,
    customerStatuses,
    workgroups,
    paymentModes,
    expenseCategories,
    measurementFields,
    standardSizes,
    communicationTemplates,
    tenantUsers,
    tenantLocations,
    teams
  ] = await Promise.all([
    supabase.from("item_types").select("*").eq("tenant_id", context.tenant.id).is("deleted_at", null).order("name"),
    supabase.from("stage_master").select("*").eq("tenant_id", context.tenant.id).is("deleted_at", null).order("name"),
    supabase
      .from("customer_statuses")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("sort_order"),
    supabase.from("workgroups").select("*").eq("tenant_id", context.tenant.id).is("deleted_at", null).order("name"),
    supabase.from("payment_modes").select("*").eq("tenant_id", context.tenant.id).is("deleted_at", null).order("name"),
    supabase
      .from("expense_categories")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("item_type_measurement_fields")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null),
    supabase
      .from("item_type_standard_sizes")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null),
    supabase
      .from("communication_templates")
      .select("id")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null),
    supabase
      .from("tenant_users")
      .select("id")
      .eq("tenant_id", context.tenant.id),
    supabase
      .from("tenant_locations")
      .select("id")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null),
    supabase
      .from("teams")
      .select("id")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
  ]);

  for (const result of [
    itemTypes,
    stages,
    customerStatuses,
    workgroups,
    paymentModes,
    expenseCategories,
    measurementFields,
    standardSizes,
    communicationTemplates,
    tenantUsers,
    tenantLocations,
    teams
  ]) {
    if (result.error) {
      throw new Error(`Unable to load settings: ${result.error.message}`);
    }
  }

  return {
    context,
    itemTypes: itemTypes.data ?? [],
    stages: stages.data ?? [],
    customerStatuses: customerStatuses.data ?? [],
    workgroups: workgroups.data ?? [],
    paymentModes: paymentModes.data ?? [],
    expenseCategories: expenseCategories.data ?? [],
    measurementFields: measurementFields.data ?? [],
    standardSizes: standardSizes.data ?? [],
    communicationTemplates: communicationTemplates.data ?? [],
    tenantUsers: tenantUsers.data ?? [],
    tenantLocations: tenantLocations.data ?? [],
    teams: teams.data ?? []
  };
}

export async function getBusinessProfileSettings() {
  return requireTenantContext();
}

export async function getItemTypes() {
  const { tenant } = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("item_types")
    .select("*")
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .order("name");

  if (error) {
    throw new Error(`Unable to load item types: ${error.message}`);
  }

  return data ?? [];
}

export async function getStages() {
  const { tenant } = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("stage_master")
    .select("*")
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .order("name");

  if (error) {
    throw new Error(`Unable to load stages: ${error.message}`);
  }

  return data ?? [];
}

export async function getCustomerStatuses() {
  const { tenant } = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("customer_statuses")
    .select("*")
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .order("sort_order");

  if (error) {
    throw new Error(`Unable to load customer statuses: ${error.message}`);
  }

  return data ?? [];
}

export async function getWorkgroups() {
  const { tenant } = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("workgroups")
    .select("*")
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .order("name");

  if (error) {
    throw new Error(`Unable to load workgroups: ${error.message}`);
  }

  return data ?? [];
}

export async function getPaymentModes() {
  const { tenant } = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("payment_modes")
    .select("*")
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .order("name");

  if (error) {
    throw new Error(`Unable to load payment modes: ${error.message}`);
  }

  return data ?? [];
}

export async function getExpenseCategories() {
  const { tenant } = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("expense_categories")
    .select("*")
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .order("name");

  if (error) {
    throw new Error(`Unable to load expense categories: ${error.message}`);
  }

  return data ?? [];
}

export async function getMeasurementStandardsSettings() {
  const context = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();
  const [itemTypes, fields, standardSizes] = await Promise.all([
    supabase
      .from("item_types")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("item_type_measurement_fields")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("sort_order"),
    supabase
      .from("item_type_standard_sizes")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("sort_order")
  ]);

  for (const result of [itemTypes, fields, standardSizes]) {
    if (result.error) {
      throw new Error(`Unable to load measurement standards: ${result.error.message}`);
    }
  }

  return {
    context,
    itemTypes: itemTypes.data ?? [],
    fields: fields.data ?? [],
    standardSizes: standardSizes.data ?? []
  };
}

export async function getTenantLocations() {
  const { tenant } = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("tenant_locations")
    .select("*")
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .order("name");

  if (error) {
    throw new Error(`Unable to load locations: ${error.message}`);
  }

  return data ?? [];
}

export async function getTeamsSettings() {
  const context = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();
  const [teams, locations, tenantUsers, teamMembers] = await Promise.all([
    supabase
      .from("teams")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("tenant_locations")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("tenant_users")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("team_members")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
  ]);

  for (const result of [teams, locations, tenantUsers, teamMembers]) {
    if (result.error) {
      throw new Error(`Unable to load teams settings: ${result.error.message}`);
    }
  }

  return {
    context,
    teams: teams.data ?? [],
    locations: locations.data ?? [],
    tenantUsers: tenantUsers.data ?? [],
    teamMembers: teamMembers.data ?? []
  };
}
