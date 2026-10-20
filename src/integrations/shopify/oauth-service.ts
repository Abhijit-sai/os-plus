import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ShopifyProbeActor } from "./probe-config.ts";
import { beginShopifyApproval, exchangeShopifyApprovalToken, getShopifyOAuthConfig,
  validateShopifyApprovalCallback, type ShopifyApprovalAttempt } from "./oauth.ts";
import { openShopifyCredential, sealShopifyCredential } from "./oauth-crypto.ts";
import { readShopifyApprovalIdentity } from "./client.ts";
import { ShopifyIntegrationError } from "./errors.ts";

// Boundary is private service-role SQL, never a browser-callable store.
export type ShopifyOAuthStorage = (actor: ShopifyProbeActor, action: string,
  input: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>;
const attemptSchema = z.object({ tenantId: z.string().uuid(), actorId: z.string(), shopDomain: z.string(),
  appRef: z.string(), stateHash: z.string().regex(/^[a-f0-9]{64}$/), expiresAt: z.string() }).strict();
const credentialSchema = z.object({ tenantId: z.string().uuid(), connectionId: z.string().uuid(),
  shopDomain: z.string(), appRef: z.string(), packet: z.unknown(), revision: z.number().int().positive().safe(),
  accessExpiresAt: z.string(), refreshExpiresAt: z.string(), refreshPending: z.boolean() }).strict();

export function createShopifyOAuthService(storage: ShopifyOAuthStorage, transport: typeof fetch = fetch, now = Date.now) {
  return {
    async begin(actor: ShopifyProbeActor, shop: string, signal: AbortSignal, env: NodeJS.ProcessEnv) {
      signal.throwIfAborted();
      const approval = beginShopifyApproval(actor, shop, env, now());
      // Fail before leaving OS Plus if encryption is not provisioned.
      sealShopifyCredential({ accessToken: "provision-check", refreshToken: "provision-check",
        accessExpiresAt: new Date(now()).toISOString(), refreshExpiresAt: new Date(now()).toISOString(), scopes: [] },
      approval.attempt, env);
      await storage(actor, "begin", approval.attempt, signal);
      return { url: approval.url, cookie: approval.cookie };
    },
    async complete(actor: ShopifyProbeActor, query: URLSearchParams, cookie: string, signal: AbortSignal, env: NodeJS.ProcessEnv) {
      getShopifyOAuthConfig(actor, env);
      if (!/^[A-Za-z0-9_-]{43}$/.test(cookie)) throw new ShopifyIntegrationError("ACCESS_DENIED");
      const stateHash = createHash("sha256").update(cookie).digest("hex");
      const attempt: ShopifyApprovalAttempt = attemptSchema.parse(await storage(actor, "read_attempt", { stateHash }, signal));
      const grant = validateShopifyApprovalCallback(actor, query, cookie, attempt, env, now());
      const claim = z.object({ claimToken: z.string().uuid() }).strict().parse(await storage(actor, "claim", { stateHash }, signal));
      const token = await exchangeShopifyApprovalToken(grant.shopDomain, { code: grant.code }, env, signal, transport, now);
      const identity = await readShopifyApprovalIdentity(actor, grant.shopDomain, token.accessToken, signal, env, transport);
      const packet = sealShopifyCredential(token, attempt, env);
      const saved = await storage(actor, "complete", { stateHash, claimToken: claim.claimToken,
        shopGid: identity.shopGid, packet, accessExpiresAt: token.accessExpiresAt, refreshExpiresAt: token.refreshExpiresAt }, signal);
      return z.object({ status: z.literal("connected"), connectionId: z.string().uuid() }).strict().parse(saved);
    },
    async credential(actor: ShopifyProbeActor, connectionId: string, signal: AbortSignal, env: NodeJS.ProcessEnv) {
      const config = getShopifyOAuthConfig(actor, env, "credential");
      z.string().uuid().parse(connectionId);
      const raw = await storage(actor, "read_credential", { connectionId }, signal);
      if (raw === null) return null; // Only absence permits the legacy pilot adapter.
      const record = credentialSchema.parse(raw);
      if (record.tenantId !== actor.tenantId || record.connectionId !== connectionId || record.appRef !== config.clientId)
        throw new ShopifyIntegrationError("ACCESS_DENIED");
      let token = openShopifyCredential(record.packet, record, env);
      if (Date.parse(token.accessExpiresAt) !== Date.parse(record.accessExpiresAt) ||
        Date.parse(token.refreshExpiresAt) !== Date.parse(record.refreshExpiresAt))
        throw new ShopifyIntegrationError("RESPONSE_INVALID");
      if (record.refreshPending) throw new ShopifyIntegrationError("AUTHENTICATION_REQUIRED");
      if (Date.parse(token.accessExpiresAt) <= now() + 60000) {
        if (Date.parse(token.refreshExpiresAt) <= now() + 60000) throw new ShopifyIntegrationError("AUTHENTICATION_REQUIRED");
        const claim = z.object({ lease: z.string().uuid() }).strict().parse(await storage(actor, "claim_refresh",
          { connectionId, revision: record.revision }, signal));
        // Deliberately leave the lease occupied on unknown network/commit
        // outcomes. Reauthorization recovers without reusing a rotated token.
        token = await exchangeShopifyApprovalToken(record.shopDomain, { refreshToken: token.refreshToken }, env, signal, transport, now);
        await storage(actor, "finish_refresh", { connectionId, revision: record.revision, lease: claim.lease,
          packet: sealShopifyCredential(token, record, env), accessExpiresAt: token.accessExpiresAt,
          refreshExpiresAt: token.refreshExpiresAt }, signal);
      }
      return { tenantId: record.tenantId, connectionId, shopDomain: record.shopDomain, appRef: record.appRef,
        accessToken: token.accessToken, expiresAt: token.accessExpiresAt };
    },
  };
}
