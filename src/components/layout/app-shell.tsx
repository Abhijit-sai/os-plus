"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { useState } from "react";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Factory,
  Home,
  Landmark,
  LineChart,
  ListChecks,
  LogOut,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { TenantContext } from "@/lib/tenant/context";
import {
  getDefaultTenantRoute,
  getDefaultTenantRouteLabel,
  hasPermission,
  type Permission,
} from "@/lib/permissions/roles";
import { UnsavedChangesProvider } from "@/components/layout/unsaved-changes-provider";
import type { TenantVerticalKey } from "@/types/database";

const navItems: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: Permission;
  vertical?: TenantVerticalKey;
}> = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: Home,
    permission: "dashboard:view",
  },
  {
    href: "/orders",
    label: "Orders",
    icon: ClipboardList,
    permission: "orders:view",
  },
  {
    href: "/production",
    label: "Production",
    icon: Factory,
    permission: "production:view",
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: ListChecks,
    permission: "tasks:view",
    vertical: "laundry",
  },
  {
    href: "/laundry/custody",
    label: "Laundry",
    icon: Package,
    permission: "laundry:view",
    vertical: "laundry",
  },
  {
    href: "/customers",
    label: "Customers",
    icon: Users,
    permission: "customers:view",
  },
  {
    href: "/workers",
    label: "Workers",
    icon: Users,
    permission: "workers:view",
  },
  {
    href: "/attendance",
    label: "Attendance",
    icon: CalendarDays,
    permission: "attendance:view",
  },
  {
    href: "/salary",
    label: "Salary",
    icon: WalletCards,
    permission: "salary:view",
  },
  {
    href: "/finance",
    label: "Finance",
    icon: Landmark,
    permission: "finance:view",
  },
  {
    href: "/reports",
    label: "Reports",
    icon: LineChart,
    permission: "reports:view",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    permission: "settings:view",
  },
];

function formatRole(role: string) {
  if (role === "owner_admin") {
    return "Owner/Admin";
  }

  return role
    .replace("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AppShell({
  context,
  verticalKeys,
  children,
}: {
  context: TenantContext;
  verticalKeys: TenantVerticalKey[];
  children: React.ReactNode;
}) {
  const visibleNavItems = navItems.filter((item) =>
    hasPermission(context.membership.role, item.permission) &&
    (!item.vertical || verticalKeys.includes(item.vertical)),
  );
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const sidebarWidthClass = isCollapsed ? "md:w-16" : "md:w-64";
  const contentPaddingClass = isCollapsed ? "md:pl-16" : "md:pl-64";
  const defaultWorkspaceHref = getDefaultTenantRoute(context.membership.role);
  const defaultWorkspaceLabel = getDefaultTenantRouteLabel(
    context.membership.role,
  );

  return (
    <UnsavedChangesProvider>
      <div className="min-h-screen bg-muted/40">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 hidden border-r bg-background transition-all md:flex md:flex-col",
            sidebarWidthClass,
          )}
        >
          <div className="border-b p-3">
            <div
              className={cn(
                "flex items-center",
                isCollapsed ? "justify-center" : "gap-3",
              )}
            >
              {context.tenant.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={context.tenant.logo_url}
                  alt={context.tenant.store_name}
                  className="h-10 w-10 rounded-md object-cover"
                />
              ) : (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-semibold text-white"
                  style={{
                    backgroundColor: context.tenant.brand_color ?? "#2563eb",
                  }}
                >
                  {context.tenant.store_name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className={cn("min-w-0", isCollapsed ? "hidden" : "")}>
                <p className="truncate font-semibold">
                  {context.tenant.store_name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatRole(context.membership.role)}
                </p>
                <Link
                  href={defaultWorkspaceHref}
                  className="mt-1 block truncate text-xs font-medium text-primary hover:underline"
                >
                  {defaultWorkspaceLabel} workspace
                </Link>
              </div>
            </div>
            <button
              type="button"
              className="mt-3 hidden h-8 w-full items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-accent-foreground md:flex"
              onClick={() => setIsCollapsed((value) => !value)}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {visibleNavItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                    isCollapsed ? "justify-center" : "gap-3",
                    isActive
                      ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                      : "",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className={isCollapsed ? "sr-only" : ""}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className={cn("transition-all", contentPaddingClass)}>
          <header className="sticky top-0 z-10 border-b bg-background/95 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  OS PLUS
                </p>
                <h1 className="text-lg font-semibold">{context.tenant.name}</h1>
                <p className="text-xs text-muted-foreground">
                  {formatRole(context.membership.role)} · Default:{" "}
                  <Link
                    href={defaultWorkspaceHref}
                    className="font-medium text-foreground hover:underline"
                  >
                    {defaultWorkspaceLabel}
                  </Link>
                </p>
              </div>
              <details className="group relative">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                  <span className="hidden max-w-40 truncate sm:inline">
                    {context.user.fullName ??
                      context.user.primaryEmail ??
                      "Account"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="absolute right-0 mt-2 w-80 rounded-md border bg-background p-2 shadow-lg">
                  <div className="border-b px-3 py-2">
                    <p className="truncate text-sm font-semibold">
                      {context.user.fullName ?? "Signed in user"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {context.user.primaryEmail ??
                        context.membership.email ??
                        "Email unavailable"}
                    </p>
                  </div>
                  <div className="space-y-2 border-b px-3 py-3">
                    <div className="flex items-start gap-2">
                      <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {context.tenant.store_name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {context.tenant.slug}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Role: {formatRole(context.membership.role)}
                    </p>
                    <Link
                      href={defaultWorkspaceHref}
                      className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium hover:bg-accent"
                    >
                      <Home className="h-4 w-4 text-muted-foreground" />
                      Open {defaultWorkspaceLabel}
                    </Link>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/select-tenant"
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
                    >
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      Switch business
                    </Link>
                    <SignOutButton>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <LogOut className="h-4 w-4 text-muted-foreground" />
                        Sign out
                      </button>
                    </SignOutButton>
                  </div>
                </div>
              </details>
            </div>
          </header>
          <main className="p-4 md:p-6">{children}</main>
        </div>
      </div>
    </UnsavedChangesProvider>
  );
}
