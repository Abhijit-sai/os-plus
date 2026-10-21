"use client";
import { useState, useRef } from "react";
import { ChatSetupPanel } from "@/components/chat/setup-panel";
import { PlatformChatPanel } from "@/components/chat/platform-panel";
import { configureChatSchema } from "@/features/chat/schemas";
import { canUseChat } from "@/features/chat/permissions";
import { parseKnowledgePack } from "@/features/chat/knowledge-pack";
import example from "../../../docs_chat/examples/new-business.pack.json";
import type { ChatSetup } from "@/features/chat/queries";
import type { ChatActionResult } from "@/features/chat/actions";
const id = (n: number) =>
  "10000000-0000-4000-8000-" + String(n).padStart(12, "0");
const initial: ChatSetup = {
  histories: [{ brandId: id(2), olderBefore: null }],
  tenantId: id(1),
  businessName: "Synthetic Business A",
  brands: [
    {
      id: id(2),
      name: "Example Brand",
      slug: "example",
      persona_name: "Demo assistant",
    },
  ],
  branches: [
    { id: id(3), name: "North branch", code: "north" },
    { id: id(4), name: "South branch", code: "south" },
  ],
  mappings: [{ brand_id: id(2), location_id: id(3) }],
  packs: [{ id: id(5), brand_id: id(2), version: 1, status: "draft" }],
  channels: [],
  grants: [],
  workspace: { id: id(6), status: "active" },
};
const empty: ChatSetup = {
  histories: [],
  tenantId: id(9),
  businessName: "Synthetic Business B",
  brands: [],
  branches: [],
  mappings: [],
  packs: [],
  channels: [],
  grants: [],
  workspace: null,
};
export default function Preview() {
  const [business, setBusiness] = useState("A"),
    [role, setRole] = useState("owner_admin"),
    [fail, setFail] = useState(false),
    [platform, setPlatform] = useState(false);
  const [data, setData] = useState(initial),
    [dataB, setDataB] = useState(empty);
  const bodies = useRef(new Map([[id(5), parseKnowledgePack(example)]]));
  const receipts = useRef(new Set<string>());
  const [lost, setLost] = useState(false),
    [attemptMessage, setAttemptMessage] = useState("");
  const allowed = canUseChat(
    {
      tenantId: id(1),
      tenantActive: true,
      moduleEnabled: true,
      membership: { tenantId: id(1), status: "active", role },
      grants: [],
    },
    "chat_settings:manage",
  );
  async function save(input: unknown, key: string): Promise<ChatActionResult> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (fail)
      return {
        ok: false,
        message: "Synthetic save failure. Your input has been preserved.",
      };
    const parsed = configureChatSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        message: "Check the entered values. This draft was not saved.",
      };
    if (receipts.current.has(key)) {
      setAttemptMessage("Recovered the existing receipt; no duplicate save.");
      return { ok: true, message: "Saved in this synthetic preview only." };
    }
    receipts.current.add(key);
    setAttemptMessage("Committed one synthetic save.");
    const c = parsed.data;
    const savedPackId = crypto.randomUUID();
    if (c.action === "pack.save") bodies.current.set(savedPackId, c.input.pack);
    (business === "A" ? setData : setDataB)((previous) => {
      const next = structuredClone(previous);
      if (c.action === "brand.save") {
        const brand = {
          id: c.input.id ?? crypto.randomUUID(),
          name: c.input.name,
          slug: c.input.slug,
          persona_name: c.input.personaName,
        };
        next.brands = [...next.brands.filter((b) => b.id !== brand.id), brand];
      }
      if (c.action === "brand.archive")
        next.brands = next.brands.filter((b) => b.id !== c.input.id);
      if (c.action === "branch.map")
        next.mappings.push({
          brand_id: c.input.brandId,
          location_id: c.input.locationId,
        });
      if (c.action === "pack.save")
        next.packs.unshift({
          id: savedPackId,
          brand_id: c.input.brandId,
          version:
            Math.max(
              0,
              ...next.packs
                .filter((p) => p.brand_id === c.input.brandId)
                .map((p) => p.version),
            ) + 1,
          status: "draft",
        });
      if (c.action === "pack.publish")
        next.packs = next.packs.map((p) => ({
          ...p,
          status:
            p.id === c.input.id
              ? "published"
              : p.status === "published"
                ? "archived"
                : p.status,
        }));
      if (c.action === "role.grant")
        next.grants = [
          ...next.grants.filter(
            (g) =>
              !(g.role === c.input.role && g.permission === c.input.permission),
          ),
          c.input,
        ];
      if (c.action === "channel.map")
        next.channels = [
          {
            id: crypto.randomUUID(),
            workspace_id: c.input.workspaceId,
            brand_id: c.input.brandId,
            default_location_id: c.input.locationId,
            chatwoot_inbox_id: c.input.inboxId,
            name: c.input.name,
            kind: c.input.kind,
            agent_mode: "draft",
            is_active: true,
          },
        ];
      return next;
    });
    if (lost)
      return {
        ok: false,
        message: "Synthetic response lost after commit. Retry unchanged input.",
      };
    return { ok: true, message: "Saved in this synthetic preview only." };
  }
  return (
    <div className="space-y-5">
      <aside className="space-y-3 rounded-md border p-4 text-sm">
        <p>
          Local synthetic UI preview. No Clerk, Supabase, Chatwoot, customer
          data or real messages. Saves are simulated; this is not authentication
          or database acceptance.
        </p>
        <div className="flex flex-wrap gap-4">
          <label>
            Business{" "}
            <select
              aria-label="Preview business"
              className="min-h-11 border bg-background"
              value={business}
              onChange={(e) => setBusiness(e.target.value)}
            >
              <option>A</option>
              <option>B</option>
            </select>
          </label>
          <label>
            Role{" "}
            <select
              aria-label="Preview role"
              className="min-h-11 border bg-background"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {["owner_admin", "manager", "viewer", "finance"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={fail}
              onChange={(e) => setFail(e.target.checked)}
            />
            Simulate save failure
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={lost}
              onChange={(e) => setLost(e.target.checked)}
            />
            Simulate response lost after commit
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={platform}
              onChange={(e) => setPlatform(e.target.checked)}
            />
            Platform screen
          </label>
        </div>
        <p role="status">{attemptMessage}</p>
      </aside>
      {platform ? (
        <PlatformChatPanel
          tenants={[
            {
              id: id(1),
              name: "Synthetic Business A",
              enabled: false,
              workspace: null,
            },
          ]}
          save={async () => ({
            ok: true,
            message: "Prepared in preview only.",
            webhooks: {
              events: "https://example.invalid/events?token=synthetic",
              agent: "https://example.invalid/agent?token=synthetic",
            },
          })}
        />
      ) : allowed ? (
        <ChatSetupPanel
          key={business}
          data={business === "A" ? data : dataB}
          save={save}
          loadKnowledge={async (input) => {
            const request = input as { id?: string };
            const pack = request.id ? bodies.current.get(request.id) : null;
            return pack
              ? {
                  ok: true,
                  message: "Loaded synthetic revision.",
                  revision: { id: request.id!, pack_json: pack },
                }
              : {
                  ok: true,
                  message: "No older revisions.",
                  revisions: [],
                  olderBefore: null,
                };
          }}
          sync={async () => ({
            ok: true,
            message: "Synthetic inboxes loaded.",
            inboxes: [{ id: 10, name: "Example WhatsApp", kind: "whatsapp" }],
          })}
        />
      ) : (
        <p role="status">
          Chat settings are available to owners and administrators only.
        </p>
      )}
    </div>
  );
}
