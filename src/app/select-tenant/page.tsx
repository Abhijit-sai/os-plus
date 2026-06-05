import { selectTenantAction } from "@/features/tenant-users/actions";
import { getTenantAccessOptions } from "@/lib/tenant/context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formatRole(role: string) {
  if (role === "owner_admin") {
    return "Owner/Admin";
  }

  return role
    .replace("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getBlockedCopy(reason: string | null) {
  if (reason === "tenant_suspended") {
    return {
      label: "Suspended",
      message:
        "This business profile is suspended. Contact OS PLUS support to reactivate access.",
    };
  }

  if (reason === "tenant_inactive") {
    return {
      label: "Inactive",
      message:
        "This business profile is inactive. Contact OS PLUS support to reactivate access.",
    };
  }

  return {
    label: "Disabled",
    message:
      "Your membership for this business is disabled. Ask an owner/admin to reactivate it.",
  };
}

export default async function SelectTenantPage() {
  const options = await getTenantAccessOptions();
  const account = options[0]?.user;
  const activeOptions = options.filter((option) => option.canAccess);
  const blockedOptions = options.filter((option) => !option.canAccess);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/60 px-6 py-10">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Choose business</CardTitle>
          <CardDescription>
            {account?.primaryEmail
              ? `Signed in as ${account.primaryEmail}. Open the business you want to work in now.`
              : "Open the business you want to work in now."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {activeOptions.length ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Available businesses</p>
                <p className="text-xs text-muted-foreground">
                  Only active memberships on active business profiles can be
                  opened.
                </p>
              </div>
              {activeOptions.map(({ tenant, membership }) => (
                <form
                  key={tenant.id}
                  action={selectTenantAction}
                  className="rounded-md border bg-background p-4"
                >
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        {tenant.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={tenant.logo_url}
                            alt={tenant.store_name}
                            className="h-10 w-10 rounded-md object-cover"
                          />
                        ) : (
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-semibold text-white"
                            style={{
                              backgroundColor: tenant.brand_color ?? "#2563eb",
                            }}
                          >
                            {tenant.store_name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold">
                              {tenant.store_name}
                            </p>
                            <Badge variant="default">Active</Badge>
                            <Badge variant="outline">
                              {formatRole(membership.role)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {tenant.slug}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Access is based on your verified email and this active
                        OS PLUS membership.
                      </p>
                    </div>
                    <Button type="submit">Open business</Button>
                  </div>
                </form>
              ))}
            </div>
          ) : null}

          {blockedOptions.length ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Unavailable businesses</p>
                <p className="text-xs text-muted-foreground">
                  These profiles are visible for clarity, but cannot be opened
                  from this account.
                </p>
              </div>
              {blockedOptions.map(({ tenant, membership, blockedReason }) => {
                const blockedCopy = getBlockedCopy(blockedReason);

                return (
                  <div
                    key={`${tenant.id}-${membership.id}`}
                    className="rounded-md border bg-background/70 p-4 opacity-85"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          {tenant.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={tenant.logo_url}
                              alt={tenant.store_name}
                              className="h-10 w-10 rounded-md object-cover grayscale"
                            />
                          ) : (
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-semibold text-white"
                              style={{
                                backgroundColor:
                                  tenant.brand_color ?? "#64748b",
                              }}
                            >
                              {tenant.store_name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-semibold">
                                {tenant.store_name}
                              </p>
                              <Badge
                                variant={
                                  blockedReason === "membership_disabled"
                                    ? "neutral"
                                    : "warning"
                                }
                              >
                                {blockedCopy.label}
                              </Badge>
                              <Badge variant="outline">
                                {formatRole(membership.role)}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {tenant.slug}
                            </p>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {blockedCopy.message}
                        </p>
                      </div>
                      <Button type="button" variant="outline" disabled>
                        Access blocked
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {!options.length ? (
            <div className="rounded-md border bg-background p-4">
              <p className="font-medium">No active business access found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ask an owner/admin to add your verified email as an active OS
                PLUS tenant membership.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
