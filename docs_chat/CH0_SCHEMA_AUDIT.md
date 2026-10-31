# CH-0 reused-schema and integration audit

Base: deployed origin/main `c701ec346aeb1fb38a364f4da231bff2a9a0232e`.
Inspected 2026-10-07. This is a source/migration audit, **not** a shared-database
introspection or proof that production has applied every migration. No migration
is added/applied in CH-0. Verify the actual migration ledger before future deployment.

## Every table in Architecture §4.9

| Contract | Verified migration/source | Result / future integration |
|---|---|---|
| tenants / tenant_users | 20260517120000_foundation_tenants.sql; 20260601090000_tenant_user_profile_fields.sql; 20260601103000_email_first_tenant_users.sql; 20260705160000_v2_phase_1_platform_primitives.sql | UUID tenant/member IDs; enum roles owner_admin/manager/finance/viewer; active membership required. clerk_user_id now nullable until verified identity links the invited membership; email uniqueness is tenant-scoped. Member composite UNIQUE (tenant_id,id) exists. Do not use a payload/email as webhook tenant authority. |
| customers | 20260519150000_customer_master_measurements.sql; 20260705160000_v2_phase_1_platform_primitives.sql; 20260809100000_customer_import_and_phone_identity.sql | name, optional phone/email/address, deleted_at, actor fields; composite UNIQUE (tenant_id,id). normalized_phone_e164 format check and active UNIQUE (tenant_id,normalized_phone_e164). Exact country-validated tenant match, not raw phone/email similarity. Legacy comments allowing duplicates are superseded by the final migration. |
| customer_addresses | 20260705160000_v2_phase_1_platform_primitives.sql; 20260809100000_customer_import_and_phone_identity.sql | composite customer FK and own composite UNIQUE; address_line_1 required; country code two letters. Current source check: manual, legacy_customer_address, whatsapp, pickup, shopify_import. instagram/facebook are not allowed. Keep raw channel provenance in chat tables; never extend this existing check. |
| customer_external_identities | 20260809100000_customer_import_and_phone_identity.sql | tenant_id, customer_id, provider, external_customer_id, source_metadata_json object, deleted_at. Composite customer FK, active UNIQUE (tenant_id,provider,external_customer_id), RLS. Chat identities belong in new chat_contact_identities, not a customer_phones table. |
| tasks | 20260706130000_v2_phase_3_commands_events_tasks.sql | composite member/team/domain-event FKs; subject_id is a required UUID; source and actor contracts uppercase. tasks_task_type_check and tasks_subject_type_check are the only authorised existing-table extensions. Add CHAT_HANDOFF/LEAD_FOLLOW_UP and lead/chat_conversation later, preserving every old value and transactionally drop/re-add exact names. VERIFY_PAYMENT_CLAIM excluded by owner. Polymorphic subject_id has no DB FK: new commands must validate subject ownership inside the transaction. |
| domain_events | 20260706130000_v2_phase_3_commands_events_tasks.sql | tenant_id, event_type, aggregate_type, aggregate_id UUID, actor_type, actor_id nullable text, source, correlation_id nonblank text, payload_json, occurred_at; append-only update/delete triggers and RLS. event_type is free nonblank text, so new chat event strings need no existing-schema extension. |
| command_idempotency | 20260706130000_v2_phase_3_commands_events_tasks.sql | unique tenant+command_type+idempotency_key; request_hash, processing/completed/failed, result_json, error_json. New chat commands need atomic insert/lock/retry handling. Existing command code locks existing keys but does not prove safe concurrent first submissions for a new command. Do not paste it untested or mistake Promise.all for atomicity. |
| laundry_pickup_requests | 20260707100000_v2_phase_4_laundry_custody.sql; 20260707110000_v2_rpc_security_and_custody_integrity.sql | required customer_id, requested_date and requested_window; address/member/team composite FKs; own composite UNIQUE; status NEW/SCHEDULED/ASSIGNED/OUT_FOR_PICKUP/PICKED_UP/FAILED/CANCELLED. source permits whatsapp/call/manual/web/recurring/other, not instagram/facebook. Create RPC asserts Laundry enabled. No chat write or source/schema change in CH-0. Incomplete inquiry slots cannot be inserted as a real pickup. Future approved booking capability needs chat-owned draft state until complete, and explicit approved confirm/update/cancel contracts. |
| tenant_locations | 20260705160000_v2_phase_1_platform_primitives.sql | UUID, tenant_id, code/name, full address/area/postal/country fields, active/deleted flags, composite UNIQUE and active tenant-code uniqueness; map coordinates/urls/hours/brand facts are new chat tables. RLS enabled. |
| teams | 20260705160000_v2_phase_1_platform_primitives.sql; 20260705170000_v2_phase_1_team_location_fk_fix.sql | composite UNIQUE and tenant-scoped location FK. Initial ON DELETE SET NULL was corrected to RESTRICT. Use final migration, validate active/nondeleted team; actor Clerk id is not assigned_user_id (membership UUID). |

