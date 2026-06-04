import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NoTenantPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-6">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>No active tenant found</CardTitle>
          <CardDescription>
            Your Clerk identity is not mapped to an active OS PLUS tenant yet. A super admin must create or activate
            your tenant user membership.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/">Back to OS PLUS</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
