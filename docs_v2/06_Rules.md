# OS PLUS V2 Product and Engineering Rules

## 1. Compatibility Rules

1. Existing live Boutique behaviour is a protected compatibility contract.
2. Do not rewrite the Boutique runtime merely to make the architecture visually uniform.
3. Existing Boutique orders remain `legacy_item_v1` until a separately approved convergence phase.
4. Existing `order_items`, item workflow runtime, item history and `order_payments` remain supported.
5. A shared-table migration that touches Boutique behaviour requires Boutique Tier A regression.
6. Historical records must not be silently reinterpreted by new defaults.
7. V2 migrations must be additive by default.
8. Destructive migrations require a written rollback and compatibility plan.
9. No phase closes while a known P0/P1 Boutique regression remains.
10. Never hardcode a tenant slug/name such as `fundry` to activate reusable vertical logic.

## 2. Multi-Tenant Rules

1. Every tenant-owned V2 table must include `tenant_id`.
2. Every V2 Domain Command must receive tenant context.
3. Tenant context is resolved on the server.
4. Client-provided tenant IDs must not be trusted as authorization.
5. Server queries/mutations must filter or constrain by tenant ownership.
6. New critical child tables should use composite tenant ownership foreign keys where practical.
7. RLS is defence in depth and does not replace command-level tenant validation.
8. Service-role access must be treated as bypassing user-scoped RLS protection.
9. Cross-tenant IDs must be rejected even when the UUID exists.
10. Public tokens must not expose another tenant's data.

## 3. Vertical Rules

1. Tenant vertical enablement is explicit.
2. Initial vertical keys are `boutique` and `laundry`.
3. Existing tenants are backfilled to Boutique after review.
4. Laundry-only modules are gated by Laundry capability.
5. Workflow definitions remain tenant-configurable and are not vertical-hardcoded.
6. A vertical may add extension tables to the generic runtime.
7. Shared platform tables must not gain dozens of nullable vertical-specific columns.
8. Vertical extension data must preserve tenant ownership.
9. Future verticals should reuse platform primitives before creating new ones.
10. Vertical-specific terminology may change UI labels but must not alter core security semantics.

## 4. Workflow Rules

1. Preserve existing Stage Master.
2. Preserve existing Workflow and Workflow Stage configuration.
3. Workflow sequence is tenant-configured.
4. V2 Work Units use the same workflow-definition tables.
5. V2 must not hardcode `Wash`, `Dry`, `Iron`, or `Pack` as mandatory stages.
6. Sequential workflow remains the first supported runtime.
7. Future parallel fields already present in workflow definitions must not be broken.
8. Internal stage and customer-facing status remain separate.
9. Stage transitions must validate current state.
10. A browser must not choose arbitrary next stage/status.
11. Stage actions must be tenant-safe.
12. V2 fulfilment must not be inferred from stage names.
13. Label keyword heuristics such as `deliver`/`handoff` must not be added to V2 logic.
14. Major V2 workflow changes emit Domain Events.
15. Where work logs are captured, stage-to-workgroup restrictions remain enforced.

## 5. Work Unit Rules

1. Work Unit is the V2 operational production unit.
2. Work Unit owns one active workflow execution at a time.
3. Work Unit production status is separate from fulfilment.
4. Work Unit may link to one Order Line.
5. Schema may support one Order Line producing multiple Work Units later.
6. Vertical extension tables hold vertical-specific data.
7. Work Unit must not duplicate Laundry Service Lot quantity fields unless needed as a snapshot.
8. Production completion is explicit.
9. Blocked reason is audit-visible.
10. Cancelled Work Units are not silently deleted.

## 6. Laundry Custody Rules

1. Every physical package accepted into tracked Laundry operations receives a Handling Unit identity.
2. Human-readable code and QR identity must resolve to the same operational object.
3. Reusable B2B bag identity belongs to a Container Asset.
4. A Container Asset is not the same as a Handling Unit cycle.
5. Reusing BAG-017 next week creates a new Handling Unit cycle.
6. Custody Events preserve movement history.
7. `current_location_id` is a convenience projection, not the only custody evidence.
8. Manifest dispatch freezes the expected-unit snapshot.
9. Missing Manifest units create an explicit variance.
10. Variance is not resolved by silently removing the missing expected unit.
11. Verification counts are append-only observations/corrections, not overwritten history.
12. No anonymous QR URL may directly mutate custody state.

## 7. QR and Scan Rules

1. QR payload uses an opaque token.
2. Do not place PII in QR payload.
3. Do not place raw database UUIDs in QR payload.
4. Every QR entity has a human-readable fallback code.
5. Default V2 scan mutation requires authenticated operational context.
6. Scan resolves entity and legal actions server-side.
7. UI shows the minimum context required to perform the operation.
8. UI should present one primary legal action where possible.
9. Domain Command validates state again at execution.
10. Duplicate submits must be idempotent.
11. Stale scan actions are rejected with current-state guidance.
12. A future shared Scan Station mode requires explicit enrollment/security design.

## 8. Command Rules

1. Important V2 business mutations use Domain Commands.
2. Commands receive Command Context.
3. Interface-specific code must not duplicate core business rules.
4. UI, QR, webhook, agent, Telegram and API may call the same Command.
5. Commands validate permission/capability where applicable.
6. Commands validate tenant ownership.
7. Critical multi-row changes are atomic.
8. Successful commands emit required Domain Events.
9. Failed atomic commands must not leave partial domain state.
10. Repeat-sensitive commands use idempotency.
11. Command errors should have stable machine-readable codes where useful.
12. Agent-originated commands receive the same validation as human-originated commands.

