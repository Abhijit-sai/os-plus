import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  aggregateContributionCategories,
  aggregateWorkerContributions,
  buildWeeklyContributionTrend,
  filterWorkerContributionLogs,
} from "../src/features/dashboard/worker-contributions.ts";

const logs = [
  {
    calculatedContributionAmount: 300,
    completedAt: "2026-08-03T10:00:00.000Z",
    creditedMinutes: 0,
    creditedUnits: 0.6,
    effortMode: "units",
    itemTypeId: "shirt",
    rateConfigured: true,
    stageId: "stitching",
    stageInstanceId: "stage-a",
    workgroupId: "tailors",
    workerId: "worker-a",
  },
  {
    calculatedContributionAmount: 160,
    completedAt: "2026-08-03T10:00:00.000Z",
    creditedMinutes: 0,
    creditedUnits: 0.4,
    effortMode: "units",
    itemTypeId: "shirt",
    rateConfigured: true,
    stageId: "stitching",
    stageInstanceId: "stage-a",
    workgroupId: "tailors",
    workerId: "worker-b",
  },
  {
    calculatedContributionAmount: 500,
    completedAt: "2026-08-09T12:00:00.000Z",
    creditedMinutes: 60,
    creditedUnits: 0,
    effortMode: "hours",
    itemTypeId: "shirt",
    rateConfigured: true,
    stageId: "painting",
    stageInstanceId: "stage-b",
    workgroupId: "painters",
    workerId: "worker-a",
  },
  {
    calculatedContributionAmount: 0,
    completedAt: "2026-08-10T12:00:00.000Z",
    creditedMinutes: 70,
    creditedUnits: 0,
    effortMode: "hours",
    itemTypeId: "pant",
    rateConfigured: false,
    stageId: "painting",
    stageInstanceId: "stage-c",
    workgroupId: "painters",
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

assert.deepEqual(aggregateContributionCategories(logs), [
  { completedStages: 1, contributionAmount: 460, creditedMinutes: 0, creditedUnits: 1, effortMode: "units", itemTypeId: "shirt", stageId: "stitching", workerCount: 2 },
  { completedStages: 1, contributionAmount: 500, creditedMinutes: 60, creditedUnits: 0, effortMode: "hours", itemTypeId: "shirt", stageId: "painting", workerCount: 1 },
  { completedStages: 1, contributionAmount: 0, creditedMinutes: 70, creditedUnits: 0, effortMode: "hours", itemTypeId: "pant", stageId: "painting", workerCount: 1 },
]);

const workerFilteredLogs = filterWorkerContributionLogs(logs, { workerIds: ["worker-b"] });
assert.equal(workerFilteredLogs.length, 2);
assert.deepEqual(aggregateWorkerContributions(workerFilteredLogs), [{
  completedStages: 2,
  contributionAmount: 160,
  creditedMinutes: 70,
  creditedUnits: 0.4,
  pricedAssignments: 1,
  totalAssignments: 2,
  workerId: "worker-b",
}]);
assert.deepEqual(buildWeeklyContributionTrend(workerFilteredLogs, ["worker-b"], "hours"), [
  { weekStart: "2026-08-03", values: { "worker-b": 0 } },
  { weekStart: "2026-08-10", values: { "worker-b": 1.166667 } },
]);

const [queries, page, appShell] = await Promise.all([
  readFile(new URL("../src/features/dashboard/queries.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(tenant)/dashboard/workers/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/layout/app-shell.tsx", import.meta.url), "utf8"),
]);
assert.match(queries, /getWorkerContributionReportData/);
assert.match(queries, /canViewContributionAmounts/);
assert.match(queries, /worker_contribution_amounts:view/);
assert.match(queries, /credited_units, credited_minutes, calculated_contribution_amount/);
assert.match(queries, /credited_units, credited_minutes, completed_at/);
assert.match(queries, /\.eq\("tenant_id", context\.tenant\.id\)/);
assert.match(queries, /\.eq\("status", "completed"\)/);
assert.match(page, /By item category/);
assert.match(page, /Worker comparison/);
assert.match(page, /Weekly worker trend/);
assert.match(page, /itemType/);
assert.match(page, /workgroup/);
assert.match(page, /data\.canViewContributionAmounts/);
assert.match(page, /hasInvalidFilter \? \[\] : filterWorkerContributionLogs/, "invalid filters must fail closed and worker filters must feed every report aggregate");
assert.match(page, /configurationCoverage/, "owner reports must retain rate-configuration coverage");
assert.match(appShell, /href: "\/worker-contributions"[\s\S]*label: "Worker contributions"[\s\S]*permission: "worker_contributions:view"/, "worker contribution reporting must be discoverable in primary navigation for every permitted role");

assert.deepEqual(
  buildWeeklyContributionTrend(logs, ["worker-a", "worker-b"], "hours"),
  [
    { weekStart: "2026-08-03", values: { "worker-a": 1, "worker-b": 0 } },
    { weekStart: "2026-08-10", values: { "worker-a": 0, "worker-b": 1.166667 } },
  ],
);

console.log("Worker contribution aggregation and weekly trend tests passed.");
