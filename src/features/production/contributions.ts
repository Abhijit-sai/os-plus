export type StageEffortMode = "none" | "units" | "hours" | "hybrid";
export type ContributionMethod = "per_unit" | "per_hour" | "percentage";
export type ContributionAllocationBasis = "units" | "hours";

export type ContributionAssignmentInput = {
  key: string;
  creditedMinutes: number;
  creditedUnits: number;
};

export type ContributionRuleInput = {
  allocationBasis: ContributionAllocationBasis;
  itemValue: number;
  method: ContributionMethod;
  rateValue: number;
};

export type ContributionValidationOptions = {
  effortMode: StageEffortMode;
  itemQuantity: number;
  requireCompletion: boolean;
};

const databaseErrorMessages: Array<[string, string]> = [
  ["AT_LEAST_ONE_WORKER_REQUIRED", "Add at least one worker."],
  ["DUPLICATE_WORKER_ROLE", "The same worker and role can appear only once."],
  ["MULTIPLE_WORKERS_NOT_ALLOWED", "This workflow stage is not configured for multiple workers."],
  ["WORKER_NOT_ELIGIBLE_FOR_STAGE", "A selected worker is inactive or does not belong to this tenant."],
  ["WORKGROUP_NOT_ELIGIBLE_FOR_STAGE", "A selected role is no longer eligible for this stage."],
  ["INVALID_CREDITED_UNIT_INCREMENT", "Unit credits must use 0.10 increments."],
  ["INVALID_CREDITED_MINUTE_INCREMENT", "Time credits must use 10-minute increments."],
  ["UNIT_CREDIT_REQUIRED_FOR_EVERY_WORKER", "Enter credited units for every selected worker."],
  ["TIME_CREDIT_REQUIRED_FOR_EVERY_WORKER", "Enter credited time for every selected worker."],
  ["UNIT_TOTAL_EXCEEDS_ITEM_QUANTITY", "Credited units cannot exceed the item quantity."],
  ["UNIT_TOTAL_MUST_EQUAL_ITEM_QUANTITY", "Before completing, credited units must equal the item quantity."],
  ["EFFORT_REMOVAL_REASON_REQUIRED", "Explain why a worker with recorded effort is being removed."],
  ["CORRECTION_REASON_REQUIRED", "A correction reason is required for a completed stage."],
  ["COMPLETED_CONTRIBUTION_CORRECTION_NOT_ALLOWED", "Only an owner or admin can correct a completed stage."],
  ["LEGACY_COMPLETED_STAGE_IMMUTABLE", "This historical completed stage predates contribution tracking and cannot be backfilled."],
  ["STALE_CONTRIBUTION_REVISION", "Someone else changed this stage while you were editing. Close the editor, review the latest values, and try again."],
  ["STAGE_CONTRIBUTIONS_NOT_EDITABLE", "Contributions can be edited only while a stage is in progress or after completion by an owner/admin."],
  ["STAGE_NOT_READY", "This stage is no longer ready to start. Refresh and review the workflow."],
  ["STAGE_NOT_IN_PROGRESS", "This stage is no longer in progress. Refresh and review the workflow."],
  ["RULE_INCOMPATIBLE_WITH_STAGE_EFFORT_MODE", "The contribution rule no longer matches this stage's effort mode. Update the configuration before starting."],
  ["IDEMPOTENCY_KEY_FINGERPRINT_MISMATCH", "This save token was already used for different data. Close and reopen the editor, then try again."],
  ["STAGE_NOT_FOUND", "This stage does not belong to the current tenant."],
];

