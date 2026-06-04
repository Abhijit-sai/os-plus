# Measurement Standards and Order Measurement UX Spec

## Purpose

Make measurements consistent without making order creation stressful.

Boutiques need two separate concepts:

- Tenant-level measurement standards: the default fields a tenant expects for each garment or item type.
- Tenant-level standard size templates: named item-type size sets such as XS, S, M, L, XL, 38, or 40, where each size stores values for the tenant's measurement fields.
- Customer measurements: actual saved measurements for a customer, optionally linked to an item type and optionally selected on an order item.

## Non-Negotiables

- Measurement standards are tenant-owned and must include `tenant_id`.
- Customer measurements are tenant-owned and must include `tenant_id`.
- Order item measurement links are tenant-scoped and must be validated against the order customer.
- Order item standard-size links are tenant-scoped, item-type-scoped, and do not depend on the selected customer.
- Public tracking pages must never expose raw measurements.
- Order item remains the production unit, so measurement selection belongs at item level.

## Proposed Data Model

### item_type_measurement_fields

Tenant-level default measurement configuration for each garment/item type.

Fields:

- `id`
- `tenant_id`
- `item_type_id`
- `field_key`
- `field_label`
- `unit`
- `sort_order`
- `is_required`
- `help_text`
- `is_active`
- `created_at`
- `updated_at`
- `created_by`
- `updated_by`
- `deleted_at`

Rules:

- A tenant can define different fields for Shirt, Pant, Blouse, etc.
- Field keys should be stable inside a tenant and item type.
- Deactivating a field should not delete historical customer measurement values.

### item_type_standard_sizes

Tenant-level standard-size templates for garment types.

Fields:

- `id`
- `tenant_id`
- `item_type_id`
- `size_label`
- `measurement_data_json`
- `sort_order`
- `is_active`
- `created_at`
- `updated_at`
- `created_by`
- `updated_by`
- `deleted_at`

Rules:

- A template belongs to one tenant and one item type.
- `measurement_data_json` stores field-key to value pairs for the active field standards of that item type.
- Size labels such as XS, S, M, L, XL, 38, or 40 are staff-facing names for the combination.
- Standard sizes can be selected on an order item without selecting a customer measurement.
- Deactivating or archiving a size must not expose or alter historical public tracking data.

## UX Plan

### Settings

Add a Measurement Standards section under Settings.

Flow:

1. Select item type.
2. Add/edit expected dimension fields.
3. Reorder fields.
4. Mark fields required/optional.
5. Add/edit standard size templates as a table of values under those fields.

### Customer Profile

When adding a measurement:

- If item type is selected, pre-fill field rows from that item type's tenant-level standard fields.
- Still allow extra fields for one-off boutique needs.
- Save the customer-specific record independently.

Implemented behavior:

- Add and edit measurement dialogs on the customer profile use tenant-level standards.
- Existing custom fields are preserved when editing older records.
- Changing the selected item type refreshes standard rows while keeping filled custom values where possible.

### Order Creation

Current safe behavior:

- Select customer.
- Select item type.
- Choose a fit reference for the order item.
- Standard sizes appear from the selected item type and do not depend on the selected customer.
- Customer measurements appear only after customer selection and are filtered by compatible item type.
- Link either a standard size or a customer measurement to the order item.

Implemented quick-add behavior:

- Add measurement opens from the item row after customer and item type are selected.
- The dialog is not a nested form inside the order creation form.
- The dialog calls a tenant-safe API route, saves the measurement for the selected customer and item type, refreshes available measurements in the builder, and selects the new measurement for that item.
- The current quick-add path uses the selected item type. General measurements can still be managed from the customer profile.

### Workflow View

Show the linked measurement on the item workflow panel.

If no measurement is attached:

- Show "No measurements available for this item."
- Later, offer an internal-only action to attach an existing customer measurement.

## Open Implementation Decisions

- Whether order edit should allow changing item measurement reference after production starts.
- Whether measurement changes after order creation should update the linked order item view live or whether the order item should snapshot measurement values.
- Recommended MVP decision: link live measurement records now; add immutable measurement snapshots later if boutiques need audit-grade historical fit records.

## Current Implementation

- `item_type_measurement_fields` table added.
- `item_type_standard_sizes` table added.
- `order_items.standard_size_id` added alongside `order_items.customer_measurement_id`.
- `/settings/measurement-standards` lets a tenant add, edit, activate/deactivate, and archive standard fields by item type.
- `/settings/measurement-standards` also lets a tenant add, edit, activate/deactivate, and archive standard size templates by item type.
- `/orders/new` loads active standards and uses them to pre-fill quick-add measurement rows for the selected item type.
- `/orders/new` shows item-type standard sizes in the fit-reference dropdown independent of selected customer.
- Customer profile add/edit measurement dialogs load active tenant standards and pre-fill rows by selected item type.
- Order detail and order edit understand both fit reference types.

## Rollout Sequence

1. Fix status/tracking consistency and show linked measurements in workflow view. Done.
2. Add order edit shell for commercial fields and item measurement references. Done.
3. Add quick-add measurement from order creation without nested forms. Done.
4. Add tenant-level measurement standards in Settings. Done.
5. Use tenant standards to pre-fill customer measurement forms. Done.
6. Add standard-size templates for item types. Done.
