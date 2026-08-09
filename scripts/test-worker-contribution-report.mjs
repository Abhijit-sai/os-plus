import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  aggregateWorkerContributions,
  buildWeeklyContributionTrend,
} from "../src/features/dashboard/worker-contributions.ts";

const logs = [
  {
    calculatedContributionAmount: 300,
    completedAt: "2026-08-03T10:00:00.000Z",
    creditedMinutes: 0,
    creditedUnits: 0.6,
    rateConfigured: true,
    stageInstanceId: "stage-a",
    workerId: "worker-a",
  },
  {
    calculatedContributionAmount: 160,
    completedAt: "2026-08-03T10:00:00.000Z",
    creditedMinutes: 0,
    creditedUnits: 0.4,
    rateConfigured: true,
    stageInstanceId: "stage-a",
    workerId: "worker-b",
  },
  {
    calculatedContributionAmount: 500,
    completedAt: "2026-08-09T12:00:00.000Z",
    creditedMinutes: 60,
    creditedUnits: 0,
    rateConfigured: true,
    stageInstanceId: "stage-b",
    workerId: "worker-a",
  },
  {
    calculatedContributionAmount: 0,
    completedAt: "2026-08-10T12:00:00.000Z",
    creditedMinutes: 70,
    creditedUnits: 0,
    rateConfigured: false,
    stageInstanceId: "stage-c",
    workerId: "worker-b",
  },
];

assert.deepEqual(aggregateWorkerContributions(logs), [
  {
    completedStages: 2,
    contributionAmount: 800,
    creditedMinutes: 60,
    creditedUnits: 0.6,
    pricedAssignments: 2,
    totalAssignments: 2,
    workerId: "worker-a",
  },
  {
    completedStages: 2,
    contributionAmount: 160,
    creditedMinutes: 70,
    creditedUnits: 0.4,
    pricedAssignments: 1,
    totalAssignments: 2,
    workerId: "worker-b",
  },
]);

assert.deepEqual(
  buildWeeklyContributionTrend(logs, ["worker-a", "worker-b"], "contribution"),
  [
    { weekStart: "2026-08-03", values: { "worker-a": 800, "worker-b": 160 } },
    { weekStart: "2026-08-10", values: { "worker-a": 0, "worker-b": 0 } },
  ],
);

const [queries, page] = await Promise.all([
  readFile(new URL("../src/features/dashboard/queries.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(tenant)/dashboard/workers/page.tsx", import.meta.url), "utf8"),
]);
assert.match(queries, /getWorkerContributionReportData/);
assert.match(queries, /credited_units, credited_minutes, calculated_contribution_amount/);
assert.match(queries, /\.eq\("tenant_id", context\.tenant\.id\)/);
assert.match(queries, /\.eq\("status", "completed"\)/);
assert.match(page, /Contribution leaderboard/);
assert.match(page, /Weekly contribution trend/);
assert.match(page, /Configuration coverage/);

assert.deepEqual(
  buildWeeklyContributionTrend(logs, ["worker-a", "worker-b"], "hours"),
  [
    { weekStart: "2026-08-03", values: { "worker-a": 1, "worker-b": 0 } },
    { weekStart: "2026-08-10", values: { "worker-a": 0, "worker-b": 1.166667 } },
  ],
);

console.log("Worker contribution aggregation and weekly trend tests passed.");
