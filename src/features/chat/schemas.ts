import { z } from "zod";
import { knowledgePackSchema } from "./knowledge-pack.ts";
const id = z.string().uuid();
const name = z.string().trim().min(1).max(160);
export const configureChatSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("brand.save"),
      input: z
        .object({
          id: id.optional(),
          name,
          slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
          personaName: name,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("brand.archive"),
      input: z.object({ id }).strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("branch.map"),
      input: z.object({ brandId: id, locationId: id }).strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("pack.save"),
      input: z.object({ brandId: id, pack: knowledgePackSchema }).strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("pack.publish"),
      input: z.object({ id }).strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("role.grant"),
      input: z
        .object({
          role: z.enum(["viewer", "finance"]),
          permission: z.enum(["leads:view", "leads:pii"]),
          allowed: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("channel.map"),
      input: z
        .object({
          workspaceId: id,
          brandId: id,
          locationId: id.nullable(),
          inboxId: z.number().int().positive().safe(),
          kind: z.enum(["whatsapp", "instagram", "facebook", "website"]),
          name,
        })
        .strict(),
    })
    .strict(),
]);
export const commandKeySchema = z.string().uuid();
export const platformChatSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("workspace.prepare"), tenantId: id }).strict(),
  z
    .object({ action: z.literal("workspace.create"), tenantId: id, name })
    .strict(),
  z
    .object({
      action: z.literal("workspace.link"),
      tenantId: id,
      accountId: z.number().int().positive().safe(),
      token: z.string().min(1).max(8192),
    })
    .strict(),
  z.object({ action: z.literal("workspace.rotate"), tenantId: id }).strict(),
  z.object({ action: z.literal("workspace.suspend"), tenantId: id }).strict(),
  z
    .object({
      action: z.literal("module.set"),
      tenantId: id,
      enabled: z.boolean(),
    })
    .strict(),
]);
export type ConfigureChat = z.infer<typeof configureChatSchema>;