Other new-schema references: `leads.order_id` can use existing orders composite
UNIQUE from 20260706110000_v2_phase_2_work_unit_runtime.sql. Legacy order/payment
lookups must retain tenant filtering. No order, payment, invoice or Boutique field
is changed by this module. Statements/payment actions are not assumed for an
inquiry-focused business and require their later-phase approved capability rules.

## Assumptions contradicted by existing code

1. **Configurable roles:** src/lib/permissions/roles.ts is a static union/map; no role
   settings storage exists. Add tenant-owned chat permissions and server-side PII
   DTOs in CH-1/CH-4 without altering other modules. Chatwoot read-only/custom role
   support requires edition verification; an OS PLUS toggle cannot grant an
   unsupported Chatwoot permission. Keep viewers out of Chatwoot until equivalent
   controls are proved rather than mapping a read-only viewer to agent.
2. **Customer commands:** src/features/customers/actions.ts validates Zod, resolves
   tenant/permission, applies phone rules and duplicate checks; no reusable core
   CreateCustomer command exists. CH-3 needs an additive atomic chat conversion
   command using those rules and the unique phone guard, without refactoring the
   live customer action. Name requirements (UI min 2, DB nonblank) must both hold.
3. **Task entry:** src/features/tasks/actions.ts requires Laundry enabled. A chat-only
   tenant must not call it as a shortcut. Add a chat-specific authenticated command
   adapter; no change to the current Laundry guard.
4. **Actors/sources:** src/core/command-context/{types,server}.ts and DB checks use
   USER/SYSTEM/AGENT/WEBHOOK and OS_PLUS_UI/QR_SCAN/WHATSAPP/TELEGRAM/API/WEBHOOK/
   AUTOMATION. Docs' lower-case agent/webhook/user are descriptions, not stored enum
   values. Always generate/preserve correlation_id and validate membership UUIDs.
5. **RPC security:** 20260707110000 revokes PUBLIC/anon/authenticated execution of
   existing SECURITY DEFINER command RPCs, granting service_role only. Apply that
   explicit boundary to every future chat RPC; server service role bypasses RLS,
   so mandatory tenant predicates and transactional ownership checks still apply.
6. **Webhook auth:** src/proxy.ts protects every non-public API via Clerk. CH-2 must
   expose only exact chat webhook routes, authenticating workspace key/secret on
   server. Do not blanket-public /api or trust a Chatwoot account id. Its matcher
   skips dotted page paths but explicitly includes /api; test signed-token routes.
7. **Supabase:** server client is service-role, nonpersistent; browser uses anon and
   has no Clerk-to-Supabase session mapping. Do not invent client-side RLS membership
   assumptions or expose secrets. Existing tables have RLS without a browser access
   policy, which is a default-deny boundary for this client.
8. **Selected tenant:** src/lib/tenant/context.ts requires active Clerk-linked tenant
   membership and the os_plus_selected_tenant_id cookie when multiple businesses are
   available. A same-person multi-business login still needs verified tenant
   selection. Cross-host handoff must revalidate it, including suspension/revocation.
9. **Shared hostname:** no basePath or cross-origin server-action policy exists in
   next.config.ts. Do not proxy /crm to the entire unchanged app. Dedicated lead
   routing/assets and Clerk/auth/session/origin proof remains CH-4 integration work.
10. **Knowledge/models:** old engine v4 labels and policy numbers are inherited doc
    assumptions, not this new business's approved behavior. Keep a new engine
    identifier; production models, timeouts, language/script and workflows are
    approved at their respective phases. CH-0 sample is synthetic inquiry-only.
11. **Scheduler:** owner selected a new n8n instance on the new Chatwoot server.
    Existing Fundry/Shopify n8n is not reused. No workflow activation until the cron
    endpoint and daily idempotency exist; bearer auth must live in n8n credentials.
12. **Identity verification:** a pre-chat phone field is self-asserted, not proof of
    possession. Website booking/financial data sharing cannot treat it as verified;
    later phases need an explicit verified-channel identity flow. Inquiry answers
    can work without converting a visitor into a customer.

## Baseline evidence (2026-10-07)

- Locked install: 587 packages; no dependency/version changes.
- npm run typecheck: PASS.
- npm run lint: PASS.
- npm run build: PASS; 42/42 static generation steps, existing routes compiled.
- npm run test:roles: PASS (one existing policy suite; runner reports no case count).
- npm run test:v2: PASS (4 suites: baseline, work-unit runtime, commands/events/tasks,
  Laundry custody; runners report no individual case counts).
- npm run test:chat: unavailable by design; created in CH-1, not added early.
- No shared runtime changes, hence no shared-change Boutique regression tier.
  Existing V2/role baseline executed; no browser or shared-database smoke claimed.
- Deployment/backup verification evidence is recorded in the session summary after
  execution; do not infer Linux service/restore success from static checks.
