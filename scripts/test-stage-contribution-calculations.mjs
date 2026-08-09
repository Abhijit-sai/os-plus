import assert from "node:assert/strict";

import {
  calculateStageContributions,
  stageContributionDatabaseErrorMessage,
  validateStageContributionAssignments,
} from "../src/features/production/contributions.ts";

const perUnit = calculateStageContributions(
  [
    { key: "worker-a", creditedMinutes: 0, creditedUnits: 0.6 },
    { key: "worker-b", creditedMinutes: 0, creditedUnits: 0.4 },
  ],
  { allocationBasis: "units", itemValue: 10000, method: "per_unit", rateValue: 400 },
);

assert.equal(perUnit.totalAmount, 400);
assert.deepEqual(perUnit.allocations, [
  { amount: 240, key: "worker-a" },
  { amount: 160, key: "worker-b" },
]);

const perHour = calculateStageContributions(
  [
    { key: "worker-a", creditedMinutes: 90, creditedUnits: 0 },
    { key: "worker-b", creditedMinutes: 30, creditedUnits: 0 },
  ],
  { allocationBasis: "hours", itemValue: 10000, method: "per_hour", rateValue: 120 },
);

assert.equal(perHour.totalAmount, 240);
assert.deepEqual(perHour.allocations, [
  { amount: 180, key: "worker-a" },
  { amount: 60, key: "worker-b" },
]);

const percentage = calculateStageContributions(
  [
    { key: "worker-a", creditedMinutes: 10, creditedUnits: 0 },
    { key: "worker-b", creditedMinutes: 10, creditedUnits: 0 },
    { key: "worker-c", creditedMinutes: 10, creditedUnits: 0 },
  ],
  { allocationBasis: "hours", itemValue: 100, method: "percentage", rateValue: 10 },
);

assert.equal(percentage.poolAmount, 10);
assert.equal(percentage.totalAmount, 10);
assert.deepEqual(percentage.allocations, [
  { amount: 3.34, key: "worker-a" },
  { amount: 3.33, key: "worker-b" },
  { amount: 3.33, key: "worker-c" },
]);

const percentageReordered = calculateStageContributions(
  [
    { key: "worker-c", creditedMinutes: 10, creditedUnits: 0 },
    { key: "worker-a", creditedMinutes: 10, creditedUnits: 0 },
    { key: "worker-b", creditedMinutes: 10, creditedUnits: 0 },
  ],
  { allocationBasis: "hours", itemValue: 100, method: "percentage", rateValue: 10 },
);
assert.deepEqual(percentageReordered.allocations, [
  { amount: 3.33, key: "worker-c" },
  { amount: 3.34, key: "worker-a" },
  { amount: 3.33, key: "worker-b" },
], "the one-paise remainder must follow stable worker-role key order, not UI row order");

const tinyPool = calculateStageContributions(
  [
    { key: "worker-a:role", creditedMinutes: 0, creditedUnits: 1 },
    { key: "worker-b:role", creditedMinutes: 0, creditedUnits: 1 },
    { key: "worker-c:role", creditedMinutes: 0, creditedUnits: 1 },
    { key: "worker-d:role", creditedMinutes: 0, creditedUnits: 1 },
  ],
  { allocationBasis: "units", itemValue: 2, method: "percentage", rateValue: 1 },
);
assert.deepEqual(tinyPool.allocations.map((entry) => entry.amount), [0.01, 0.01, 0, 0]);
assert.equal(tinyPool.totalAmount, 0.02, "a tiny pool must never over-allocate or create a negative final row");

assert.deepEqual(
  validateStageContributionAssignments(
    [
      { key: "worker-a", creditedMinutes: 0, creditedUnits: 0.6 },
      { key: "worker-b", creditedMinutes: 0, creditedUnits: 0.4 },
    ],
    { effortMode: "units", itemQuantity: 1, requireCompletion: true },
  ),
  [],
);

const incrementIssues = validateStageContributionAssignments(
  [{ key: "worker-a", creditedMinutes: 25, creditedUnits: 0.25 }],
  { effortMode: "hybrid", itemQuantity: 1, requireCompletion: false },
);
assert.match(incrementIssues.join(" "), /0\.10 increments/i);
assert.match(incrementIssues.join(" "), /10-minute increments/i);

const hybridCompletionIssues = validateStageContributionAssignments(
  [
    { key: "worker-a", creditedMinutes: 60, creditedUnits: 1 },
    { key: "worker-b", creditedMinutes: 0, creditedUnits: 1 },
  ],
  { effortMode: "hybrid", itemQuantity: 2, requireCompletion: true },
);
assert.match(hybridCompletionIssues.join(" "), /credited time is required for every contribution/i);

assert.equal(
  stageContributionDatabaseErrorMessage({
    code: "P0001",
    details: null,
    hint: null,
    message: "STALE_CONTRIBUTION_REVISION",
  }),
  "Someone else changed this stage while you were editing. Close the editor, review the latest values, and try again.",
  "structured Supabase errors must retain their user-facing stage contribution message",
);

console.log("Stage contribution calculation tests passed.");
