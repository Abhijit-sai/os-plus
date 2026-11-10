import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  ListChecks,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  AddSetupRecordForm,
  BoutiqueProfileForm,
} from "@/components/onboarding/setup-forms";
import { SetupWorkflowBuilder } from "@/components/onboarding/workflow-builder";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { saveSetupProgress } from "@/features/onboarding/actions";
import {
  setupSteps,
  suggestedGarments,
  type SetupStep,
} from "@/features/onboarding/model";
import { getBoutiqueSetup } from "@/features/onboarding/queries";
import { cn } from "@/lib/utils";

type Setup = Awaited<ReturnType<typeof getBoutiqueSetup>>;

const copy = {
  overview: [
    "Complete your onboarding",
    "Continue setup for this boutique. You can return here at any time.",
  ],
  boutique: [
    "Let’s set up your boutique.",
    "Start with a few details about your shop. You can change them later.",
  ],
  garments: [
    "What do you sell?",
    "Add the garments you make or sell. Each garment can have several production workflows.",
  ],
  teams: [
    "Who does the work?",
    "Create employee workgroups before you assign them to production stages.",
  ],
  flows: [
    "How do you make it?",
    "Pick a garment, then use the five-stage starter or create a custom workflow.",
  ],
  review: [
    "See what’s ready.",
    "Get one garment ready for your first order. The rest can follow when you need them.",
  ],
};

