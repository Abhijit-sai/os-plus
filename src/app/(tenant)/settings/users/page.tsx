import Link from "next/link";

import { createTenantUserAction, updateTenantUserAction } from "@/features/tenant-users/actions";
import { getTenantUsersSettingsPageData } from "@/features/tenant-users/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TenantUser, TenantUserRole, TenantUserStatus } from "@/types/database";

const roles: Array<{ value: TenantUserRole; label: string; description: string }> = [
  { value: "owner_admin", label: "Owner/admin", description: "All modules, settings, and internal users." },
  { value: "manager", label: "Project manager", description: "Orders, production, customers, and attendance." },
  { value: "finance", label: "Finance", description: "Salary and finance only." },
  { value: "viewer", label: "Viewer", description: "Read-only dashboard/report access." }
];

const statuses: TenantUserStatus[] = ["active", "disabled"];

function roleLabel(role: TenantUserRole) {
  return roles.find((item) => item.value === role)?.label ?? role;
}

function statusLabel(status: TenantUserStatus) {
  return status === "active" ? "Active" : "Disabled";
}

function UserFields({ user }: { user?: TenantUser }) {
  return (
    <>
      {user ? <input type="hidden" name="tenantUserId" value={user.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${user?.id ?? "new"}-email`}>Email</Label>
          <Input id={`${user?.id ?? "new"}-email`} name="email" type="email" defaultValue={user?.email ?? ""} placeholder="manager@example.com" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${user?.id ?? "new"}-name`}>Display name</Label>
          <Input id={`${user?.id ?? "new"}-name`} name="displayName" defaultValue={user?.display_name ?? ""} placeholder="Store manager" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${user?.id ?? "new"}-role`}>Role</Label>
          <select id={`${user?.id ?? "new"}-role`} name="role" defaultValue={user?.role ?? "manager"} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${user?.id ?? "new"}-status`}>Status</Label>
          <select id={`${user?.id ?? "new"}-status`} name="status" defaultValue={user?.status ?? "active"} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            {statuses.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Active grants access after verified email sign-in. Disabled blocks access.</p>
        </div>
      </div>
    </>
  );
}

export default async function TenantUsersSettingsPage() {
  const { context, tenantUsers } = await getTenantUsersSettingsPageData();
  const activeOwnerAdmins = tenantUsers.filter((user) => user.role === "owner_admin" && user.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Users and roles</h2>
          <p className="text-muted-foreground">Internal profiles for {context.tenant.store_name}. Clerk verifies sign-in; OS PLUS controls tenant access.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/settings">Back to settings</Link>
          </Button>
          <Dialog
            title="Add tenant user"
            description="Add an email and role. Access starts only after the person signs in with this verified email and the profile is active."
            trigger={<span className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Add user</span>}
          >
            <form action={createTenantUserAction} className="space-y-3">
              <UserFields />
              <Button type="submit">Add user</Button>
            </form>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Role design</CardTitle>
          <CardDescription>Tenant roles control module access inside this workspace only.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {roles.map((role) => (
            <div key={role.value} className="rounded-md border p-3 text-sm">
              <p className="font-medium">{role.label}</p>
              <p className="mt-1 text-muted-foreground">{role.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tenant users</CardTitle>
          <CardDescription>
            {tenantUsers.length} profiles · {activeOwnerAdmins} active owner/admin
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tenantUsers.map((user) => (
            <div key={user.id} className="rounded-md border p-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <p className="font-medium">{user.display_name ?? user.email}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{user.clerk_user_id ? "Verified sign-in linked" : "Awaiting first verified sign-in"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={user.status === "active" ? "default" : "neutral"}>{statusLabel(user.status)}</Badge>
                  <Badge variant="outline">{roleLabel(user.role)}</Badge>
                  <Dialog title="Edit tenant user" description="Role and status changes apply only inside this tenant." trigger={<span className="inline-flex h-8 items-center rounded-md border px-2 text-xs font-medium hover:bg-accent">Edit</span>}>
                    <form action={updateTenantUserAction} className="space-y-3">
                      <UserFields user={user} />
                      <Button type="submit">Save user</Button>
                    </form>
                  </Dialog>
                </div>
              </div>
            </div>
          ))}
          {!tenantUsers.length ? <p className="text-sm text-muted-foreground">No tenant users mapped yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
