import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-6">
      <section className="max-w-3xl space-y-6 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">OS PLUS</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Multi-tenant operations for boutique production teams.
        </h1>
        <p className="text-lg text-muted-foreground">
          A white-label WorkOS foundation for orders, item-level workflows, workers, attendance,
          salary suggestions, finance, and customer-safe tracking.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/dashboard">Open workspace</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
