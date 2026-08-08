# OS PLUS V2 Decision Log

This file records locked V2 architecture decisions.

When a decision changes, add a new dated decision entry. Do not silently rewrite history.

---

## V2-D001 - Laundry is an additive vertical

**Status:** ACCEPTED

**Decision:**

Add Laundry as the second OS PLUS vertical.

Fundry is the first Laundry tenant.

Do not fork a separate Fundry management application.

**Reason:**

The current OS Plus product thesis already targets workflow-driven physical businesses.

---

## V2-D002 - Boutique is a protected compatibility contract

**Status:** ACCEPTED

**Decision:**

Do not force existing Boutique orders through the Work Unit runtime during Laundry launch.

**Reason:**

Live clients exist. Current `order_items` and item workflow runtime are operational.

---

## V2-D003 - Dual runtime during Laundry launch

**Status:** ACCEPTED

**Decision:**

Use:

```text
legacy_item_v1
```

for current Boutique orders and:

```text
work_unit_v2
```

for Laundry.

Shared screens use runtime-aware adapters.

**Reason:**

Reduces migration blast radius while allowing the core abstraction to improve.

---

## V2-D004 - Reuse workflow definitions

**Status:** ACCEPTED

**Decision:**

Laundry Work Units use existing tenant-configurable:

- workflows;
- workflow stages;
- Stage Master;
- customer statuses;
- workgroups;
- stage-workgroup mappings.

Do not create Laundry-specific workflow tables.

**Reason:**

Workflow configuration is one of the strongest current platform abstractions.

---

## V2-D005 - Order Line and Work Unit are separate

**Status:** ACCEPTED

**Decision:**

Add:

```text
order_lines
work_units
```

Order Line is commercial.

Work Unit is operational.

**Reason:**

Laundry proves commercial lines, physical containers and production units are not universally the same object.

---

## V2-D006 - Physical custody gets first-class identity

**Status:** ACCEPTED

**Decision:**

Laundry adds Handling Units and Custody Events.

**Reason:**

The business must answer where a physical bag/package is and who had responsibility.

---

## V2-D007 - Reusable hostel bag is a Container Asset

**Status:** ACCEPTED

**Decision:**

Permanent B2B bag such as BAG-017 is a reusable Container Asset.

Each collection creates a new Handling Unit cycle referencing the Container Asset.

**Reason:**

The same physical bag is reused across weekly Orders. Reusing one Handling Unit would merge historical custody cycles.

---

## V2-D008 - One Hostel Collection Batch creates one Order

**Status:** ACCEPTED

**Decision:**

Fundry B2B launch flow:

```text
1 Collection Batch
1 Order
N bags
1 Invoice
N Invoice Lines
```

Each bag remains independently tracked as a Work Unit.

**Reason:**

Matches current Fundry commercial invoicing while fixing operational traceability.

---

## V2-D009 - One hostel bag equals one line/work unit in launch flow

**Status:** ACCEPTED

**Decision:**

For initial Fundry hostel Wash & Iron flow:

```text
1 bag
= 1 Handling Unit cycle
= 1 Service Lot
= 1 Work Unit
= 1 Order Line
= 1 Invoice Line
```

**Reason:**

Matches the existing bulk invoice line-item method and allows bag-level workflow tracking.

**Future:**

A bag may later contain multiple Service Lots.

---

## V2-D010 - Roles and Teams are separate

**Status:** ACCEPTED

**Decision:**

Keep current roles:

```text
owner_admin
manager
finance
viewer
```

Add Teams for operational assignment.

**Reason:**

`Workshop Intake` and `KPHB Store Ops` are operational responsibility groups, not authorization roles.

---

## V2-D011 - Tasks are first-class

**Status:** ACCEPTED

**Decision:**

Add a central Task engine.

**Reason:**

Status tells what is true. Task tells what a human must do next.

The current Fundry problem is partly work existing only in human memory/WhatsApp.

---

## V2-D012 - V2 mutations use Domain Commands

**Status:** ACCEPTED

**Decision:**

QR, UI, future WhatsApp agent, webhook and Telegram call shared Domain Commands.

**Reason:**

Business rules must not be reimplemented per interface.

---

## V2-D013 - Critical multi-row operations must be atomic

**Status:** ACCEPTED

**Decision:**

Use a reviewed transaction/RPC pattern for critical V2 commands.

**Reason:**

Current long server actions can perform several sequential writes. Custody, Manifest and payment operations cannot safely leave partial state.

---

