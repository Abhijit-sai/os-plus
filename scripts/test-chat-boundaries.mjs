import assert from "node:assert/strict";
import { test } from "node:test";
import {
  configureChatSchema,
  platformChatSchema,
} from "../src/features/chat/schemas.ts";
test("tenant forms reject tenant/actor spoofing, extra fields and unsupported privileges", () => {
  const request = {
    action: "brand.save",
    input: { name: "Example", slug: "example", personaName: "Assistant" },
  };
  assert.equal(configureChatSchema.safeParse(request).success, true);
  for (const change of [
    { ...request, tenantId: "other" },
    { ...request, actor: "admin" },
    {
      action: "role.grant",
      input: { role: "viewer", permission: "leads:manage", allowed: true },
    },
    { ...request, input: { ...request.input, tenant_id: "other" } },
  ]) {
    assert.equal(configureChatSchema.safeParse(change).success, false);
  }
  assert.equal(
    platformChatSchema.safeParse({
      action: "module.set",
      tenantId: "10000000-0000-4000-8000-000000000001",
      enabled: "false",
    }).success,
    false,
  );
});
