"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { Card, CardContent } from "@/components/ui/card";

export type SalesChartPoint = {
  label: string;
  count: number;
  amount: number;
  collected: number;
};

export type WorkerChartPoint = {
  label: string;
} & Record<string, number | string>;

export type AttendanceChartPoint = {
  absent: number;
  half_day: number;
  leave: number;
  present: number;
  unmarked: number;
  label: string;
};

const lineColors = ["#111827", "#525252", "#737373", "#a3a3a3", "#0f766e", "#854d0e", "#7f1d1d", "#1d4ed8"];

function compactMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

export function SalesBarChart({ data, mode }: { data: SalesChartPoint[]; mode: "count" | "amount" }) {
  const dataKey = mode === "count" ? "count" : "amount";

  if (!data.length) {
    return <EmptyChartState label="No sales data for this range." />;
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(value) => (mode === "amount" ? compactMoney(Number(value)) : String(value))} />
          <Tooltip formatter={(value) => (mode === "amount" ? compactMoney(Number(value)) : value)} />
          <Bar dataKey={dataKey} fill="#111827" radius={[4, 4, 0, 0]} name={mode === "count" ? "Orders" : "Booked"} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WorkerLineChart({ data, workers }: { data: WorkerChartPoint[]; workers: string[] }) {
  if (!data.length || !workers.length) {
    return <EmptyChartState label="No worker activity in this range." />;
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} allowDecimals />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {workers.map((worker, index) => (
            <Line
              key={worker}
              type="monotone"
              dataKey={worker}
              stroke={lineColors[index % lineColors.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AttendanceStackedBarChart({ data }: { data: AttendanceChartPoint[] }) {
  const hasAttendanceSignal = data.some((point) => point.present > 0 || point.half_day > 0 || point.absent > 0 || point.leave > 0 || point.unmarked > 0);

  if (!data.length || !hasAttendanceSignal) {
    return <EmptyChartState label="No attendance signal in this range." />;
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="present" name="Present" stackId="attendance" fill="#111827" radius={[4, 4, 0, 0]} />
          <Bar dataKey="half_day" name="Half day" stackId="attendance" fill="#737373" />
          <Bar dataKey="absent" name="Absent" stackId="attendance" fill="#dc2626" />
          <Bar dataKey="leave" name="Leave" stackId="attendance" fill="#f59e0b" />
          <Bar dataKey="unmarked" name="Unmarked" stackId="attendance" fill="#d4d4d4" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex h-[260px] items-center justify-center p-6 text-sm text-muted-foreground">{label}</CardContent>
    </Card>
  );
}