## 9. Event Rules

1. `domain_events` are append-only operational events.
2. Current-state tables remain the source of current truth.
3. V2 is not full event sourcing.
4. Event payloads should contain useful snapshots/refs, not secret credentials.
5. Events include tenant, actor, source and correlation information.
6. Existing Boutique `item_history` remains supported.
7. Do not bulk-convert historical item history to Domain Events during Laundry launch.
8. External side effects should consume committed events/outbox records.
9. Failed downstream integration must not roll back already committed valid business truth.
10. Event/outbox processing must be retry-safe.

## 10. Task Rules

1. State and Task are different concepts.
2. Tasks represent required human/operational work.
3. Tasks may be assigned to user or Team.
4. Authorization roles remain separate from Teams.
5. Team membership does not grant permission to execute a restricted command.
6. Task status transitions are auditable.
7. Tasks may be created by Command, automation or authorized user.
8. Duplicate event consumption must not create duplicate Tasks.
9. Completing a Task does not automatically change domain state unless the task action invokes the relevant Command.
10. Control Room should surface overdue/high-priority Tasks and exceptions.

## 11. Billing Rules

1. Existing Boutique payment behaviour remains until separate migration approval.
2. Laundry V2 uses explicit Invoices.
3. Order and Invoice are separate objects.
4. Invoice Lines are finalised billing snapshots.
5. Finalised invoice commercial fields are not freely editable.
6. Corrections must use controlled flows.
7. Payment is independent of Invoice.
8. Payment Allocation links money to Invoice.
9. One Payment may allocate to multiple Invoices.
10. Unallocated Payments are allowed.
11. Allocation cannot exceed unallocated Payment amount.
12. Invoice paid amount is derived from active allocations or a transactionally consistent projection.
13. Payment redirect/open does not prove payment.
14. OS Plus V2 is operational billing/receivables, not a full general ledger.
15. Zoho/Tally/accounting adapters remain downstream integrations.

## 12. UPI Rules

1. UPI Pay Now is a payment intent before a trusted provider integration.
2. Tenant configures VPA and payee name.
3. Each payment intent gets a unique transaction reference.
4. Use pending Invoice amount as the prefilled amount.
5. Include customer-safe order/invoice context in the note.
6. QR and Pay Now use the same generated UPI URI.
7. Do not claim the prefilled amount is universally immutable.
8. Do not mark paid from app redirect/return.
9. Staff manually verifies and records payment until trusted provider evidence exists.
10. Razorpay/webhook integration can later create trusted Payments automatically.

## 13. Communications Rules

1. Preserve existing communication channel settings, templates, trigger rules, queue and logs.
2. Existing outbound queue remains an outbound queue, not a conversation database.
3. Tracking link is the primary live customer order-status surface for Laundry.
4. Customer messages use customer-safe variables only.
5. Runtime-neutral render context should be preferred for shared templates.
6. Live provider integration requires tenant-specific connection configuration.
7. Incoming provider webhooks are idempotently stored/processed.
8. Inbound conversations are a later additive layer.
9. Campaign/promotional messaging is not part of the Laundry operations build.
10. Failure to send a message must remain visible/retryable and must not corrupt order state.

## 14. Agent Rules

1. AI is not required for core Laundry custody or production.
2. Agents interpret unstructured input and ambiguity.
3. Agents retrieve structured OS Plus context.
4. Agents propose/use approved tools and Commands.
5. Agents do not execute arbitrary SQL.
6. Cheap/deterministic handling comes before contextual reasoning.
7. Low-risk operations may auto-execute only through Command policy.
8. High-risk financial/customer-remedy operations require human approval.
9. Agent context is tenant-scoped.
10. Original messages remain stored; summaries are derived context.
11. Do not send full lifetime chat history to a model by default.
12. Agent cost must be measured by tenant/use case.

## 15. Operational UX Rules

1. The lowest technical ability of the operational user defines ground UI complexity.
2. Prefer scan over search.
3. Prefer tap over text input.
4. Prefer numeric entry over long description.
5. Prefer optional photo over long typed note where operationally useful.
6. Owner/finance screens may be information-dense.
7. Ground-worker screens must be task-focused.
8. Do not expose internal IDs as primary user identifiers.
9. Human-readable codes must remain visible.
10. Do not require every worker to be a login user.
11. Mobile-first remains mandatory for production/scan/pickup/delivery screens.
12. Exception flows must clearly say what is wrong and what can happen next.

## 16. Testing and Phase Rules

1. Root `project_summary.md` is updated after every major coding session.
2. A phase is not closed when coding is complete.
3. Default V2 work remains uncommitted until phase closure.
4. Every phase runs typecheck, lint, build, role tests and V2 tests.
5. Shared-code changes trigger Boutique regression according to tier.
6. New migrations require local migration review.
7. Tenant-isolation tests are required for new tenant-owned domain tables.
8. Failed tests are recorded in the QA matrix.
9. After fixes, rerun the failed test and affected regression.
10. P0/P1 defects block phase closure.
11. Final diff review is required.
12. Closure evidence is written to `project_summary.md` before the phase commit.
13. Commit message should identify the closed V2 phase.
14. Merge/deploy follows explicit owner approval/current release workflow.
15. Do not silently edit these V2 rules during implementation; document and approve a decision change.