function stepLink(step: SetupStep | "overview", garment?: string) {
  return `/onboarding?step=${step}${garment ? `&garment=${garment}` : ""}`;
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="p-4 sm:p-5">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
        {children}
      </CardContent>
    </Card>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950">
      <CircleHelp className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function ProgressButton({
  tenantId,
  step,
  exit,
  children,
  variant = "default",
}: {
  tenantId: string;
  step: SetupStep;
  exit?: boolean;
  children: ReactNode;
  variant?: "default" | "ghost" | "outline";
}) {
  return (
    <form action={saveSetupProgress}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="step" value={step} />
      {exit ? <input type="hidden" name="exit" value="yes" /> : null}
      <Button className="min-h-11" variant={variant}>
        {children}
      </Button>
    </form>
  );
}

function ProductionStep({
  data,
  selectedId,
}: {
  data: Setup;
  selectedId?: string;
}) {
  const garment =
    data.garments.find((entry) => entry.id === selectedId) ?? data.garments[0];
  if (!garment)
    return (
      <Panel title="Choose a garment first">
        <Button asChild>
          <Link href={stepLink("garments")}>Add a garment</Link>
        </Button>
      </Panel>
    );

  return (
    <>
      <Hint>
        Stages are assigned to{" "}
        <Link className="font-medium underline" href={stepLink("teams")}>
          employee workgroups
        </Link>
        . Existing stages share their assignments across workflows. Manage those
        assignments in{" "}
        <Link className="font-medium underline" href="/settings/workflows">
          Workflow settings
        </Link>
        .
      </Hint>
      <div className="grid items-start gap-4 lg:grid-cols-[9rem_minmax(0,1fr)]">
        <nav aria-label="Garments" className="flex flex-wrap gap-2 lg:flex-col">
          {data.garments.map((entry) => (
            <Link
              key={entry.id}
              href={stepLink("flows", entry.id)}
              aria-current={entry.id === garment.id ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2 break-words rounded-lg border bg-background px-3 py-2 text-sm font-medium",
                entry.id === garment.id
                  ? "border-emerald-700 bg-emerald-50 text-emerald-950"
                  : "hover:bg-accent",
              )}
            >
              {entry.name}
            </Link>
          ))}
        </nav>
        <div className="min-w-0 space-y-4">
          {garment.workflows.length ? (
            <Panel
              title={`${garment.name} workflows`}
              description="Choose any saved workflow when creating an order."
            >
              <ul className="divide-y">
                {garment.workflows.map((flow) => (
                  <li
                    key={flow.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium">
                        {flow.name}
                        {flow.is_default ? " · Default" : ""}
                        {flow.item_type_id === null ? " · Shared" : ""}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {flow.stageNames.length} stages
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/settings/workflows/${flow.id}?onboarding=${garment.id}`}
                      >
                        Edit workflow
                        <span className="sr-only"> {flow.name}</span>
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
          <Panel
            title={`New workflow for ${garment.name}`}
            description="Edit the suggested stages before saving, or start from scratch."
          >
            <SetupWorkflowBuilder
              key={garment.id}
              tenantId={data.tenantId}
              garment={garment}
              stages={data.stages}
              groups={data.groups}
              firstWorkflow={
                !garment.workflows.some(
                  (flow) => flow.item_type_id === garment.id,
                )
              }
            />
          </Panel>
        </div>
      </div>
    </>
  );
}

export default async function BoutiqueOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; garment?: string }>;
}) {
  const [data, params] = await Promise.all([getBoutiqueSetup(), searchParams]);
  const ready = data.garments.filter((garment) => garment.ready);
  const complete = {
    boutique: Boolean(data.storeName.trim()),
    garments: data.garments.length > 0,
    teams: data.workers.some((worker) => worker.groups.length > 0),
    flows: data.garments.some((garment) =>
      garment.workflows.some(
        (flow) => flow.stageNames.length && flow.issue?.step !== "flows",
      ),
    ),
    review: ready.length > 0,
  };
  const savedStep = setupSteps.find(
    (entry) => entry.id === data.setup?.last_step,
  )?.id;
  const nextStep =
    setupSteps.find((entry) => !complete[entry.id])?.id ?? "review";
  const step =
    params.step === "overview"
      ? "overview"
      : (setupSteps.find((entry) => entry.id === params.step)?.id ??
        savedStep ??
        (ready.length ? "review" : "boutique"));
  const index = setupSteps.findIndex((entry) => entry.id === step);
  const next = setupSteps[index + 1];
  const previous = setupSteps[index - 1];
  const [heading, description] = copy[step];

  return (
    <div className="mx-auto max-w-6xl overflow-hidden rounded-xl border bg-stone-50 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)]">
      <aside className="bg-[#203129] p-3 text-white sm:p-4 lg:p-5">
        <Link
          href={stepLink("overview")}
          className="mb-3 flex min-h-9 items-center gap-2 text-sm font-medium text-emerald-50"
        >
          <ListChecks className="size-4" /> Setup checklist
        </Link>
        <p className="mb-2 truncate text-xs text-emerald-100">
          {data.storeName}
        </p>
        <nav
          aria-label="Onboarding steps"
          className="flex flex-wrap gap-1 lg:flex-col"
        >
          {setupSteps.map((entry, position) => (
            <Link
              key={entry.id}
              href={stepLink(entry.id)}
              aria-current={step === entry.id ? "step" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-white/10",
                step === entry.id && "bg-white/15 font-medium",
              )}
            >
              <span
                aria-hidden
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-emerald-100/40 text-xs"
              >
                {complete[entry.id] ? (
                  <Check className="size-3.5" />
                ) : (
                  position + 1
                )}
              </span>
              {entry.label}
              <span className="sr-only">
                {complete[entry.id] ? " complete" : ""}
              </span>
            </Link>
          ))}
        </nav>
      </aside>
      <section className="min-w-0 space-y-5 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-900">
              {index < 0
                ? "Boutique setup"
                : `Step ${index + 1} of ${setupSteps.length}`}
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              {step === "review" && ready.length
                ? "Ready to take your first order."
                : heading}
            </h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              {step === "review" && ready.length
                ? `${ready[0].name} has a workflow and workers for every stage.`
                : description}
            </p>
          </div>
          {step !== "overview" ? (
            <ProgressButton
              tenantId={data.tenantId}
              step={step}
              exit
              variant="ghost"
            >
              Save place &amp; exit
            </ProgressButton>
          ) : null}
        </div>

        {step === "overview" ? (
          <Panel title="Setup progress">
            <Button asChild>
              <Link href={stepLink(savedStep ?? nextStep)}>
                Resume setup <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <ul className="divide-y">
              {setupSteps.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <Link
                    className="font-medium underline-offset-4 hover:underline"
                    href={stepLink(entry.id)}
                  >
                    {entry.label}
                  </Link>
                  <span className="text-muted-foreground">
                    {complete[entry.id] ? "Complete" : "To do"}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        {step === "boutique" ? (
          <Panel title="Shop details">
            <BoutiqueProfileForm
              key={data.tenantId}
              tenantId={data.tenantId}
              storeName={data.storeName}
              saved={data.setup?.profile ?? null}
            />
          </Panel>
        ) : null}

        {step === "garments" ? (
          <Panel
            title="Garment types"
            description="Start with one garment. Add more whenever you need them."
          >
            {data.garments.length ? (
              <ul className="flex flex-wrap gap-2">
                {data.garments.map((garment) => (
                  <li
                    key={garment.id}
                    className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-950"
                  >
                    {garment.name}
                  </li>
                ))}
              </ul>
            ) : null}
            <AddSetupRecordForm
              tenantId={data.tenantId}
              kind="garment"
              suggestions={suggestedGarments.filter(
                (name) =>
                  !data.garments.some(
                    (garment) =>
                      garment.name.toLowerCase() === name.toLowerCase(),
                  ),
              )}
            />
            <Link
              className="text-sm font-medium underline"
              href="/settings/item-types"
            >
              Manage existing garments
            </Link>
          </Panel>
        ) : null}

        {step === "teams" ? (
          <>
            <Hint>
              In OS PLUS, <strong>workgroups</strong> are the people who can do
              a particular kind of production work. Start with one group called{" "}
              <strong>Production</strong>, or use groups like Cutting and
              Stitching. A worker can belong to more than one.
            </Hint>
            <Panel
              title="Workgroups"
              description="You’ll choose one of these when you add a production stage."
            >
              {data.groups.length ? (
                <ul className="flex flex-wrap gap-2">
                  {data.groups.map((group) => (
                    <li
                      key={group.id}
                      className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-950"
                    >
                      {group.name}
                    </li>
                  ))}
                </ul>
              ) : null}
              <AddSetupRecordForm
                tenantId={data.tenantId}
                kind="workgroup"
                suggestions={data.groups.length ? [] : ["Production"]}
              />
            </Panel>
            <Panel
              title="Workers"
              description="Add the people who do the work. Set pay details in Workers and invite staff to sign in separately."
            >
              {data.workers.length ? (
                <ul className="divide-y text-sm">
                  {data.workers.map((worker) => (
                    <li
                      className="flex flex-wrap justify-between gap-2 py-2"
                      key={worker.id}
                    >
                      <span>{worker.name}</span>
                      <span className="text-muted-foreground">
                        {worker.groups.map((group) => group.name).join(", ") ||
                          "No workgroup"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {data.groups.length ? (
                <AddSetupRecordForm
                  tenantId={data.tenantId}
                  kind="worker"
                  groups={data.groups}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Add a workgroup above to assign your first worker.
                </p>
              )}
              <div className="flex flex-wrap gap-4 text-sm">
                <Link className="underline" href="/workers">
                  Manage workers
                </Link>
                <Link className="underline" href="/settings/users">
                  Invite staff
                </Link>
              </div>
            </Panel>
          </>
        ) : null}

        {step === "flows" ? (
          <ProductionStep data={data} selectedId={params.garment} />
        ) : null}

        {step === "review" ? (
          <>
            <Panel
              title="Garment readiness"
              description="A garment is ready when one workflow has a stage sequence and an eligible worker at every stage."
            >
              {data.garments.length ? (
                <ul className="divide-y">
                  {data.garments.map((garment) => (
                    <li
                      className="space-y-1 py-3 first:pt-0 last:pb-0"
                      key={garment.id}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{garment.name}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-1 text-xs",
                            garment.ready
                              ? "bg-emerald-50 text-emerald-950"
                              : "bg-amber-50 text-amber-900",
                          )}
                        >
                          {garment.ready ? "Ready" : "Needs setup"}
                        </span>
                      </div>
                      {garment.ready ? (
                        <details className="text-sm text-muted-foreground">
                          <summary className="cursor-pointer">
                            {garment.ready.name} · Preview workflow
                          </summary>
                          <ol className="ml-5 mt-2 list-decimal">
                            {garment.ready.stageNames.map((stage, number) => (
                              <li key={number}>{stage}</li>
                            ))}
                          </ol>
                        </details>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {garment.blocker.text}{" "}
                          <Link
                            className="font-medium underline"
                            href={stepLink(garment.blocker.step, garment.id)}
                          >
                            Fix setup
                          </Link>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <Button asChild variant="outline">
                  <Link href={stepLink("garments")}>Add a garment</Link>
                </Button>
              )}
              {ready.length ? (
                <Button asChild>
                  <Link href="/orders/new">
                    Create an order <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              ) : null}
            </Panel>
            <details className="rounded-xl border bg-background p-4">
              <summary className="cursor-pointer text-sm font-medium">
                Optional setup · Come back any time
              </summary>
              <ul className="mt-3 flex flex-wrap gap-4 text-sm underline">
                <li>
                  <Link href="/settings/measurement-standards">
                    Measurements
                  </Link>
                </li>
                <li>
                  <Link href="/settings/customer-statuses">
                    Customer milestones
                  </Link>
                </li>
                <li>
                  <Link href="/settings/shopify">Shopify</Link>
                </li>
                <li>
                  <Link href="/settings/chat">Chat and WhatsApp</Link>
                </li>
              </ul>
            </details>
          </>
        ) : null}

        {step !== "overview" ? (
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            {previous ? (
              <Button variant="ghost" asChild>
                <Link href={stepLink(previous.id)}>
                  <ArrowLeft className="mr-1 size-4" /> Back
                </Link>
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap items-center gap-2">
              {next ? (
                step === "boutique" || !complete[step] ? (
                  <ProgressButton
                    tenantId={data.tenantId}
                    step={next.id}
                    variant="outline"
                  >
                    Do this later
                  </ProgressButton>
                ) : (
                  <ProgressButton tenantId={data.tenantId} step={next.id}>
                    Continue <ArrowRight className="ml-2 size-4" />
                  </ProgressButton>
                )
              ) : (
                <Button asChild variant="outline">
                  <Link href={stepLink("overview")}>View checklist</Link>
                </Button>
              )}
            </div>
          </footer>
        ) : null}
      </section>
    </div>
  );
}