## V2-D014 - Domain Events are append-only, but V2 is not event sourced

**Status:** ACCEPTED

**Decision:**

Current-state tables remain current truth.

Successful V2 Commands emit Domain Events.

**Reason:**

Need cross-interface audit and automation triggers without rebuilding the product as an event-sourced system.

---

## V2-D015 - QR is identity, not instruction

**Status:** ACCEPTED

**Decision:**

QR carries an opaque identity token.

Server resolves current state and legal action.

**Reason:**

The legal next action changes with workflow state.

---

## V2-D016 - Default QR mutation is authenticated

**Status:** ACCEPTED

**Decision:**

Do not let possession of a bag QR mutate business state anonymously.

**Reason:**

Permanent/reusable QRs can leave the tenant premises or be photographed.

---

## V2-D017 - Production and fulfilment are separate

**Status:** ACCEPTED

**Decision:**

Work Unit completes production explicitly.

Delivery/return/store pickup is a separate Fulfilment lifecycle.

**Reason:**

Current label-name delivery inference does not generalize safely.

---

## V2-D018 - Invoice is separate from Order for Laundry V2

**Status:** ACCEPTED

**Decision:**

Add explicit Invoice and Invoice Lines.

**Reason:**

Laundry operations may start before final billable weight/count is known.

---

## V2-D019 - Payment is independent of Invoice

**Status:** ACCEPTED

**Decision:**

Add Payments and Payment Allocations.

**Reason:**

Money may arrive without a known invoice match, and one payment may settle multiple invoices.

---

## V2-D020 - Existing Boutique order payments remain

**Status:** ACCEPTED

**Decision:**

Do not replace `order_payments` during the Laundry launch.

**Reason:**

Protect current Boutique finance behaviour.

---

## V2-D021 - UPI Pay Now is a payment intent

**Status:** ACCEPTED

**Decision:**

Use tenant VPA + Pay Now/QR with unique transaction reference, order/invoice context and prefilled pending amount.

Do not mark paid from intent open/return.

**Reason:**

UPI deep-link intent can simplify payment initiation, but actual payment evidence still requires verification until a trusted provider integration exists.

---

## V2-D022 - Preserve outbound communications foundation

**Status:** ACCEPTED

**Decision:**

Keep current communication settings/templates/triggers/message queue/logs.

Add inbound conversations later.

**Reason:**

The existing provider-neutral outbound foundation is useful and already tenant-safe by design.

---

## V2-D023 - Tracking link becomes primary live Laundry order confirmation

**Status:** ACCEPTED

**Decision:**

Send a tracking link through transactional WhatsApp instead of relying on a static invoice PDF as the primary status surface.

**Reason:**

The public tracking page can show current status, order details and payment CTA.

Invoice PDF may still exist for billing/document requirements.

---

## V2-D024 - AI is not in the first physical operations phase

**Status:** ACCEPTED

**Decision:**

Build demand/custody/work/task truth before agent automation.

Initial future agent intents:

```text
CREATE_PICKUP_REQUEST
ORDER_STATUS
BUSINESS_FAQ
```

**Reason:**

AI should interpret ambiguity, not compensate for missing operational state.

---

## V2-D025 - Root project_summary remains the only living session memory

**Status:** ACCEPTED

**Decision:**

V2 docs live in `docs_v2`.

Session/phase progress remains in root `project_summary.md`.

**Reason:**

The repository already consolidated duplicate project summaries and explicitly archived `docs/05_Project_Summary.md`.

---

## V2-D026 - Phase is tested locally before default phase commit

**Status:** ACCEPTED

**Decision:**

Default V2 phase work remains uncommitted until scope and QA closure.

Update `project_summary.md` throughout the open phase.

Commit after closure evidence.

**Reason:**

The user wants phase completion to represent tested, reviewed work rather than incremental coding checkpoints.

**Exception:**

Explicitly approved checkpoint/emergency workflows may differ and must be recorded.

---

## V2-D027 - Do not perform a broad source-folder refactor

**Status:** ACCEPTED

**Decision:**

Keep current feature folders.

Add `core`, `verticals`, and `integrations` boundaries incrementally where V2 needs them.

**Reason:**

Moving healthy current modules would create a large diff with little business value and high regression risk.

---

## V2-D028 - First V2 coding phase is baseline/testing

**Status:** ACCEPTED

**Decision:**

Do V2-0 before Laundry schema implementation.

**Reason:**

Current automated coverage is not sufficient to safely refactor a live multi-tenant domain without a recorded compatibility baseline.
