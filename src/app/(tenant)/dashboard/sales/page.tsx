import Link from "next/link";

import { SalesBarChart, type SalesChartPoint } from "@/components/dashboard/analytics-charts";
import { MetricCard } from "@/components/dashboard/metric-card";
import { CommandBar } from "@/components/layout/command-bar";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDashboardPageData } from "@/features/dashboard/queries";

type RangeKey = "7d" | "30d" | "mtd" | "ytd" | "custom";
type GroupKey = "day" | "month";
type ModeKey = "amount" | "count";

const rangeOptions: Array<{ value: RangeKey; label: string }> = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "mtd", label: "MTD" },
  { value: "ytd", label: "YTD" },
  { value: "custom", label: "Custom" }
];

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getRangeBounds(range: RangeKey, start?: string, end?: string) {
  const today = startOfToday();

  if (range === "7d") {
    return { start: addDays(today, -6), end: today };
  }

  if (range === "mtd") {
    return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
  }

  if (range === "ytd") {
    return { start: new Date(today.getFullYear(), 0, 1), end: today };
  }

  if (range === "custom" && start && end) {
    return { start: new Date(`${start}T00:00:00`), end: new Date(`${end}T00:00:00`) };
  }

  return { start: addDays(today, -29), end: today };
}

function getDaysInRange(start: Date, end: Date) {
  const days: Array<{ date: string; label: string }> = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    days.push({
      date: toIsoDate(cursor),
      label: new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(cursor)
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

function formatMonthLabel(monthKey: string) {
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(new Date(`${monthKey}-01T00:00:00`));
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

function buildSalesHref({
  range,
  group,
  mode,
  start,
  end
}: {
  range: RangeKey;
  group: GroupKey;
  mode: ModeKey;
  start?: string;
  end?: string;
}) {
  const params = new URLSearchParams({ range, group, mode });

  if (range === "custom") {
    if (start) {
      params.set("start", start);
    }

    if (end) {
      params.set("end", end);
    }
  }

  return `/dashboard/sales?${params.toString()}`;
}

function isInRange(date: string, range: ReturnType<typeof getRangeBounds>) {
  const value = new Date(`${date}T00:00:00`);
  return value >= range.start && value <= range.end;
}

export default async function DashboardSalesPage({
  searchParams
}: {
  searchParams?: Promise<{ range?: string; group?: string; mode?: string; start?: string; end?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const activeRange = rangeOptions.some((range) => range.value === resolvedSearchParams?.range) ? (resolvedSearchParams?.range as RangeKey) : "30d";
  const activeGroup: GroupKey = resolvedSearchParams?.group === "month" ? "month" : "day";
  const activeMode: ModeKey = resolvedSearchParams?.mode === "count" ? "count" : "amount";
  const customStart = resolvedSearchParams?.start;
  const customEnd = resolvedSearchParams?.end;
  const range = getRangeBounds(activeRange, customStart, customEnd);
  const data = await getDashboardPageData();
  const rangeOrders = data.orders.filter((order) => isInRange(order.order_date, range));
  const rangePayments = data.orderPayments.filter((payment) => isInRange(payment.payment_date, range));
  const salesChartData: SalesChartPoint[] =
    activeGroup === "month"
      ? Array.from(
          rangeOrders.reduce((groups, order) => {
            const key = getMonthKey(order.order_date);
            const current = groups.get(key) ?? { label: formatMonthLabel(key), count: 0, amount: 0, collected: 0 };
            current.count += 1;
            current.amount += Number(order.total_amount);
            groups.set(key, current);
            return groups;
          }, new Map<string, SalesChartPoint>())
        )
          .map(([monthKey, point]) => ({
            ...point,
            collected: rangePayments.filter((payment) => getMonthKey(payment.payment_date) === monthKey).reduce((total, payment) => total + Number(payment.amount), 0)
          }))
          .sort((a, b) => a.label.localeCompare(b.label))
      : getDaysInRange(range.start, range.end).map((day) => {
          const dayOrders = rangeOrders.filter((order) => order.order_date === day.date);
          const dayPayments = rangePayments.filter((payment) => payment.payment_date === day.date);

          return {
            label: day.label,
            count: dayOrders.length,
            amount: dayOrders.reduce((total, order) => total + Number(order.total_amount), 0),
            collected: dayPayments.reduce((total, payment) => total + Number(payment.amount), 0)
          };
        });
  const booked = salesChartData.reduce((total, row) => total + row.amount, 0);
  const orders = salesChartData.reduce((total, row) => total + row.count, 0);
  const collected = salesChartData.reduce((total, row) => total + row.collected, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales Analytics"
        description="Booked order value, order count, and collections with range and grouping controls."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard?tab=sales">Back to dashboard</Link>
          </Button>
        }
      />

      <CommandBar className="justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {rangeOptions.map((option) => (
            <Button key={option.value} asChild size="sm" variant={activeRange === option.value ? "default" : "outline"}>
              <Link href={buildSalesHref({ range: option.value, group: activeGroup, mode: activeMode, start: customStart, end: customEnd })}>{option.label}</Link>
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant={activeGroup === "day" ? "default" : "outline"}>
            <Link href={buildSalesHref({ range: activeRange, group: "day", mode: activeMode, start: customStart, end: customEnd })}>Daily</Link>
          </Button>
          <Button asChild size="sm" variant={activeGroup === "month" ? "default" : "outline"}>
            <Link href={buildSalesHref({ range: activeRange, group: "month", mode: activeMode, start: customStart, end: customEnd })}>Monthly</Link>
          </Button>
          <Button asChild size="sm" variant={activeMode === "amount" ? "default" : "outline"}>
            <Link href={buildSalesHref({ range: activeRange, group: activeGroup, mode: "amount", start: customStart, end: customEnd })}>Amount</Link>
          </Button>
          <Button asChild size="sm" variant={activeMode === "count" ? "default" : "outline"}>
            <Link href={buildSalesHref({ range: activeRange, group: activeGroup, mode: "count", start: customStart, end: customEnd })}>Count</Link>
          </Button>
        </div>
      </CommandBar>

      <form action="/dashboard/sales" className="flex flex-wrap items-center gap-2 rounded-[14px] border bg-background p-2 shadow-sm">
        <input type="hidden" name="range" value="custom" />
        <input type="hidden" name="group" value={activeGroup} />
        <input type="hidden" name="mode" value={activeMode} />
        <Input name="start" type="date" defaultValue={customStart ?? toIsoDate(range.start)} className="h-9 w-[150px]" aria-label="Custom start date" />
        <Input name="end" type="date" defaultValue={customEnd ?? toIsoDate(range.end)} className="h-9 w-[150px]" aria-label="Custom end date" />
        <Button size="sm" type="submit" variant={activeRange === "custom" ? "default" : "outline"}>
          Apply custom
        </Button>
      </form>

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Booked revenue" value={formatMoney(booked)} />
        <MetricCard label="Orders booked" value={orders} />
        <MetricCard label="Cash collected" value={formatMoney(collected)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{activeMode === "amount" ? "Booked Revenue" : "Order Count"}</CardTitle>
          <CardDescription>
            {activeGroup === "day" ? "Daily" : "Monthly"} view from {toIsoDate(range.start)} to {toIsoDate(range.end)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SalesBarChart data={salesChartData} mode={activeMode} />
        </CardContent>
      </Card>
    </div>
  );
}
