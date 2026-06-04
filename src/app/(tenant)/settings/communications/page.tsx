import Link from "next/link";

import {
  archiveCommunicationTemplateAction,
  archiveCommunicationTriggerRuleAction,
  createCommunicationTemplateAction,
  createCommunicationTriggerRuleAction,
  updateCommunicationTemplateAction,
  updateCommunicationTriggerRuleAction,
  upsertCommunicationChannelSettingAction
} from "@/features/communications/actions";
import { getCommunicationsSettingsPageData } from "@/features/communications/queries";
import { safeCommunicationVariables } from "@/features/communications/rendering";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type {
  CommunicationChannel,
  CommunicationTemplate,
  CommunicationTemplatePurpose,
  CommunicationTriggerRule,
  CommunicationTriggerType
} from "@/types/database";

const channels: CommunicationChannel[] = ["whatsapp", "email"];
const templatePurposes: CommunicationTemplatePurpose[] = [
  "tracking_link",
  "payment_reminder",
  "order_update",
  "payment_received",
  "pickup_ready",
  "dispatch_ready",
  "delivery_update",
  "custom_safe_note"
];
const triggerTypes: CommunicationTriggerType[] = [
  "order_confirmed",
  "customer_status_changed",
  "pickup_ready",
  "dispatch_ready",
  "order_partially_delivered",
  "order_delivered",
  "payment_received",
  "balance_pending",
  "payment_reminder_before_delivery",
  "payment_overdue",
  "manual_tracking_link",
  "manual_payment_reminder"
];

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function TemplateFields({ template }: { template?: CommunicationTemplate }) {
  return (
    <>
      {template ? <input type="hidden" name="templateId" value={template.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${template?.id ?? "new"}-template-channel`}>Channel</Label>
          <select
            id={`${template?.id ?? "new"}-template-channel`}
            name="channel"
            defaultValue={template?.channel ?? "whatsapp"}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {channels.map((channel) => (
              <option key={channel} value={channel}>
                {channel}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${template?.id ?? "new"}-template-purpose`}>Purpose</Label>
          <select
            id={`${template?.id ?? "new"}-template-purpose`}
            name="purpose"
            defaultValue={template?.purpose ?? "tracking_link"}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {templatePurposes.map((purpose) => (
              <option key={purpose} value={purpose}>
                {formatLabel(purpose)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${template?.id ?? "new"}-template-name`}>Name</Label>
        <Input
          id={`${template?.id ?? "new"}-template-name`}
          name="name"
          defaultValue={template?.name ?? ""}
          placeholder="Tracking link reminder"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${template?.id ?? "new"}-template-subject`}>Email subject</Label>
        <Input
          id={`${template?.id ?? "new"}-template-subject`}
          name="subject"
          defaultValue={template?.subject ?? ""}
          placeholder="Your order {{order_number}}"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${template?.id ?? "new"}-template-body`}>Message body</Label>
        <textarea
          id={`${template?.id ?? "new"}-template-body`}
          name="bodyText"
          className="min-h-32 w-full rounded-md border bg-background px-3 py-2 text-sm"
          defaultValue={template?.body_text ?? ""}
          placeholder="Hi {{customer_name}}, track {{order_number}} here: {{tracking_link}}"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${template?.id ?? "new"}-provider-template-name`}>Provider template name</Label>
        <Input
          id={`${template?.id ?? "new"}-provider-template-name`}
          name="providerTemplateName"
          defaultValue={template?.provider_template_name ?? ""}
          placeholder="Optional WhatsApp approved template id"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={template?.is_active ?? true} />
        Active
      </label>
    </>
  );
}

function TriggerRuleFields({
  activeTemplates,
  rule
}: {
  activeTemplates: CommunicationTemplate[];
  rule?: CommunicationTriggerRule;
}) {
  return (
    <>
      {rule ? <input type="hidden" name="triggerRuleId" value={rule.id} /> : null}
      <div className="space-y-1">
        <Label htmlFor={`${rule?.id ?? "new"}-trigger-type`}>Trigger</Label>
        <select
          id={`${rule?.id ?? "new"}-trigger-type`}
          name="triggerType"
          defaultValue={rule?.trigger_type ?? "manual_tracking_link"}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          {triggerTypes.map((triggerType) => (
            <option key={triggerType} value={triggerType}>
              {formatLabel(triggerType)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${rule?.id ?? "new"}-trigger-channel`}>Channel</Label>
          <select
            id={`${rule?.id ?? "new"}-trigger-channel`}
            name="channel"
            defaultValue={rule?.channel ?? "whatsapp"}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {channels.map((channel) => (
              <option key={channel} value={channel}>
                {channel}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${rule?.id ?? "new"}-delay-minutes`}>Delay minutes</Label>
          <Input id={`${rule?.id ?? "new"}-delay-minutes`} name="delayMinutes" type="number" defaultValue={rule?.delay_minutes ?? 0} min={0} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${rule?.id ?? "new"}-template-id`}>Template</Label>
        <select
          id={`${rule?.id ?? "new"}-template-id`}
          name="templateId"
          defaultValue={rule?.template_id ?? activeTemplates[0]?.id}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          required
        >
          {activeTemplates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.channel} · {template.name}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isEnabled" defaultChecked={rule?.is_enabled ?? false} />
        Enable rule
      </label>
    </>
  );
}

export default async function CommunicationsSettingsPage() {
  const { context, channelSettings, templates, triggerRules, recentMessages, messageLogs } = await getCommunicationsSettingsPageData();
  const settingsByChannel = new Map(channelSettings.map((setting) => [setting.channel, setting]));
  const templatesById = new Map(templates.map((template) => [template.id, template]));
  const activeTemplates = templates.filter((template) => template.is_active);
  const queuedCount = recentMessages.filter((message) => message.status === "queued").length;
  const failedCount = recentMessages.filter((message) => message.status === "failed").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Communications</h2>
          <p className="text-muted-foreground">
            Tenant-safe WhatsApp and email transaction alerts for {context.tenant.store_name}.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/settings">Back to settings</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Channels</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{channelSettings.length}/2</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Templates</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{templates.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Queued</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{queuedCount}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Failures</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{failedCount}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How this works</CardTitle>
          <CardDescription>
            This slice queues dry-run messages only. Live sending stays blocked until provider setup and background jobs are reviewed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Messages can use only safe customer-facing variables. Measurements, workers, internal notes, salary, and private attachments are not supported in templates.</p>
          <div className="flex flex-wrap gap-2">
            {safeCommunicationVariables.map((variable) => (
              <Badge key={variable} variant="outline">
                {`{{${variable}}}`}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Channel setup</CardTitle>
            <CardDescription>Configure tenant sender metadata. Use sandbox for now.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {channels.map((channel) => {
              const setting = settingsByChannel.get(channel);

              return (
                <form key={channel} action={upsertCommunicationChannelSettingAction} className="space-y-3 rounded-md border p-4">
                  <input type="hidden" name="channel" value={channel} />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium capitalize">{channel}</p>
                      <p className="text-sm text-muted-foreground">
                        {setting ? `${setting.mode} · ${setting.is_enabled ? "enabled" : "disabled"}` : "Not configured"}
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="isEnabled" defaultChecked={setting?.is_enabled ?? false} />
                      Enabled
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor={`${channel}-mode`}>Mode</Label>
                      <select id={`${channel}-mode`} name="mode" defaultValue={setting?.mode ?? "disabled"} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                        <option value="disabled">Disabled</option>
                        <option value="sandbox">Sandbox</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`${channel}-provider`}>Provider</Label>
                      <Input id={`${channel}-provider`} name="provider" defaultValue={setting?.provider ?? ""} placeholder="dry-run, meta, resend" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`${channel}-sender-name`}>Sender name</Label>
                      <Input id={`${channel}-sender-name`} name="senderName" defaultValue={setting?.sender_name ?? ""} placeholder={context.tenant.store_name} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`${channel}-sender-address`}>Sender address</Label>
                      <Input id={`${channel}-sender-address`} name="senderAddress" defaultValue={setting?.sender_address ?? ""} placeholder={channel === "email" ? "orders@example.com" : "+91..."} />
                    </div>
                  </div>
                  <Button type="submit">Save {channel}</Button>
                </form>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Templates</CardTitle>
                <CardDescription>Reusable customer-safe message bodies.</CardDescription>
              </div>
              <Dialog title="Add template" description="Create a tenant-owned dry-run template." trigger={<span className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">Add template</span>}>
                <form action={createCommunicationTemplateAction} className="space-y-3">
                  <TemplateFields />
                  <Button type="submit">Create template</Button>
                </form>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {templates.map((template) => (
              <div key={template.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{template.name}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={template.is_active ? "default" : "neutral"}>{template.channel}</Badge>
                    <Dialog title="Edit template" description="Changes apply to future queued messages only." trigger={<span className="inline-flex h-8 items-center rounded-md border px-2 text-xs font-medium hover:bg-accent">Edit</span>}>
                      <form action={updateCommunicationTemplateAction} className="space-y-3">
                        <TemplateFields template={template} />
                        <Button type="submit">Save template</Button>
                      </form>
                    </Dialog>
                    <Dialog title="Archive template?" description="This hides the template and disables trigger rules that use it." trigger={<span className="inline-flex h-8 items-center rounded-md border px-2 text-xs font-medium hover:bg-accent">Archive</span>}>
                      <form action={archiveCommunicationTemplateAction} className="space-y-3">
                        <input type="hidden" name="templateId" value={template.id} />
                        <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                          Existing queued messages and audit logs are kept. Future messages will not use this template.
                        </div>
                        <Button type="submit" variant="destructive">
                          Archive template
                        </Button>
                      </form>
                    </Dialog>
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{formatLabel(template.purpose)}</p>
                <p className="mt-2 line-clamp-2 text-sm">{template.body_text}</p>
              </div>
            ))}
            {!templates.length ? <p className="text-sm text-muted-foreground">No templates yet.</p> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Trigger rules</CardTitle>
                <CardDescription>Opt-in rules for future automated queueing.</CardDescription>
              </div>
              <Dialog title="Add trigger rule" description="Rules are stored now; live automation comes after job runner setup." trigger={<span className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-sm font-medium">Add rule</span>}>
                <form action={createCommunicationTriggerRuleAction} className="space-y-3">
                  <TriggerRuleFields activeTemplates={activeTemplates} />
                  <Button type="submit" disabled={!activeTemplates.length}>
                    Create rule
                  </Button>
                </form>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {triggerRules.map((rule) => {
              const template = templatesById.get(rule.template_id);
              return (
                <div key={rule.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{formatLabel(rule.trigger_type)}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant={rule.is_enabled ? "default" : "neutral"}>{rule.is_enabled ? "enabled" : "off"}</Badge>
                      <Dialog title="Edit trigger rule" description="Rules are stored for future automation. Live sends are still blocked." trigger={<span className="inline-flex h-8 items-center rounded-md border px-2 text-xs font-medium hover:bg-accent">Edit</span>}>
                        <form action={updateCommunicationTriggerRuleAction} className="space-y-3">
                          <TriggerRuleFields activeTemplates={activeTemplates} rule={rule} />
                          <Button type="submit" disabled={!activeTemplates.length}>
                            Save rule
                          </Button>
                        </form>
                      </Dialog>
                      <Dialog title="Archive trigger rule?" description="This disables the rule and hides it from the active settings view." trigger={<span className="inline-flex h-8 items-center rounded-md border px-2 text-xs font-medium hover:bg-accent">Archive</span>}>
                        <form action={archiveCommunicationTriggerRuleAction} className="space-y-3">
                          <input type="hidden" name="triggerRuleId" value={rule.id} />
                          <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                            Existing queued messages and audit logs are kept. This rule will not be used for future automation.
                          </div>
                          <Button type="submit" variant="destructive">
                            Archive rule
                          </Button>
                        </form>
                      </Dialog>
                    </div>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {rule.channel} · {template?.name ?? "Missing template"} · {rule.delay_minutes} min delay
                  </p>
                </div>
              );
            })}
            {!triggerRules.length ? <p className="text-sm text-muted-foreground">No trigger rules yet.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent dry-run messages</CardTitle>
            <CardDescription>Queued messages are audit records until live providers are enabled.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentMessages.map((message) => (
              <div key={message.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{message.recipient_name ?? "Customer"}</p>
                  <Badge variant="neutral">{message.status}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {message.channel} · {message.recipient_phone ?? message.recipient_email}
                </p>
                <p className="mt-2 line-clamp-2">{message.body_text}</p>
              </div>
            ))}
            {!recentMessages.length ? <p className="text-sm text-muted-foreground">No queued messages yet.</p> : null}
            {messageLogs.length ? (
              <>
                <Separator />
                <p className="text-xs font-medium text-muted-foreground">Latest audit event: {messageLogs[0]?.event_type}</p>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
