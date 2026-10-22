"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ChatForm,
  ChatInput,
  ChatSelect,
  ChatSection,
  field,
} from "./setup-form";
import { KnowledgeEditor } from "./knowledge-editor";
import type { ChatActionResult } from "@/features/chat/actions";
import type { ChatSetup } from "@/features/chat/queries";
import type { ChatInbox } from "@/integrations/chatwoot/admin-client";

export function ChatSetupPanel({
  data,
  previewEnabled = false,
  save,
  sync,
  loadKnowledge,
}: {
  loadKnowledge: (input: unknown) => Promise<ChatActionResult>;
  data: ChatSetup;
  previewEnabled?: boolean;
  save: (input: unknown, key: string) => Promise<ChatActionResult>;
  sync: () => Promise<ChatActionResult>;
}) {
  const [inboxes, setInboxes] = useState<ChatInbox[]>([]);
  const commit = (key: string, action: string, input: unknown) =>
    save({ action, input }, key);
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Chat setup</h2>
        <p className="mt-1 text-muted-foreground">
          {data.businessName} · Configure brands, branch mappings and approved
          knowledge.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Staff replies stay in Chatwoot. Conversation processing and automatic
          replies are not enabled by this setup.
        </p>
        {previewEnabled ? (
          <Link
            className="mt-3 inline-flex min-h-11 items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            href="/settings/chat/try"
          >
            Try the bot — mock preview
          </Link>
        ) : null}
      </header>
      <ChatSection
        title="Brands"
        description="Keep each brand’s identity and knowledge separate. Existing customers and orders are unaffected."
      >
        <details className="rounded-md border p-3">
          <summary className="min-h-11 cursor-pointer font-medium">
            Add a brand
          </summary>
          <ChatForm
            label="Add brand"
            resetOnSuccess
            save={(d, key) =>
              commit(key, "brand.save", {
                name: field(d, "name"),
                slug: field(d, "slug"),
                personaName: field(d, "persona"),
              })
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <ChatInput label="Brand name" name="name" />
              <ChatInput label="Brand code (lowercase, hyphens)" name="slug" />
              <ChatInput label="Assistant display name" name="persona" />
            </div>
          </ChatForm>
        </details>
        {data.brands.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Add your first brand to map branches and prepare knowledge.
          </p>
        )}
        {data.brands.map((brand) => (
          <details key={brand.id} className="rounded-md border p-3">
            <summary className="min-h-11 cursor-pointer font-medium">
              {brand.name}
            </summary>
            <div className="space-y-6">
              <ChatForm
                label="Save brand"
                save={(d, key) =>
                  commit(key, "brand.save", {
                    id: brand.id,
                    name: field(d, "name"),
                    slug: field(d, "slug"),
                    personaName: field(d, "persona"),
                  })
                }
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <ChatInput
                    label="Brand name"
                    name="name"
                    value={brand.name}
                  />
                  <ChatInput
                    label="Brand code"
                    name="slug"
                    value={brand.slug}
                  />
                  <ChatInput
                    label="Assistant display name"
                    name="persona"
                    value={brand.persona_name}
                  />
                </div>
              </ChatForm>
              <div>
                <h4 className="mb-2 font-medium">Branches</h4>
                <ul className="mb-3 text-sm">
                  {data.mappings
                    .filter((m) => m.brand_id === brand.id)
                    .map((m) => (
                      <li key={m.location_id}>
                        {data.branches.find((b) => b.id === m.location_id)
                          ?.name ?? "Inactive branch"}
                      </li>
                    ))}
                </ul>
                <ChatForm
                  label="Map branch"
                  save={(d, key) =>
                    commit(key, "branch.map", {
                      brandId: brand.id,
                      locationId: field(d, "location"),
                    })
                  }
                >
                  <ChatSelect
                    label="Existing business branch"
                    name="location"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Choose a branch
                    </option>
                    {data.branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} ({branch.code})
                      </option>
                    ))}
                  </ChatSelect>
                </ChatForm>
              </div>
              <div>
                <h4 className="mb-3 font-medium">Knowledge and publication</h4>
                <KnowledgeEditor
                  brandId={brand.id}
                  packs={data.packs.filter((p) => p.brand_id === brand.id)}
                  olderBefore={
                    data.histories.find((h) => h.brandId === brand.id)
                      ?.olderBefore ?? null
                  }
                  save={save}
                  loadKnowledge={loadKnowledge}
                />
              </div>
              <details className="rounded-md border p-3">
                <summary className="min-h-11 cursor-pointer text-sm">
                  Archive this brand
                </summary>
                <ChatForm
                  label="Archive brand"
                  save={(_d, key) =>
                    commit(key, "brand.archive", { id: brand.id })
                  }
                >
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" required />
                    Archive this brand and disable its mapped channels. Saved
                    history is retained.
                  </label>
                </ChatForm>
              </details>
            </div>
          </details>
        ))}
      </ChatSection>
      <ChatSection
        title="Channels"
        description="Load the connected Chatwoot inboxes, then map each supported channel to a brand and optional branch. New mappings start in draft mode."
      >
        <p className="text-sm">
          Connection: {data.workspace?.status ?? "Not prepared"}
        </p>
        <ChatForm
          label="Sync inboxes"
          save={sync}
          onResult={(r) => {
            if (r.ok && r.inboxes) setInboxes(r.inboxes);
          }}
        >
          <span className="sr-only">Refresh inbox list</span>
        </ChatForm>
        {inboxes.map((inbox) => (
          <details key={inbox.id} className="rounded-md border p-3">
            <summary className="min-h-11 cursor-pointer font-medium">
              {inbox.name} · {inbox.kind}
            </summary>
            <ChatForm
              label="Save channel mapping"
              save={(d, key) =>
                commit(key, "channel.map", {
                  workspaceId: data.workspace?.id,
                  brandId: field(d, "brand"),
                  locationId: field(d, "location") || null,
                  inboxId: inbox.id,
                  kind: inbox.kind,
                  name: inbox.name,
                })
              }
            >
              <ChatSelect label="Brand" name="brand" defaultValue="">
                <option value="" disabled>
                  Choose a brand
                </option>
                {data.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </ChatSelect>
              <ChatSelect
                label="Default branch (must be mapped to this brand)"
                name="location"
                required={false}
              >
                <option value="">No default branch</option>
                {data.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </ChatSelect>
            </ChatForm>
          </details>
        ))}
        <ul className="space-y-2 text-sm">
          {data.channels.map((channel) => (
            <li key={channel.id} className="rounded-md border p-3">
              {channel.name} ·{" "}
              {data.brands.find((b) => b.id === channel.brand_id)?.name ??
                "Archived brand"}{" "}
              · {channel.is_active ? channel.agent_mode : "Inactive"}
            </li>
          ))}
        </ul>
      </ChatSection>
      <ChatSection
        title="Viewer and finance access"
        description="Both roles start without access. Lead viewing and contact details are separate grants. They cannot manage leads, view Chat reports or open Chatwoot in this release."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {(["viewer", "finance"] as const).map((role) => (
            <div className="space-y-3 rounded-md border p-3" key={role}>
              <h4 className="font-medium capitalize">{role}</h4>
              {(["leads:view", "leads:pii"] as const).map((permission) => (
                <ChatForm
                  key={permission}
                  label="Save access"
                  save={(d, key) =>
                    commit(key, "role.grant", {
                      role,
                      permission,
                      allowed: d.get("allowed") === "on",
                    })
                  }
                >
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      name="allowed"
                      type="checkbox"
                      defaultChecked={
                        data.grants.find(
                          (g) => g.role === role && g.permission === permission,
                        )?.allowed ?? false
                      }
                    />
                    {permission === "leads:view"
                      ? "View leads (read-only)"
                      : "View contact details (also requires lead access)"}
                  </label>
                </ChatForm>
              ))}
            </div>
          ))}
        </div>
      </ChatSection>
    </div>
  );
}
