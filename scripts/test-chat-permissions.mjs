import assert from "node:assert/strict";
import { test } from "node:test";
import { canUseChat } from "../src/features/chat/permissions.ts";
const tenantId = "10000000-0000-4000-8000-000000000001";
const access = {
  tenantId,
  tenantActive: true,
  moduleEnabled: true,
  membership: { tenantId, status: "active", role: "owner_admin" },
  grants: [],
};
test("approved role defaults apply only to an active member of an enabled tenant", () => {
  const expected = {
    owner_admin: [
      "leads:view",
      "leads:manage",
      "leads:pii",
      "chat_settings:manage",
      "chat_reports:view",
    ],
    manager: ["leads:view", "leads:manage", "leads:pii"],
    viewer: [],
    finance: [],
  };
  for (const [role, permissions] of Object.entries(expected)) {
    for (const permission of expected.owner_admin) {
      const input = { ...access, membership: { ...access.membership, role } };
      assert.equal(
        canUseChat(input, permission),
        permissions.includes(permission),
      );
      for (const blocked of [
        { moduleEnabled: false },
        { tenantActive: false },
        { membership: { ...input.membership, status: "disabled" } },
        {
          membership: {
            ...input.membership,
            tenantId: "10000000-0000-4000-8000-000000000009",
          },
        },
      ]) {
        assert.equal(canUseChat({ ...input, ...blocked }, permission), false);
      }
    }
  }
});

test("viewer and finance grants are tenant scoped, read-only, and PII requires a separate view grant", () => {
  for (const role of ["viewer", "finance"]) {
    const base = { ...access, membership: { ...access.membership, role } };
    const view = { tenantId, role, permission: "leads:view", allowed: true };
    const pii = { tenantId, role, permission: "leads:pii", allowed: true };
    assert.equal(canUseChat({ ...base, grants: [view] }, "leads:view"), true);
    assert.equal(canUseChat({ ...base, grants: [view] }, "leads:pii"), false);
    assert.equal(canUseChat({ ...base, grants: [pii] }, "leads:pii"), false);
    assert.equal(
      canUseChat({ ...base, grants: [view, pii] }, "leads:pii"),
      true,
    );
    assert.equal(
      canUseChat({ ...base, grants: [view, pii] }, "leads:manage"),
      false,
    );
    assert.equal(
      canUseChat({ ...base, grants: [view, pii] }, "chat_settings:manage"),
      false,
    );
    assert.equal(
      canUseChat({ ...base, grants: [view, pii] }, "chat_reports:view"),
      false,
    );
    assert.equal(
      canUseChat(
        {
          ...base,
          grants: [
            { ...view, tenantId: "10000000-0000-4000-8000-000000000009" },
          ],
        },
        "leads:view",
      ),
      false,
    );
    assert.equal(
      canUseChat(
        { ...base, grants: [view, { ...view, allowed: false }] },
        "leads:view",
      ),
      false,
    );
  }
});