export function stageContributionDatabaseErrorMessage(error: unknown) {
  const raw = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : error && typeof error === "object"
        ? ["message", "details", "hint", "code"]
            .map((field) => Reflect.get(error, field))
            .filter((value): value is string => typeof value === "string")
            .join(" ")
        : String(error);
  return databaseErrorMessages.find(([code]) => raw.includes(code))?.[1] ?? null;
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateStageContributions(
  assignments: ContributionAssignmentInput[],
  rule: ContributionRuleInput | null,
) {
  if (!rule) {
    return {
      allocations: assignments.map((assignment) => ({ amount: 0, key: assignment.key })),
      poolAmount: 0,
      totalAmount: 0,
    };
  }

  const poolAmount = rule.method === "percentage"
    ? money((rule.itemValue * rule.rateValue) / 100)
    : 0;
  const weights = assignments.map((assignment) => (
    rule.allocationBasis === "units" ? assignment.creditedUnits : assignment.creditedMinutes
  ));
  const positiveWeightIndexes = weights
    .map((weight, index) => ({ index, weight }))
    .filter(({ weight }) => weight > 0)
    .sort((first, second) => assignments[first.index].key.localeCompare(assignments[second.index].key));
  const totalWeight = positiveWeightIndexes.reduce((sum, entry) => sum + entry.weight, 0);
  const percentageAmounts = assignments.map(() => 0);

  if (rule.method === "percentage" && totalWeight > 0) {
    const poolPaise = Math.round(poolAmount * 100);
    const shares = positiveWeightIndexes.map(({ index, weight }) => {
      const rawPaise = (poolPaise * weight) / totalWeight;
      const floorPaise = Math.floor(rawPaise);
      return { floorPaise, fractionalRemainder: rawPaise - floorPaise, index };
    });
    let remainderPaise = poolPaise - shares.reduce((sum, share) => sum + share.floorPaise, 0);
    const remainderOrder = [...shares].sort((first, second) =>
      second.fractionalRemainder - first.fractionalRemainder
        || assignments[first.index].key.localeCompare(assignments[second.index].key));

    remainderOrder.forEach((share) => {
      const extraPaise = remainderPaise > 0 ? 1 : 0;
      percentageAmounts[share.index] = (share.floorPaise + extraPaise) / 100;
      remainderPaise -= extraPaise;
    });
  }

  const allocations = assignments.map((assignment, index) => {
    let amount = 0;
    if (rule.method === "per_unit") {
      amount = money(assignment.creditedUnits * rule.rateValue);
    } else if (rule.method === "per_hour") {
      amount = money((assignment.creditedMinutes / 60) * rule.rateValue);
    } else if (weights[index] > 0 && totalWeight > 0) {
      amount = percentageAmounts[index];
    }

    return { amount, key: assignment.key };
  });

  return {
    allocations,
    poolAmount: rule.method === "percentage" ? poolAmount : money(allocations.reduce((sum, allocation) => sum + allocation.amount, 0)),
    totalAmount: money(allocations.reduce((sum, allocation) => sum + allocation.amount, 0)),
  };
}

export function validateStageContributionAssignments(
  assignments: ContributionAssignmentInput[],
  options: ContributionValidationOptions,
) {
  const issues: string[] = [];
  const totalUnits = assignments.reduce((sum, assignment) => sum + assignment.creditedUnits, 0);
  const tracksUnits = options.effortMode === "units" || options.effortMode === "hybrid";
  const tracksHours = options.effortMode === "hours" || options.effortMode === "hybrid";

  if (tracksUnits && assignments.some((assignment) => !Number.isFinite(assignment.creditedUnits) || assignment.creditedUnits < 0 || Math.abs(assignment.creditedUnits * 10 - Math.round(assignment.creditedUnits * 10)) > 0.0001)) {
    issues.push("Credited units must use non-negative 0.10 increments.");
  }
  if (tracksHours && assignments.some((assignment) => !Number.isInteger(assignment.creditedMinutes) || assignment.creditedMinutes < 0 || assignment.creditedMinutes % 10 !== 0)) {
    issues.push("Credited time must use non-negative 10-minute increments.");
  }
  if (options.requireCompletion && tracksUnits && assignments.some((assignment) => assignment.creditedUnits <= 0)) {
    issues.push("Credited units are required for every contribution before completion.");
  }
  if (options.requireCompletion && tracksHours && assignments.some((assignment) => assignment.creditedMinutes <= 0)) {
    issues.push("Credited time is required for every contribution before completion.");
  }

  if (
    options.requireCompletion
    && tracksUnits
    && Math.abs(totalUnits - options.itemQuantity) > 0.0001
  ) {
    issues.push(`Credited units must total ${options.itemQuantity} before completion.`);
  }

  return issues;
}
