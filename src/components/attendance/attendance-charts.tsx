"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { Card, CardContent } from "@/components/ui/card";

export type AttendanceSplitPoint = {
  absent: number;
  available: number;
  halfDay: number;
  holiday: number;
  label: string;
  leave: number;
  lost: number;
  present: number;
  unmarked: number;
};

export type WorkerRegularityPoint = {
  name: string;
  regularity: number;
};

const attendanceColors = {
  absent: "#dc2626",
  available: "#111827",
  halfDay: "#d97706",
  holiday: "#16a34a",
  leave: "#2563eb",
  lost: "#dc2626",
  present: "#111827",
  unmarked: "#d4d4d4"
};

function regularityColor(value: number) {
  if (value < 70) {
    return "#dc2626";
  }

  if (value < 85) {
    return "#d97706";
  }

  return "#111827";
}

export function CapacityTrendChart({ data }: { data: AttendanceSplitPoint[] }) {
  if (!data.length) {
    return <EmptyChartState label="No attendance records in this range." />;
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="available" stackId="capacity" name="Available capacity" fill={attendanceColors.available} radius={[4, 4, 0, 0]} />
          <Bar dataKey="lost" stackId="capacity" name="Lost capacity" fill={attendanceColors.lost} />
          <Bar dataKey="unmarked" stackId="capacity" name="Unmarked" fill={attendanceColors.unmarked} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WorkerRegularityBarChart({ data }: { data: WorkerRegularityPoint[] }) {
  if (!data.length) {
    return <EmptyChartState label="No active workers match this filter." />;
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={112} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => `${value}%`} />
          <Bar dataKey="regularity" name="Regularity" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={regularityColor(entry.regularity)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex h-[300px] items-center justify-center p-6 text-sm text-muted-foreground">{label}</CardContent>
    </Card>
  );
}
