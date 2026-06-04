"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import type { SalaryTrendPoint, WorkerSalaryChartPoint } from "@/features/salary/queries";

function compactMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

export function SalaryPaidTrendChart({ data }: { data: SalaryTrendPoint[] }) {
  const hasPayments = data.some((point) => point.paid > 0);

  if (!data.length || !hasPayments) {
    return <EmptyChartState label="No salary payments in this range yet." />;
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(value) => compactMoney(Number(value))} />
          <Tooltip formatter={(value) => compactMoney(Number(value))} />
          <Bar dataKey="paid" name="Salary paid" fill="#111827" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WorkerSalaryBarChart({ data }: { data: WorkerSalaryChartPoint[] }) {
  const hasMovement = data.some((point) => point.paid > 0 || point.due > 0);

  if (!data.length || !hasMovement) {
    return <EmptyChartState label="No worker salary movement in this range yet." />;
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(value) => compactMoney(Number(value))} />
          <Tooltip formatter={(value) => compactMoney(Number(value))} />
          <Legend />
          <Bar dataKey="paid" name="Paid" fill="#111827" radius={[4, 4, 0, 0]} />
          <Bar dataKey="due" name="Due" fill="#dc2626" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex h-[280px] items-center justify-center p-6 text-sm text-muted-foreground">{label}</CardContent>
    </Card>
  );
}
