"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChatForm, ChatInput, ChatSection, field } from "./setup-form";
import type { ChatActionResult } from "@/features/chat/actions";
import type { getPlatformChatSetup } from "@/features/chat/queries";
import { StaffLinks, type StaffLinkActions } from "./staff-links";

type Tenant = Awaited<ReturnType<typeof getPlatformChatSetup>>[number];
type Connect = (input: unknown) => Promise<ChatActionResult>;
function Workspace({
  tenant,
  save,
  connect,
  loadStaff,
  linkStaff,
}: {
  tenant: Tenant;
  connect: Connect;
  save: (input: unknown, key: string) => Promise<ChatActionResult>;
} & StaffLinkActions) {
  const [webhooks, setWebhooks] = useState<ChatActionResult["webhooks"]>();
  const commit = (key: string, action: string, extra: object = {}) =>
    save({ action, tenantId: tenant.id, ...extra }, key);
  return (
    <details className="rounded-xl border bg-card p-4">
      <summary className="min-h-11 cursor-pointer font-medium">
        {tenant.name} · {tenant.enabled ? "Module enabled" : "Module disabled"}{" "}
        · {tenant.workspace?.status ?? "No workspace"}
      </summary>
      <div className="space-y-6">
        {!tenant.workspace ? (
          <ChatForm
            label="Prepare workspace"
            save={(_d, key) => commit(key, "workspace.prepare")}
            onResult={(r) => {
              if (r.ok) setWebhooks(r.webhooks);
            }}
          >
            <p className="text-sm text-muted-foreground">
              Creates local configuration with the module disabled. Save the
              one-time webhook URLs securely for the next phase.
            </p>
          </ChatForm>
        ) : (
          <>
            <p className="text-sm">
              Chatwoot account:{" "}
              {tenant.workspace.chatwoot_account_id ?? "Not linked"}
            </p>
            {!tenant.workspace.chatwoot_account_id &&
              !tenant.workspace.provisioning_attempted_at && (
                <ChatForm
                  label="Create Chatwoot account"
                  save={(d, key) =>
                    commit(key, "workspace.create", { name: field(d, "name") })
                  }
                >
                  <ChatInput
                    label="New account name"
                    name="name"
                    value={tenant.name}
                  />
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" required />
                    Create a new account on the configured Chatwoot server.
                  </label>
                </ChatForm>
              )}
            {tenant.workspace.provisioning_attempted_at &&
              !tenant.workspace.chatwoot_account_id && (
                <p role="status" className="rounded-md border p-3 text-sm">
                  An account creation attempt is recorded. Find its outcome in
                  Chatwoot and link that account below. A second creation
                  attempt is blocked.
                </p>
              )}
            <ChatForm
              label="Verify and link account"
              save={(d, key) =>
                commit(key, "workspace.link", {
                  accountId: Number(field(d, "account")),
                  token: field(d, "token"),
                })
              }
              resetOnSuccess
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <ChatInput
                  label="Chatwoot account number"
                  name="account"
                  type="number"
                  value={tenant.workspace.chatwoot_account_id?.toString()}
                />
                <ChatInput
                  label="Account administrator API token"
                  name="token"
                  type="password"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                The token is encrypted when saved and is never shown again. Use
                an administrator belonging to this account.
              </p>
            </ChatForm>
            {tenant.workspace.status === "active" &&
              tenant.workspace.chatwoot_account_id && (
                <StaffLinks
                  key={tenant.workspace.id}
                  scope={{
                    tenantId: tenant.id,
                    workspaceId: tenant.workspace.id,
                    accountId: tenant.workspace.chatwoot_account_id,
                  }}
                  loadStaff={loadStaff}
                  linkStaff={linkStaff}
                />
              )}
            {tenant.enabled && tenant.workspace.status === "active" && (
              <ChatForm
                label="Connect Chatwoot webhooks"
                save={(d) =>
                  connect({
                    tenantId: tenant.id,
                    webhookSecret: field(d, "webhookSecret"),
                  })
                }
                resetOnSuccess
              >
                <ChatInput
                  label="Webhook setup secret"
                  name="webhookSecret"
                  type="password"
                />
                <p className="text-sm text-muted-foreground">
                  Use the secret from the saved setup URL for this workspace.
                  This connects chat events; inbox reply modes stay as
                  configured.
                </p>
              </ChatForm>
            )}
            <ChatForm
              label="Save module access"
              save={(d, key) =>
                commit(key, "module.set", {
                  enabled: d.get("enabled") === "on",
                })
              }
            >
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={tenant.enabled}
                />
                Enable Chat setup for this business
              </label>
            </ChatForm>
            <details className="rounded-md border p-3">
              <summary className="min-h-11 cursor-pointer text-sm">
                Replace webhook setup URLs
              </summary>
              <ChatForm
                label="Replace setup URLs"
                save={(_d, key) => commit(key, "workspace.rotate")}
                onResult={(r) => {
                  if (r.ok) setWebhooks(r.webhooks);
                }}
              >
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" required />
                  Invalidate the previous webhook URLs and show new ones.
                </label>
              </ChatForm>
            </details>
            <details className="rounded-md border p-3">
              <summary className="min-h-11 cursor-pointer text-sm">
                Suspend workspace
              </summary>
              <ChatForm
                label="Suspend workspace"
                save={(_d, key) => commit(key, "workspace.suspend")}
              >
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" required />
                  Suspend this workspace and disable its Chat module.
                </label>
              </ChatForm>
            </details>
          </>
        )}
        {webhooks && (
          <div className="space-y-3 rounded-md border p-4">
            <p className="font-medium">One-time webhook setup URLs</p>
            <p className="text-sm">
              Store these securely. They contain authentication secrets. These
              endpoints are implemented in the next phase.
            </p>
            {(["events", "agent"] as const).map((kind) => (
              <label key={kind} className="block space-y-1 text-sm">
                <span className="capitalize">{kind} webhook</span>
                <textarea
                  readOnly
                  rows={3}
                  value={webhooks[kind]}
                  className="w-full min-w-0 rounded-md border bg-background p-2 text-sm"
                />
              </label>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setWebhooks(undefined)}
            >
              Hide setup URLs
            </Button>
          </div>
        )}
      </div>
    </details>
  );
}
export function PlatformChatPanel({
  tenants,
  save,
  connect,
  loadStaff,
  linkStaff,
}: {
  tenants: Tenant[];
  connect: Connect;
  save: (input: unknown, key: string) => Promise<ChatActionResult>;
} & StaffLinkActions) {
  return (
    <ChatSection
      title="Chat workspaces"
      description="Prepare one isolated Chatwoot account per business. Enable each module explicitly after setup."
    >
      {tenants.length === 0 ? (
        <p>No active businesses available.</p>
      ) : (
        tenants.map((tenant) => (
          <Workspace
            key={tenant.id}
            tenant={tenant}
            save={save}
            connect={connect}
            loadStaff={loadStaff}
            linkStaff={linkStaff}
          />
        ))
      )}
    </ChatSection>
  );
}
