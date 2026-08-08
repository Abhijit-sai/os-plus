import "server-only";

import { requireTenantRoutePermission } from "@/lib/permissions/tenant-route-guard";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { assertTenantVertical } from "@/features/verticals/queries";
import type { Task, Team, TenantUser } from "@/types/database";

function indexById<T extends { id: string }>(rows: T[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

function compactStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export type TaskQueueItem = {
  task: Task;
  assignedUser: Pick<TenantUser, "id" | "display_name" | "email" | "role"> | null;
  assignedTeam: Pick<Team, "id" | "name" | "code"> | null;
};

export async function getTaskQueueData() {
  const context = await requireTenantRoutePermission("tasks:view");
  await assertTenantVertical(context, "laundry");
  const supabase = createSupabaseServiceRoleClient();
  const tasks = await supabase
    .from("tasks")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .is("deleted_at", null)
    .order("status")
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (tasks.error) {
    throw new Error(`Unable to load tasks: ${tasks.error.message}`);
  }

  const taskRows = tasks.data ?? [];
  const assignedUserIds = compactStrings(taskRows.map((task) => task.assigned_user_id));
  const assignedTeamIds = compactStrings(taskRows.map((task) => task.assigned_team_id));
  const [assignedUsers, assignedTeams, assignableUsers, assignableTeams] = await Promise.all([
    assignedUserIds.length
      ? supabase
          .from("tenant_users")
          .select("id, display_name, email, role")
          .eq("tenant_id", context.tenant.id)
          .in("id", assignedUserIds)
      : Promise.resolve({ data: [], error: null }),
    assignedTeamIds.length
      ? supabase
          .from("teams")
          .select("id, name, code")
          .eq("tenant_id", context.tenant.id)
          .in("id", assignedTeamIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
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
      .order("name", { ascending: true })
  ]);

  for (const result of [assignedUsers, assignedTeams, assignableUsers, assignableTeams]) {
    if (result.error) {
      throw new Error(`Unable to load task assignment data: ${result.error.message}`);
    }
  }

  const assignedUsersById = indexById((assignedUsers.data ?? []) as Pick<TenantUser, "id" | "display_name" | "email" | "role">[]);
  const assignedTeamsById = indexById((assignedTeams.data ?? []) as Pick<Team, "id" | "name" | "code">[]);

  return {
    context,
    items: taskRows.map(
      (task): TaskQueueItem => ({
        task,
        assignedUser: task.assigned_user_id ? assignedUsersById.get(task.assigned_user_id) ?? null : null,
        assignedTeam: task.assigned_team_id ? assignedTeamsById.get(task.assigned_team_id) ?? null : null
      })
    ),
    assignableUsers: (assignableUsers.data ?? []) as Pick<TenantUser, "id" | "display_name" | "email" | "role">[],
    assignableTeams: (assignableTeams.data ?? []) as Pick<Team, "id" | "name" | "code">[]
  };
}
