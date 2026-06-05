import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Factory,
  MessageSquareText,
  Ruler,
  ShieldCheck,
  Shirt,
  Users,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Boutique production management software | OS PLUS",
  description:
    "OS PLUS helps boutiques manage custom orders, item-level stitching workflows, measurements, workers, payments, GST visibility, and customer-safe tracking.",
};

const boutiqueModules = [
  {
    icon: ClipboardList,
    title: "Custom order intake",
    copy: "Create customer orders with promised dates, item rows, payments, GST treatment, and tracking links.",
  },
  {
    icon: Shirt,
    title: "Item-level production",
    copy: "Track each blouse, blazer, lehenga, alteration, or kurtha as its own production unit.",
  },
  {
    icon: Ruler,
    title: "Measurements and sizes",
    copy: "Store customer measurements, standard size templates, fit references, and production attachments.",
  },
  {
    icon: Factory,
    title: "Workflow stages",
    copy: "Configure cutting, stitching, embroidery, finishing, QC, packing, pickup, or any boutique-specific flow.",
  },
  {
    icon: Users,
    title: "Workers and salary",
    copy: "Keep attendance separate from work logs. Suggest salary, then let the owner/admin finalize payout.",
  },
  {
    icon: WalletCards,
    title: "Payments and GST visibility",
    copy: "Track collections, expenses, receivables, payables, GST snapshots, and accountant handoff exports.",
  },
];

const faqs = [
  [
    "Is OS PLUS only for boutiques?",
    "No. OS PLUS is a production and workflow business management platform. Boutiques are one focused industry use case because custom garments depend on orders, measurements, human stages, workers, delivery promises, and customer updates.",
  ],
  [
    "Can a boutique track multiple items in one customer order?",
    "Yes. The order is the commercial unit, while each order item is the production unit. A single customer order can include multiple items with different workflows and expected completion dates.",
  ],
  [
    "Does OS PLUS replace accounting software?",
    "No. OS PLUS gives operational finance visibility for payments, expenses, salary payouts, receivables, payables, and GST handoff reports. Direct statutory filing and full accounting integrations are later.",
  ],
  [
    "Do tailors or workers need logins?",
    "Not in the MVP. Managers and admins log work on behalf of workers, which keeps the first boutique rollout simpler and easier to control.",
  ],
  [
    "Can customers track their boutique order?",
    "Yes. Customers can open a token-based tracking page that shows safe public status, store branding, expected dates, pickup or delivery information, and contact options.",
  ],
];

