"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  ItemType,
  ItemTypeStageContributionRule,
  StageEffortTrackingMode,
  StageMaster,
} from "@/types/database";

type RuleSelection = "none" | "per_unit" | "per_hour" | "percentage_units" | "percentage_hours";
type SaveRuleAction = (formData: FormData) => void | Promise<void>;
type SaveState = { message: string | null; ok: boolean };

const initialState: SaveState = { message: null, ok: false };

function currentSelection(rule: ItemTypeStageContributionRule | undefined): RuleSelection {
  if (!rule) return "none";
  if (rule.calculation_method === "percentage") {
    return rule.percentage_allocation_basis === "hours" ? "percentage_hours" : "percentage_units";
  }
  return rule.calculation_method;
}

function ruleOptions(mode: StageEffortTrackingMode) {
  return [
    { enabled: true, label: "No contribution value", value: "none" as const },
    { enabled: mode === "units" || mode === "hybrid", label: "Fixed amount per credited unit", value: "per_unit" as const },
    { enabled: mode === "hours" || mode === "hybrid", label: "Fixed amount per credited hour", value: "per_hour" as const },
    { enabled: mode === "units" || mode === "hybrid", label: "Percentage of item value, shared by units", value: "percentage_units" as const },
    { enabled: mode === "hours" || mode === "hybrid", label: "Percentage of item value, shared by hours", value: "percentage_hours" as const },
  ].filter((option) => option.enabled);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function modeLabel(mode: StageEffortTrackingMode) {
  if (mode === "units") return "Tracks credited units";
  if (mode === "hours") return "Tracks credited worker-hours";
  if (mode === "hybrid") return "Tracks units and worker-hours";
  return "Worker assignment only";
}

function ruleSummary(itemTypeName: string, selection: RuleSelection, rate: number | null) {
  if (selection === "none" || rate === null) return "No contribution value configured.";
  if (selection === "per_unit") return `${formatMoney(rate)} for each credited ${itemTypeName} unit.`;
  if (selection === "per_hour") return `${formatMoney(rate)} for each credited worker-hour.`;

  const basis = selection === "percentage_hours" ? "worker-hours" : "units";
  const examplePool = (10_000 * rate) / 100;
  return `${rate}% of the discounted pre-GST item value, shared according to credited ${basis}. On a ${formatMoney(10_000)} item, the worker pool is ${formatMoney(examplePool)}.`;
}

function fieldCopy(selection: RuleSelection) {
  if (selection === "per_unit") return { label: "Amount per unit (₹)", hint: "Multiplied by each worker's credited units." };
  if (selection === "per_hour") return { label: "Amount per hour (₹)", hint: "Calculated from each worker's credited minutes." };
  return { label: "Percentage of item value (%)", hint: "Uses the item value after item discount and before GST." };
}

function RuleRow({
  action,
  itemType,
  rule,
  stage,
}: {
  action: SaveRuleAction;
  itemType: ItemType;
  rule: ItemTypeStageContributionRule | undefined;
  stage: StageMaster;
}) {
  const savedSelection = currentSelection(rule);
  const savedRate = rule?.rate_value ?? null;
  const [editing, setEditing] = React.useState(false);
  const [selection, setSelection] = React.useState<RuleSelection>(savedSelection);
  const [rateValue, setRateValue] = React.useState(savedRate === null ? "" : String(savedRate));
  const [savedOverride, setSavedOverride] = React.useState<{ rate: number | null; selection: RuleSelection } | null>(null);
  const [state, formAction, pending] = React.useActionState(async (_previousState: SaveState, formData: FormData) => {
    try {
      await action(formData);
      const nextSelection = String(formData.get("ruleSelection") ?? "none") as RuleSelection;
      const submittedRate = String(formData.get("rateValue") ?? "").trim();
      setSavedOverride({ rate: nextSelection === "none" || !submittedRate ? null : Number(submittedRate), selection: nextSelection });
      setEditing(false);
      return { message: "Contribution rule saved.", ok: true };
    } catch (error) {
      return {
        message: error instanceof Error && error.message.trim() ? error.message : "Unable to save this contribution rule.",
        ok: false,
      };
    }
  }, initialState);
  const effectiveSaved = savedOverride ?? { rate: savedRate, selection: savedSelection };
  const options = ruleOptions(stage.effort_tracking_mode);
  const canConfigure = options.length > 1;
  const rateCopy = fieldCopy(selection);

  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{stage.name}</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{modeLabel(stage.effort_tracking_mode)}</span>
          </div>
          <p className="mt-2 max-w-[75ch] text-sm text-muted-foreground">
            {ruleSummary(itemType.name, effectiveSaved.selection, effectiveSaved.rate)}
          </p>
          {state.ok && state.message && !editing ? <p className="mt-2 text-xs text-emerald-700" role="status">{state.message}</p> : null}
        </div>
        {canConfigure ? (
          <Button
            onClick={() => {
              setSelection(effectiveSaved.selection);
              setRateValue(effectiveSaved.rate === null ? "" : String(effectiveSaved.rate));
              setEditing((current) => !current);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {editing ? "Cancel" : effectiveSaved.selection === "none" ? "Configure" : "Edit rule"}
          </Button>
        ) : null}
      </div>

      {editing ? (
        <form action={formAction} className="mt-4 grid gap-4 rounded-md bg-muted/30 p-4 lg:grid-cols-[minmax(240px,1fr)_minmax(200px,.7fr)_auto] lg:items-end" data-unsaved-guard="true">
          <input name="itemTypeId" type="hidden" value={itemType.id} />
          <input name="stageId" type="hidden" value={stage.id} />
          <div className="grid gap-2">
            <Label htmlFor={`rule-${stage.id}`}>Contribution calculation</Label>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              disabled={pending}
              id={`rule-${stage.id}`}
              name="ruleSelection"
              onChange={(event) => {
                const selection = event.target.value as RuleSelection;
                setSelection(selection);
                if (selection === "none") setRateValue("");
              }}
              value={selection}
            >
              {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          {selection !== "none" ? (
            <div className="grid gap-2">
              <Label htmlFor={`rate-${stage.id}`}>{rateCopy.label}</Label>
              <Input
                disabled={pending}
                id={`rate-${stage.id}`}
                max={selection.startsWith("percentage") ? "100" : undefined}
                min="0.01"
                name="rateValue"
                onChange={(event) => setRateValue(event.target.value)}
                required
                step="0.01"
                type="number"
                value={rateValue}
              />
              <p className="text-xs text-muted-foreground">{rateCopy.hint}</p>
            </div>
          ) : <input name="rateValue" type="hidden" value="" />}
          <Button disabled={pending} pendingLabel="Saving rule..." type="submit">Save rule</Button>
          {!state.ok && state.message ? <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive lg:col-span-3" role="alert">{state.message}</div> : null}
        </form>
      ) : null}
    </div>
  );
}

export function ContributionRuleList({
  action,
  itemType,
  rules,
  stages,
}: {
  action: SaveRuleAction;
  itemType: ItemType;
  rules: ItemTypeStageContributionRule[];
  stages: StageMaster[];
}) {
  const ruleByStageId = new Map(rules.map((rule) => [rule.stage_master_id, rule]));

  return (
    <div className="divide-y">
      {stages.map((stage) => {
        const rule = ruleByStageId.get(stage.id);
        return (
          <RuleRow
            action={action}
            itemType={itemType}
            key={`${stage.id}:${currentSelection(rule)}:${rule?.rate_value ?? "none"}`}
            rule={rule}
            stage={stage}
          />
        );
      })}
      {!stages.length ? <p className="py-4 text-sm text-muted-foreground">Add active stages before configuring contribution rules.</p> : null}
    </div>
  );
}
