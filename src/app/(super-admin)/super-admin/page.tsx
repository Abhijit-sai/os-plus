import { redirect } from "next/navigation";

import { requireSuperAdminPageAccess } from "@/lib/auth/super-admin";

export default async function SuperAdminPage() {
  await requireSuperAdminPageAccess();

  redirect("/super-admin/tenants");
}
