import Link from "next/link";
import {
  ArrowRight,
  BadgeIndianRupee,
  CheckCircle2,
  ClipboardList,
  Factory,
  LockKeyhole,
  MessageSquareText,
  TimerReset,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const workflowStages = [
  { label: "Intake", tone: "bg-zinc-950 text-white" },
  { label: "Build", tone: "bg-white text-zinc-950" },
  { label: "QC", tone: "bg-white text-zinc-950" },
  { label: "Pack", tone: "bg-white text-zinc-950" },
  { label: "Ready", tone: "bg-[#f1663b] text-white" },
];

const modules = [
  {
    icon: ClipboardList,
    title: "Orders stay commercial",
    copy: "Capture customer, promise date, payments, GST treatment, delivery type, and tracking token in one controlled order record.",
  },
  {
    icon: Factory,
    title: "Jobs run production",
    copy: "Each job, item, batch, or service unit gets its own workflow, expected completion date, attachments, and customer-facing status.",
  },
  {
    icon: Factory,
    title: "Stages match your floor",
    copy: "Configure internal stages, allowed teams, assigned workers, and customer-safe status mapping without forcing a generic board.",
  },
  {
    icon: Users,
    title: "Workers are operational resources",
    copy: "Managers log work on behalf of workers. Attendance, work logs, advances, and salary suggestions stay separate.",
  },
  {
    icon: BadgeIndianRupee,
    title: "Finance is practical",
    copy: "Track collections, expenses, salary payouts, receivables, payables, GST snapshots, and accountant handoff reports.",
  },
  {
    icon: LockKeyhole,
    title: "Tenant safety is built in",
    copy: "Clerk handles identity. OS PLUS controls tenant membership, roles, disabled access, and active business selection.",
  },
];

const comparisonRows = [
  [
    "Accounting tools",
    "Money is visible. Production status disappears into notes, calls, and spreadsheets.",
  ],
  [
    "Project boards",
    "Tasks move. Customers, payments, workers, delivery promises, and job history stay outside.",
  ],
  [
    "Generic CRMs",
    "Leads are tracked. The production floor still has no unit-level operating truth.",
  ],
  [
    "OS PLUS",
    "Orders, production units, workers, finance, and customer tracking share one operating model.",
  ],
];

const pilotChecks = [
  "Multi-tenant from day one",
  "Email-based tenant membership",
  "Inactive tenant blocking",
  "Item-level workflow execution",
  "Salary suggested and admin-finalized",
  "GST accountant handoff export",
  "Token-based public tracking",
  "Industry pages without changing the core product model",
];

function OperationsVisual() {
  return (
    <div className="relative mx-auto mt-8 w-full max-w-6xl overflow-hidden rounded-xl border border-white/15 bg-zinc-950/65 p-3 shadow-2xl shadow-black/30 backdrop-blur md:mt-10">
      <div className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-lg bg-white p-4 text-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
            <div>
              <p className="text-xs font-medium text-zinc-500">
                Production queue
              </p>
              <p className="text-lg font-semibold">Northline Works</p>
            </div>
            <Badge className="rounded-md" variant="outline">
              Today
            </Badge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ["18", "jobs active"],
              ["4", "due soon"],
              ["2", "need attention"],
            ].map(([value, label]) => (
              <div
                key={label}
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-3"
              >
                <p className="text-2xl font-semibold">{value}</p>
                <p className="text-xs text-zinc-500">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {[
              ["#OS-1048", "Repair batch", "Due Fri", "QC"],
              ["#OS-1049", "Custom cabinet", "At risk", "Assembly"],
              ["#OS-1050", "Packaging run", "Ready", "Dispatch"],
            ].map(([order, item, due, stage]) => (
              <div
                key={order}
                className="grid grid-cols-[0.7fr_1.1fr_0.7fr_0.8fr] items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              >
                <span className="font-medium">{order}</span>
                <span className="truncate text-zinc-600">{item}</span>
                <span
                  className={
                    due === "At risk"
                      ? "font-medium text-[#c74e2d]"
                      : "text-zinc-500"
                  }
                >
                  {due}
                </span>
                <span className="rounded-md bg-zinc-100 px-2 py-1 text-center text-xs font-medium">
                  {stage}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-zinc-900 p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-400">
                Production workflow
              </p>
              <p className="text-lg font-semibold">Custom cabinet</p>
            </div>
            <Badge className="rounded-md bg-[#f1663b] text-white">
              Customer sees: In production
            </Badge>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {workflowStages.map((stage) => (
              <div
                key={stage.label}
                className={`rounded-lg border border-white/15 px-2 py-3 text-center text-xs font-medium ${stage.tone}`}
              >
                {stage.label}
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-zinc-400">Assigned workers</p>
              <p className="mt-1 font-medium">Operator, QC lead</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-zinc-400">Balance pending</p>
              <p className="mt-1 font-medium">Rs. 8,500</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-zinc-400">Fit reference</p>
              <p className="mt-1 font-medium">Job specification</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-zinc-400">Tracking</p>
              <p className="mt-1 font-medium">Safe public link</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-[100dvh] bg-[#f7f7f4] text-zinc-950">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-black/10 bg-[#f7f7f4]/90 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="OS PLUS home"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-950 text-sm font-semibold text-white">
              OS
            </span>
            <span className="text-sm font-semibold tracking-wide">OS PLUS</span>
          </Link>
          <div className="hidden items-center gap-6 text-sm font-medium text-zinc-600 md:flex">
            <Link href="#model" className="hover:text-zinc-950">
              Model
            </Link>
            <Link href="#modules" className="hover:text-zinc-950">
              Modules
            </Link>
            <Link href="/industries/boutiques" className="hover:text-zinc-950">
              Industries
            </Link>
            <Link href="#pilot" className="hover:text-zinc-950">
              Pilot
            </Link>
          </div>
          <Button
            asChild
            className="h-10 rounded-lg bg-zinc-950 text-white hover:bg-zinc-800"
          >
            <Link href="/dashboard">
              Open workspace
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </nav>
      </header>

      <section className="relative overflow-hidden bg-zinc-950 px-4 pb-16 pt-24 text-white md:px-6 md:pb-20">
        <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(115deg,transparent_0%,transparent_38%,rgba(241,102,59,0.42)_38%,rgba(241,102,59,0.42)_52%,transparent_52%),linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:100%_100%,72px_72px,72px_72px]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="max-w-4xl">
            <p className="text-sm font-medium uppercase tracking-wide text-[#ffb199]">
              OS PLUS
            </p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-normal md:text-7xl">
              Production management for work that moves through people and
              stages.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300 md:text-xl">
              Run orders, jobs, batches, workers, attendance, salary, finance,
              and customer tracking from one tenant-safe workspace.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                className="h-12 rounded-lg bg-[#f1663b] px-5 text-white hover:bg-[#d95731]"
              >
                <Link href="#pilot">
                  Plan a pilot
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-12 rounded-lg border-white/25 bg-white/5 px-5 text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="#model">See the model</Link>
              </Button>
            </div>
          </div>
          <OperationsVisual />
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-white px-4 py-14 md:px-6">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-4">
          {comparisonRows.map(([tool, gap]) => (
            <div
              key={tool}
              className={
                tool === "OS PLUS"
                  ? "rounded-xl border border-zinc-950 bg-zinc-950 p-5 text-white"
                  : "rounded-xl border border-zinc-200 bg-white p-5"
              }
            >
              <p className="font-semibold">{tool}</p>
              <p
                className={
                  tool === "OS PLUS"
                    ? "mt-3 text-sm leading-6 text-zinc-300"
                    : "mt-3 text-sm leading-6 text-zinc-600"
                }
              >
                {gap}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="model" className="px-4 py-20 md:px-6">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-[#c74e2d]">
              Operating model
            </p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">
              Built around the way real production work moves.
            </h2>
            <p className="mt-5 text-lg leading-8 text-zinc-600">
              A growing production business does not need a swollen ERP. It
              needs a trusted daily system where the order, job, worker,
              payment, and customer view all agree.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              [
                "Order",
                "The commercial unit: customer, total value, payments, GST, delivery promise.",
              ],
              [
                "Order item",
                "The production unit: job, item, batch, service unit, workflow, stage, worker work, and due risk.",
              ],
              [
                "Internal workflow",
                "Detailed enough for the floor: intake, assembly, repair, QC, packing, dispatch.",
              ],
              [
                "Customer status",
                "Simple enough for the buyer: confirmed, in production, ready, delivered.",
              ],
            ].map(([title, copy]) => (
              <div
                key={title}
                className="rounded-xl border border-zinc-200 bg-white p-6"
              >
                <p className="text-xl font-semibold">{title}</p>
                <p className="mt-3 leading-7 text-zinc-600">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="modules" className="bg-white px-4 py-20 md:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <h2 className="text-4xl font-semibold leading-tight md:text-5xl">
              One calm workspace instead of six half-connected tools.
            </h2>
            <p className="mt-5 text-lg leading-8 text-zinc-600">
              OS PLUS keeps module boundaries clear, so founders can review
              first and open complex forms only when they are ready to act.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((module) => (
              <div
                key={module.title}
                className="rounded-xl border border-zinc-200 bg-[#f7f7f4] p-6"
              >
                <module.icon
                  className="h-6 w-6 text-[#c74e2d]"
                  strokeWidth={1.8}
                />
                <h3 className="mt-5 text-xl font-semibold">{module.title}</h3>
                <p className="mt-3 leading-7 text-zinc-600">{module.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 md:px-6">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950 text-white lg:grid-cols-[0.95fr_1.05fr]">
          <div className="p-8 md:p-10">
            <MessageSquareText
              className="h-8 w-8 text-[#ffb199]"
              strokeWidth={1.8}
            />
            <h2 className="mt-6 text-4xl font-semibold leading-tight">
              Customer tracking without exposing the workshop.
            </h2>
            <p className="mt-5 text-lg leading-8 text-zinc-300">
              Public links are token-based and customer-safe. Workers, salary,
              internal notes, measurements, and internal attachments stay
              private.
            </p>
          </div>
          <div className="border-t border-white/10 p-8 md:p-10 lg:border-l lg:border-t-0">
            <div className="rounded-xl bg-white p-5 text-zinc-950">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
                <div>
                  <p className="text-sm text-zinc-500">Customer view</p>
                  <p className="text-xl font-semibold">Order #OS-1050</p>
                </div>
                <Badge className="rounded-md bg-[#f1663b] text-white">
                  Ready
                </Badge>
              </div>
              <div className="mt-5 space-y-4">
                {[
                  "Order confirmed",
                  "In production",
                  "Finishing",
                  "Ready for pickup",
                ].map((item, index) => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircle2
                      className={
                        index < 4
                          ? "h-5 w-5 text-[#c74e2d]"
                          : "h-5 w-5 text-zinc-300"
                      }
                    />
                    <span className="text-sm font-medium">{item}</span>
                  </div>
                ))}
              </div>
              <p className="mt-6 rounded-lg bg-zinc-100 p-3 text-sm text-zinc-600">
                Pickup type, expected date, store branding, and contact CTA
                only.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="pilot" className="bg-white px-4 py-20 md:px-6">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-[#c74e2d]">
              Pilot readiness
            </p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">
              Made for production businesses that need discipline without
              enterprise weight.
            </h2>
            <p className="mt-5 text-lg leading-8 text-zinc-600">
              The MVP focuses on trust, tenant safety, role correctness, finance
              clarity, production visibility, and founder confidence.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                className="h-12 rounded-lg bg-zinc-950 px-5 text-white hover:bg-zinc-800"
              >
                <Link href="/dashboard">
                  Open workspace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-12 rounded-lg border-zinc-300 px-5 text-zinc-950 hover:bg-zinc-100"
              >
                <Link href="/select-tenant">Select business</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-[#f7f7f4] p-6">
            <div className="flex items-center gap-3">
              <TimerReset
                className="h-6 w-6 text-[#c74e2d]"
                strokeWidth={1.8}
              />
              <p className="text-xl font-semibold">Current pilot guardrails</p>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {pilotChecks.map((item) => (
                <div
                  key={item}
                  className="flex gap-3 rounded-lg bg-white p-3 text-sm"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#c74e2d]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm leading-6 text-zinc-600">
              Direct GST filing, inventory, marketplace sync, worker login, and
              customer login stay outside the MVP until the operating core is
              proven. Industry-specific pages can speak to boutiques,
              fabrication, repairs, studios, print shops, and workshops without
              changing the core OS PLUS model.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-200 px-4 py-8 md:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-zinc-600 md:flex-row md:items-center md:justify-between">
          <p className="font-medium text-zinc-950">OS PLUS</p>
          <p>
            Workflow operating system for small production and assembly-driven
            businesses.
          </p>
        </div>
      </footer>
    </main>
  );
}
