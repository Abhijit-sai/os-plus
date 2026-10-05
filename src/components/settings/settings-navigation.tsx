"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function SettingsNavigation() {
  const pathname = usePathname();
  if (pathname === "/settings") return null;
  return <nav aria-label="Settings navigation" className="mb-4">
    <Link href="/settings" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <ArrowLeft className="h-4 w-4" />All settings
    </Link>
  </nav>;
}
