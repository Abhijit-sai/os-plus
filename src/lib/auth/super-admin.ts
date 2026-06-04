import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

function getConfiguredSuperAdmins() {
  return (process.env.OS_PLUS_SUPER_ADMIN_CLERK_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function getCurrentClerkUserId() {
  const { userId } = await auth();
  return userId;
}

export async function getCurrentClerkIdentity() {
  const user = await currentUser();

  if (!user) {
    return null;
  }

  return {
    userId: user.id,
    primaryEmail: user.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null,
    fullName: user.fullName ?? ([user.firstName, user.lastName].filter(Boolean).join(" ") || null)
  };
}

export async function isCurrentUserSuperAdmin() {
  const userId = await getCurrentClerkUserId();

  if (!userId) {
    return false;
  }

  return getConfiguredSuperAdmins().includes(userId);
}

export async function requireSuperAdmin() {
  const userId = await getCurrentClerkUserId();

  if (!userId || !getConfiguredSuperAdmins().includes(userId)) {
    throw new Error("Super admin access is required.");
  }

  return userId;
}

export async function requireSuperAdminPageAccess() {
  const userId = await getCurrentClerkUserId();

  if (!userId || !getConfiguredSuperAdmins().includes(userId)) {
    notFound();
  }

  return userId;
}
