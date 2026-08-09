export type WorkerContributionMetric = "contribution" | "hours" | "stages" | "units";

export type WorkerContributionLog = {
  calculatedContributionAmount: number;
  completedAt: string;
  creditedMinutes: number;
  creditedUnits: number;
  rateConfigured: boolean;
  stageInstanceId: string;
  workerId: string;
};

export type WorkerContributionSummary = {
  completedStages: number;
  contributionAmount: number;
  creditedMinutes: number;
  creditedUnits: number;
  pricedAssignments: number;
  totalAssignments: number;
  workerId: string;
};

function rounded(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function mondayOfWeek(value: string) {
  const date = new Date(value);
  const dayFromMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayFromMonday);
  return date.toISOString().slice(0, 10);
}

export function aggregateWorkerContributions(logs: WorkerContributionLog[]) {
  const summaries = new Map<string, WorkerContributionSummary & { stageIds: Set<string> }>();

  for (const log of logs) {
    const summary = summaries.get(log.workerId) ?? {
      completedStages: 0,
      contributionAmount: 0,
      creditedMinutes: 0,
      creditedUnits: 0,
      pricedAssignments: 0,
      stageIds: new Set<string>(),
      totalAssignments: 0,
      workerId: log.workerId,
    };
    summary.contributionAmount = rounded(summary.contributionAmount + log.calculatedContributionAmount);
    summary.creditedMinutes += log.creditedMinutes;
    summary.creditedUnits = rounded(summary.creditedUnits + log.creditedUnits);
    summary.pricedAssignments += log.rateConfigured ? 1 : 0;
    summary.totalAssignments += 1;
    summary.stageIds.add(log.stageInstanceId);
    summaries.set(log.workerId, summary);
  }

  return [...summaries.values()]
    .map(({ stageIds, ...summary }) => ({ ...summary, completedStages: stageIds.size }))
    .sort((first, second) => first.workerId.localeCompare(second.workerId));
}

function logMetricValue(log: WorkerContributionLog, metric: WorkerContributionMetric) {
  if (metric === "contribution") return log.calculatedContributionAmount;
  if (metric === "hours") return log.creditedMinutes / 60;
  if (metric === "units") return log.creditedUnits;
  return 1;
}

export function buildWeeklyContributionTrend(
  logs: WorkerContributionLog[],
  workerIds: string[],
  metric: WorkerContributionMetric,
) {
  const weeks = new Map<string, { stageKeys: Set<string>; values: Record<string, number> }>();

  for (const log of logs) {
    if (!workerIds.includes(log.workerId)) continue;
    const weekStart = mondayOfWeek(log.completedAt);
    const week = weeks.get(weekStart) ?? {
      stageKeys: new Set<string>(),
      values: Object.fromEntries(workerIds.map((workerId) => [workerId, 0])),
    };
    const stageKey = `${log.workerId}:${log.stageInstanceId}`;
    if (metric !== "stages" || !week.stageKeys.has(stageKey)) {
      week.values[log.workerId] = rounded(week.values[log.workerId] + logMetricValue(log, metric), 6);
    }
    week.stageKeys.add(stageKey);
    weeks.set(weekStart, week);
  }

  return [...weeks.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([weekStart, week]) => ({ weekStart, values: week.values }));
}
