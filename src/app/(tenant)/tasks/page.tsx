import { notFound } from "next/navigation";

import { TaskQueueClient } from "@/features/tasks/task-queue-client";
import { getTaskQueueData } from "@/features/tasks/queries";
import { TenantVerticalUnavailableError } from "@/features/verticals/queries";

export default async function TasksPage() {
  let data;

  try {
    data = await getTaskQueueData();
  } catch (error) {
    if (error instanceof TenantVerticalUnavailableError) {
      notFound();
    }

    throw error;
  }

  const { items, assignableUsers, assignableTeams } = data;

  return <TaskQueueClient items={items} assignableUsers={assignableUsers} assignableTeams={assignableTeams} />;
}
