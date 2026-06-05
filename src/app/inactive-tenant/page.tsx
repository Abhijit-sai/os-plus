import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getInactiveTenantMembershipOptions, getTenantMembershipOptions } from "@/lib/tenant/context";

function formatTenantStatus(status: string) {
  return status === "suspended" ? "Suspended" : "Inactive";
}

export default async function InactiveTenantPage() {
  const [activeOptions, inactiveOptions] = await Promise.all([getTenantMembershipOptions(), getInactiveTenantMembershipOptions()]);
  const account = inactiveOptions[0]?.user ?? activeOptions[0]?.user;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/60 px-6 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Business profile inactive</CardTitle>
          <CardDescription>
            {account?.primaryEmail
              ? `Signed in as ${account.primaryEmail}. This business profile is not active right now.`
              : "This business profile is not active right now."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            {inactiveOptions.map(({ tenant }) => (
              <div key={tenant.id} className="flex items-center justify-between gap-3 rounded-md border bg-background p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{tenant.store_name}</p>
                  <p className="text-sm text-muted-foreground">{tenant.slug}</p>
                </div>
                <Badge variant="outline">{formatTenantStatus(tenant.status)}</Badge>
              </div>
            ))}
            {!inactiveOptions.length ? (
              <div className="rounded-md border bg-background p-4">
                <p className="font-medium">No inactive business found</p>
                <p className="text-sm text-muted-foreground">Your available active businesses may have changed.</p>
              </div>
            ) : null}
          </div>
          <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
            Please contact OS PLUS support to reactivate access. Your data has not been deleted.
          </div>
          <div className="flex flex-wrap gap-2">
            {activeOptions.length ? (
              <Button asChild>
                <Link href="/select-tenant">Switch business</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/">Back to OS PLUS</Link>
            </Button>
            <SignOutButton>
              <Button type="button" variant="outline">
                Sign out
              </Button>
            </SignOutButton>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
