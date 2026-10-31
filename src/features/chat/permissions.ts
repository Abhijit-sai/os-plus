import { z } from "zod";

export const chatPermissionSchema = z.enum([
  "leads:view",
  "leads:manage",
  "leads:pii",
  "chat_settings:manage",
  "chat_reports:view",
]);
export type ChatPermission = z.infer<typeof chatPermissionSchema>;
const role = z.enum(["owner_admin", "manager", "viewer", "finance"]);
const accessSchema = z
  .object({
    tenantId: z.string().uuid(),
    tenantActive: z.boolean(),
    moduleEnabled: z.boolean(),
    membership: z
      .object({ tenantId: z.string().uuid(), status: z.string(), role })
      .strict(),
    grants: z.array(
      z
        .object({
          tenantId: z.string().uuid(),
          role,
          permission: z.enum(["leads:view", "leads:pii"]),
          allowed: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();
export type ChatAccess = z.infer<typeof accessSchema>;

/** Chat grants never alter the platform's existing permissions or default routes. */
export function canUseChat(
  input: unknown,
  permission: ChatPermission,
): boolean {
  const parsed = accessSchema.safeParse(input);
  if (!parsed.success || !chatPermissionSchema.safeParse(permission).success)
    return false;
  const access = parsed.data,
    member = access.membership;
  if (
    !access.tenantActive ||
    !access.moduleEnabled ||
    member.status !== "active" ||
    member.tenantId !== access.tenantId
  )
    return false;
  if (member.role === "owner_admin") return true;
  if (member.role === "manager")
    return ["leads:view", "leads:manage", "leads:pii"].includes(permission);
  const granted = (name: "leads:view" | "leads:pii") => {
    const matches = access.grants.filter(
      (grant) =>
        grant.tenantId === access.tenantId &&
        grant.role === member.role &&
        grant.permission === name,
    );
    return matches.length === 1 && matches[0].allowed;
  };
  if (permission === "leads:view") return granted("leads:view");
  if (permission === "leads:pii")
    return granted("leads:view") && granted("leads:pii");
  return false;
}
