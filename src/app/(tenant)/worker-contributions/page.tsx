import { WorkerContributionsReportPage } from "@/app/(tenant)/dashboard/workers/page";

export default async function ManagerWorkerContributionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ end?: string; metric?: string; range?: string; start?: string; workers?: string | string[] }>;
}) {
  return WorkerContributionsReportPage({
    backHref: "/production",
    backLabel: "Back to production",
    basePath: "/worker-contributions",
    searchParams,
  });
}