function BoutiqueVisual() {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 p-3 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="rounded-lg bg-white p-4 text-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
          <div>
            <p className="text-xs font-medium text-zinc-500">Boutique order</p>
            <p className="text-xl font-semibold">#OS-2042</p>
          </div>
          <Badge className="rounded-md bg-[#f1663b] text-white">At risk</Badge>
        </div>
        <div className="mt-5 space-y-3">
          {[
            ["Designer blouse", "Cutting", "Due tomorrow"],
            ["Wedding lehenga", "Stitching", "Due Fri"],
            ["Alteration", "Ready", "Pickup today"],
          ].map(([item, stage, due]) => (
            <div
              key={item}
              className="grid grid-cols-[1fr_0.75fr_0.9fr] gap-2 rounded-lg border border-zinc-200 px-3 py-3 text-sm"
            >
              <span className="font-medium">{item}</span>
              <span className="rounded-md bg-zinc-100 px-2 py-1 text-center text-xs font-medium">
                {stage}
              </span>
              <span
                className={
                  due === "Due tomorrow"
                    ? "font-medium text-[#c74e2d]"
                    : "text-zinc-500"
                }
              >
                {due}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            ["Fit reference", "Customer measurement"],
            ["Assigned workers", "Master, tailor"],
            ["Balance", "Rs. 6,200"],
            ["Customer sees", "In production"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-zinc-100 p-3">
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="mt-1 font-medium">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BoutiqueIndustryPage() {
  return (
    <main className="min-h-[100dvh] bg-[#f7f7f4] text-zinc-950">
      <header className="border-b border-black/10 bg-[#f7f7f4]/95">
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
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="outline"
              className="hidden h-10 rounded-lg border-zinc-300 text-zinc-950 hover:bg-zinc-100 sm:inline-flex"
            >
              <Link href="/">Main platform</Link>
            </Button>
            <Button
              asChild
              className="h-10 rounded-lg bg-zinc-950 text-white hover:bg-zinc-800"
            >
              <Link href="/dashboard">Open workspace</Link>
            </Button>
          </div>
        </nav>
      </header>

      <section className="bg-zinc-950 px-4 py-20 text-white md:px-6">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-[#ffb199]">
              Boutique production management
            </p>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.03] md:text-7xl">
              Run every boutique order from measurement to pickup.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              OS PLUS helps boutiques manage custom orders, item-level
              workflows, workers, salary, payments, GST visibility, and
              customer-safe tracking.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                className="h-12 rounded-lg bg-[#f1663b] px-5 text-white hover:bg-[#d95731]"
              >
                <Link href="#faq">
                  Read FAQs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-12 rounded-lg border-white/25 bg-white/5 px-5 text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/">See OS PLUS platform</Link>
              </Button>
            </div>
          </div>
          <BoutiqueVisual />
        </div>
      </section>

      <section className="px-4 py-20 md:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <h2 className="text-4xl font-semibold leading-tight md:text-5xl">
              Built for the messiest boutique handoffs.
            </h2>
            <p className="mt-5 text-lg leading-8 text-zinc-600">
              A boutique order can carry measurements, references, multiple
              garments, specialist workers, urgent delivery promises, partial
              payments, and customer follow-ups. OS PLUS keeps those moving
              parts connected.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {boutiqueModules.map((module) => (
              <div
                key={module.title}
                className="rounded-xl border border-zinc-200 bg-white p-6"
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

      <section className="bg-white px-4 py-20 md:px-6">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <ShieldCheck className="h-8 w-8 text-[#c74e2d]" strokeWidth={1.8} />
            <h2 className="mt-5 text-4xl font-semibold leading-tight">
              Customer tracking stays safe.
            </h2>
            <p className="mt-5 text-lg leading-8 text-zinc-600">
              Tracking links can show order progress, expected dates, pickup or
              delivery details, store branding, and contact options. Internal
              notes, workers, salary, and measurements stay private.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-[#f7f7f4] p-6">
            <MessageSquareText
              className="h-6 w-6 text-[#c74e2d]"
              strokeWidth={1.8}
            />
            <p className="mt-5 text-xl font-semibold">
              A cleaner answer to customer readiness calls.
            </p>
            <p className="mt-3 leading-7 text-zinc-600">
              Staff can share a customer-safe page instead of sending ad hoc
              updates from memory. The customer sees simplified status while the
              boutique keeps internal production detail protected.
            </p>
          </div>
        </div>
      </section>

      <section id="faq" className="px-4 py-20 md:px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-4xl font-semibold leading-tight">
            Boutique management FAQs
          </h2>
          <div className="mt-8 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
            {faqs.map(([question, answer]) => (
              <details key={question} className="group p-5">
                <summary className="cursor-pointer list-none font-semibold">
                  {question}
                </summary>
                <p className="mt-3 leading-7 text-zinc-600">{answer}</p>
              </details>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              className="h-12 rounded-lg bg-zinc-950 px-5 text-white hover:bg-zinc-800"
            >
              <Link href="/">
                View main platform
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
      </section>

      <footer className="border-t border-zinc-200 px-4 py-8 md:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-zinc-600 md:flex-row md:items-center md:justify-between">
          <p className="font-medium text-zinc-950">OS PLUS</p>
          <p>
            Boutique page for the broader OS PLUS production management
            platform.
          </p>
        </div>
      </footer>
    </main>
  );
}
