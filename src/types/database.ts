export type TenantStatus = "active" | "inactive" | "suspended";
export type TenantBillingPaymentStatus = "pending" | "partially_paid" | "paid" | "overdue" | "waived" | "cancelled";
export type TenantVerticalKey = "boutique" | "laundry";
export type TenantLocationType = "store" | "workshop" | "warehouse" | "office" | "other";
export type CustomerAddressSource = "manual" | "legacy_customer_address" | "whatsapp" | "pickup";
export type GstTreatment = "taxable_exclusive" | "taxable_inclusive" | "exempt_or_nil" | "non_gst" | "not_applicable";
export type ExpenseInputGstStatus = "not_applicable" | "claimable" | "needs_review" | "not_claimed";
export type TenantUserRole = "owner_admin" | "manager" | "finance" | "viewer";
export type TenantUserStatus = "active" | "invited" | "disabled";
export type WorkerStatus = "active" | "inactive";
export type WorkerWageType = "hourly" | "daily" | "weekly" | "monthly" | "per_piece" | "hybrid";
export type CustomerGender = "female" | "male" | "other" | "not_specified";
export type OrderSource = "walk_in" | "shopify_manual" | "whatsapp" | "other";
export type DeliveryType = "store_pickup" | "self_delivery" | "courier";
export type PaymentStatus = "unpaid" | "partially_paid" | "paid" | "refunded";
export type OrderStatus = "confirmed" | "in_progress" | "ready" | "partially_delivered" | "completed" | "delivered" | "cancelled";
export type OrderRuntimeModel = "legacy_item_v1" | "work_unit_v2";
export type OrderLineType = "service" | "product" | "fee" | "discount" | "other";
export type WorkUnitStatus = "not_started" | "in_progress" | "blocked" | "production_complete" | "cancelled";
export type WorkUnitWorkflowStatus = "not_started" | "in_progress" | "completed" | "cancelled";
export type CommandActorType = "USER" | "SYSTEM" | "AGENT" | "WEBHOOK";
export type CommandSource = "OS_PLUS_UI" | "QR_SCAN" | "WHATSAPP" | "TELEGRAM" | "API" | "WEBHOOK" | "AUTOMATION";
export type CommandIdempotencyStatus = "processing" | "completed" | "failed";
export type TaskType =
  | "PICKUP"
  | "VERIFY_INTAKE"
  | "RECEIVE_MANIFEST"
  | "INVESTIGATE_VARIANCE"
  | "PROCESS_WORK_UNIT"
  | "DELIVERY"
  | "COLLECT_PAYMENT"
  | "RECONCILE_PAYMENT"
  | "GENERAL";
export type TaskSubjectType =
  | "pickup_request"
  | "handling_unit"
  | "manifest"
  | "work_unit"
  | "order"
  | "invoice"
  | "payment"
  | "delivery"
  | "collection_batch"
  | "general";
export type TaskPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
export type TaskStatus = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "CANCELLED";
export type QRIdentityEntityType = "laundry_container_asset" | "laundry_handling_unit";
export type QRIdentityStatus = "active" | "revoked" | "rotated";
export type LaundryServiceQuantityUnit = "kg" | "piece" | "pair" | "unit" | "sq_ft" | "other";
export type LaundryPickupSource = "whatsapp" | "call" | "manual" | "web" | "recurring" | "other";
export type LaundryPickupStatus = "NEW" | "SCHEDULED" | "ASSIGNED" | "OUT_FOR_PICKUP" | "PICKED_UP" | "FAILED" | "CANCELLED";
export type LaundryContainerType = "bag" | "cover" | "box" | "other";
export type LaundryContainerStatus = "active" | "lost" | "maintenance" | "retired";
export type LaundryHandlingUnitType = "bag" | "cover" | "shoe_packet" | "carpet" | "curtain_bundle" | "other";
export type LaundryCustodyStatus =
  | "EXPECTED"
  | "IN_CUSTOMER_POSSESSION"
  | "PICKED_UP"
  | "AT_STORE"
  | "IN_TRANSFER"
  | "AT_WORKSHOP"
  | "IN_PRODUCTION"
  | "READY"
  | "OUT_FOR_FULFILMENT"
  | "RETURNED_TO_CUSTOMER"
  | "CLOSED"
  | "EXCEPTION";
export type LaundryCustodyEventType =
  | "custody_established"
  | "picked_up"
  | "received_at_location"
  | "dispatched_in_manifest"
  | "received_from_manifest"
  | "out_for_fulfilment"
  | "returned_to_customer"
  | "exception_recorded";
export type ItemStatus =
  | "not_started"
  | "in_production"
  | "blocked"
  | "completed"
  | "ready_for_pickup"
  | "ready_for_dispatch"
  | "dispatched"
  | "delivered"
  | "cancelled";
export type ItemWorkflowStatus = "not_started" | "in_progress" | "completed" | "cancelled";
export type ItemStageStatus =
  | "not_started"
  | "ready_to_start"
  | "in_progress"
  | "paused"
  | "completed"
  | "skipped"
  | "blocked";
export type ItemStageWorkLogStatus = "in_progress" | "paused" | "completed" | "cancelled";
export type AttendanceStatus = "present" | "absent" | "half_day" | "leave" | "holiday";
export type WorkerLedgerTransactionType =
  | "advance_given"
  | "loan_given"
  | "deduction"
  | "repayment"
  | "adjustment"
  | "salary_paid";
export type SalaryPeriodStatus = "draft" | "reviewed" | "finalized" | "paid";
export type SalaryPaymentStatus = "unpaid" | "partially_paid" | "paid";
export type ReceivablePayableType = "receivable" | "payable";
export type ReceivablePayableStatus = "open" | "partially_paid" | "paid" | "cancelled" | "overdue";
export type AttachmentEntityType = "customer" | "measurement" | "order" | "order_item" | "stage_instance" | "worker" | "expense";
export type CommunicationChannel = "whatsapp" | "email";
export type CommunicationChannelMode = "disabled" | "sandbox" | "live";
export type CommunicationTemplatePurpose =
  | "order_update"
  | "tracking_link"
  | "payment_received"
  | "payment_reminder"
  | "pickup_ready"
  | "dispatch_ready"
  | "delivery_update"
  | "custom_safe_note";
export type CommunicationTriggerType =
  | "order_confirmed"
  | "customer_status_changed"
  | "pickup_ready"
  | "dispatch_ready"
  | "order_partially_delivered"
  | "order_delivered"
  | "payment_received"
  | "balance_pending"
  | "payment_reminder_before_delivery"
  | "payment_overdue"
  | "manual_tracking_link"
  | "manual_payment_reminder";
export type CommunicationMessageStatus = "queued" | "sending" | "sent" | "failed" | "skipped" | "cancelled";
export type CommunicationMessageLogEvent =
  | "queued"
  | "previewed"
  | "sent"
  | "failed"
  | "retried"
  | "skipped"
  | "cancelled"
  | "provider_update";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type TenantOwnedBase = {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
};

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  store_name: string;
  logo_url: string | null;
  brand_color: string | null;
  legal_name: string | null;
  registered_address: string | null;
  gst_registered: boolean;
  gstin: string | null;
  default_sales_gst_rate: number;
  default_purchase_gst_rate: number;
  default_order_gst_treatment: GstTreatment;
  default_expense_gst_treatment: GstTreatment;
  status: TenantStatus;
  custom_domain: string | null;
  tracking_subdomain: string | null;
  created_at: string;
  updated_at: string;
};

export type TenantGstRate = TenantOwnedBase & {
  name: string;
  rate_percent: number;
  is_default_sales: boolean;
  is_default_purchase: boolean;
  is_active: boolean;
};

export type TenantUser = {
  id: string;
  tenant_id: string;
  clerk_user_id: string | null;
  role: TenantUserRole;
  status: TenantUserStatus;
  display_name: string | null;
  email: string | null;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type TenantBillingRecord = {
  id: string;
  tenant_id: string;
  billing_period_start: string;
  billing_period_end: string;
  plan_name: string;
  amount_due: number;
  amount_paid: number;
  payment_status: TenantBillingPaymentStatus;
  payment_date: string | null;
  payment_mode: string | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
};

export type VerticalDefinition = {
  id: string;
  key: TenantVerticalKey;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TenantVertical = {
  id: string;
  tenant_id: string;
  vertical_definition_id: string;
  is_enabled: boolean;
  enabled_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type TenantLocation = TenantOwnedBase & {
  code: string;
  name: string;
  location_type: TenantLocationType;
  address_line_1: string | null;
  address_line_2: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country_code: string;
  is_active: boolean;
};

export type CustomerAddress = TenantOwnedBase & {
  customer_id: string;
  label: string;
  address_line_1: string;
  address_line_2: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country_code: string;
  landmark: string | null;
  notes: string | null;
  is_default: boolean;
  source: CustomerAddressSource;
};

export type Team = TenantOwnedBase & {
  name: string;
  code: string;
  description: string | null;
  location_id: string | null;
  is_active: boolean;
};

export type TeamMember = {
  id: string;
  tenant_id: string;
  team_id: string;
  tenant_user_id: string;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  deleted_at: string | null;
};

export type CustomerStatus = TenantOwnedBase & {
  name: string;
  description: string | null;
  sort_order: number;
  is_final_status: boolean;
  is_active: boolean;
};

export type ItemType = TenantOwnedBase & {
  name: string;
  description: string | null;
  default_workflow_id: string | null;
  default_sla_days: number | null;
  is_active: boolean;
};

export type StageMaster = TenantOwnedBase & {
  name: string;
  description: string | null;
  default_customer_status_id: string | null;
  is_active: boolean;
};

export type Workgroup = TenantOwnedBase & {
  name: string;
  description: string | null;
  is_active: boolean;
};

export type PaymentMode = TenantOwnedBase & {
  name: string;
  description: string | null;
  is_active: boolean;
};

export type ExpenseCategory = TenantOwnedBase & {
  name: string;
  is_default: boolean;
  is_active: boolean;
};

export type Workflow = TenantOwnedBase & {
  name: string;
  description: string | null;
  item_type_id: string | null;
  is_default: boolean;
  is_active: boolean;
};

export type WorkflowStage = TenantOwnedBase & {
  workflow_id: string;
  stage_master_id: string;
  sequence_number: number;
  is_mandatory: boolean;
  expected_duration_hours: number | null;
  customer_status_id: string | null;
  requires_attachment: boolean;
  allows_multiple_workers: boolean;
  parent_stage_id: string | null;
  parallel_group_id: string | null;
  dependency_type: string | null;
  is_active: boolean;
};

export type StageWorkgroup = {
  id: string;
  tenant_id: string;
  stage_master_id: string;
  workgroup_id: string;
  created_at: string;
  created_by: string | null;
};

export type Worker = TenantOwnedBase & {
  name: string;
  phone: string | null;
  joining_date: string | null;
  status: WorkerStatus;
  primary_workgroup_id: string | null;
  wage_type: WorkerWageType;
  wage_amount: number;
  notes: string | null;
};

export type WorkerWorkgroup = {
  id: string;
  tenant_id: string;
  worker_id: string;
  workgroup_id: string;
  created_at: string;
  created_by: string | null;
};

export type Customer = TenantOwnedBase & {
  name: string;
  phone: string | null;
  email: string | null;
  gender: CustomerGender | null;
  address: string | null;
  notes: string | null;
};

export type CustomerMeasurement = TenantOwnedBase & {
  customer_id: string;
  item_type_id: string | null;
  reference_name: string | null;
  measurement_data_json: Json;
  notes: string | null;
  photo_url: string | null;
  is_default: boolean;
};

export type ItemTypeMeasurementField = TenantOwnedBase & {
  item_type_id: string;
  field_key: string;
  field_label: string;
  unit: string | null;
  sort_order: number;
  is_required: boolean;
  help_text: string | null;
  is_active: boolean;
};

export type ItemTypeStandardSize = TenantOwnedBase & {
  item_type_id: string;
  size_label: string;
  measurement_data_json: Json;
  sort_order: number;
  is_active: boolean;
};

export type Order = TenantOwnedBase & {
  order_number: string;
  reference_order_id: string | null;
  vertical_key: TenantVerticalKey;
  runtime_model: OrderRuntimeModel;
  source: OrderSource;
  customer_id: string;
  order_date: string;
  promised_delivery_date: string | null;
  delivery_type: DeliveryType;
  delivery_address: string | null;
  subtotal: number;
  discount_amount: number;
  gst_treatment: GstTreatment;
  gst_rate: number;
  taxable_amount: number;
  gst_amount: number;
  total_amount: number;
  amount_paid: number;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  notes: string | null;
  tracking_token: string;
};

export type OrderLine = TenantOwnedBase & {
  order_id: string;
  line_type: OrderLineType;
  name: string;
  description: string | null;
  quantity: number;
  quantity_unit: string;
  unit_price: number;
  discount_amount: number;
  gst_treatment: GstTreatment;
  gst_rate: number;
  estimated_amount: number | null;
  final_amount: number | null;
  source_vertical_key: TenantVerticalKey | null;
  source_object_type: string | null;
  source_object_id: string | null;
  sort_order: number;
};

export type OrderItem = TenantOwnedBase & {
  order_id: string;
  item_type_id: string;
  customer_measurement_id: string | null;
  standard_size_id: string | null;
  name: string;
  description: string | null;
  color: string | null;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  final_price: number;
  workflow_id: string;
  expected_completion_date: string | null;
  delivery_type_override: DeliveryType | null;
  item_status: ItemStatus;
  customer_status_id: string | null;
  is_customer_visible: boolean;
  final_photo_url: string | null;
  notes: string | null;
};

export type OrderPayment = {
  id: string;
  tenant_id: string;
  order_id: string;
  amount: number;
  payment_mode_id: string | null;
  payment_account: string | null;
  payment_date: string;
  reference_number: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type TenantOrderCounter = {
  tenant_id: string;
  last_order_number: number;
  created_at: string;
  updated_at: string;
};

export type ItemWorkflowInstance = TenantOwnedBase & {
  order_item_id: string;
  workflow_id: string;
  status: ItemWorkflowStatus;
  started_at: string | null;
  completed_at: string | null;
  current_stage_instance_id: string | null;
};

export type ItemStageInstance = TenantOwnedBase & {
  workflow_instance_id: string;
  order_item_id: string;
  workflow_stage_id: string;
  stage_master_id: string;
  sequence_number: number;
  status: ItemStageStatus;
  planned_start_at: string | null;
  planned_end_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  customer_status_id: string | null;
  notes: string | null;
};

export type ItemStageWorkLog = {
  id: string;
  tenant_id: string;
  stage_instance_id: string;
  order_item_id: string;
  worker_id: string;
  workgroup_id: string | null;
  started_at: string;
  paused_at: string | null;
  resumed_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
  status: ItemStageWorkLogStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ItemHistory = {
  id: string;
  tenant_id: string;
  order_item_id: string;
  event_type: string;
  old_value_json: Json;
  new_value_json: Json;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type WorkUnit = TenantOwnedBase & {
  order_id: string;
  order_line_id: string | null;
  vertical_key: TenantVerticalKey;
  vertical_object_type: string | null;
  vertical_object_id: string | null;
  display_code: string;
  workflow_id: string;
  current_workflow_instance_id: string | null;
  status: WorkUnitStatus;
  customer_status_id: string | null;
  current_location_id: string | null;
  expected_completion_at: string | null;
  production_completed_at: string | null;
  blocked_reason: string | null;
};

export type WorkUnitWorkflowInstance = TenantOwnedBase & {
  work_unit_id: string;
  workflow_id: string;
  status: WorkUnitWorkflowStatus;
  started_at: string | null;
  completed_at: string | null;
  current_stage_instance_id: string | null;
};

export type WorkUnitStageInstance = TenantOwnedBase & {
  workflow_instance_id: string;
  work_unit_id: string;
  workflow_stage_id: string;
  stage_master_id: string;
  sequence_number: number;
  status: ItemStageStatus;
  planned_start_at: string | null;
  planned_end_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  customer_status_id: string | null;
  notes: string | null;
};

export type WorkUnitStageWorkLog = {
  id: string;
  tenant_id: string;
  stage_instance_id: string;
  work_unit_id: string;
  worker_id: string;
  workgroup_id: string | null;
  started_at: string;
  paused_at: string | null;
  resumed_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
  status: ItemStageWorkLogStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type OrderPaymentCorrection = {
  id: string;
  tenant_id: string;
  order_id: string;
  payment_id: string;
  reason: string;
  old_value_json: Json;
  new_value_json: Json;
  created_by: string;
  created_at: string;
};

export type CommandIdempotency = {
  id: string;
  tenant_id: string;
  command_type: string;
  idempotency_key: string;
  request_hash: string;
  status: CommandIdempotencyStatus;
  result_json: Json | null;
  error_json: Json | null;
  created_at: string;
  completed_at: string | null;
};

export type DomainEvent = {
  id: string;
  tenant_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  actor_type: CommandActorType;
  actor_id: string | null;
  source: CommandSource;
  correlation_id: string;
  causation_event_id: string | null;
  payload_json: Json;
  occurred_at: string;
};

export type Task = TenantOwnedBase & {
  task_type: TaskType;
  title: string;
  description: string | null;
  subject_type: TaskSubjectType;
  subject_id: string;
  assigned_user_id: string | null;
  assigned_team_id: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  source: CommandSource;
  source_event_id: string | null;
  automation_rule_id: string | null;
};

export type TaskHistory = {
  id: string;
  tenant_id: string;
  task_id: string;
  event_type: string;
  old_value_json: Json | null;
  new_value_json: Json | null;
  actor_type: CommandActorType;
  actor_id: string | null;
  source: CommandSource;
  notes: string | null;
  created_at: string;
};

export type QRIdentity = {
  id: string;
  tenant_id: string;
  token: string;
  entity_type: QRIdentityEntityType;
  entity_id: string;
  status: QRIdentityStatus;
  created_at: string;
  rotated_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
};

export type LaundryServiceCatalog = TenantOwnedBase & {
  name: string;
  code: string;
  description: string | null;
  default_workflow_id: string;
  default_sla_hours: number | null;
  default_quantity_unit: LaundryServiceQuantityUnit;
  allows_weight: boolean;
  allows_piece_count: boolean;
  is_active: boolean;
};

export type LaundryPickupRequest = TenantOwnedBase & {
  customer_id: string;
  pickup_address_id: string | null;
  requested_date: string;
  requested_window: string;
  source: LaundryPickupSource;
  status: LaundryPickupStatus;
  assigned_user_id: string | null;
  assigned_team_id: string | null;
  scheduled_at: string | null;
  assigned_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  notes: string | null;
};

export type LaundryContainerAsset = TenantOwnedBase & {
  container_code: string;
  qr_identity_id: string | null;
  container_type: LaundryContainerType;
  assigned_customer_id: string | null;
  status: LaundryContainerStatus;
  notes: string | null;
};

export type LaundryHandlingUnit = TenantOwnedBase & {
  handling_unit_code: string;
  qr_identity_id: string | null;
  container_asset_id: string | null;
  customer_id: string;
  order_id: string | null;
  handling_unit_type: LaundryHandlingUnitType;
  current_location_id: string | null;
  custody_status: LaundryCustodyStatus;
  created_from_pickup_id: string | null;
  created_from_collection_batch_id: string | null;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
};

export type LaundryCustodyEvent = {
  id: string;
  tenant_id: string;
  handling_unit_id: string;
  event_type: LaundryCustodyEventType;
  from_location_id: string | null;
  to_location_id: string | null;
  from_custody_type: string | null;
  from_custody_id: string | null;
  to_custody_type: string | null;
  to_custody_id: string | null;
  manifest_id: string | null;
  actor_type: CommandActorType;
  actor_id: string | null;
  source: CommandSource;
  notes: string | null;
  payload_json: Json;
  occurred_at: string;
};

export type LaundryServiceLot = TenantOwnedBase & {
  work_unit_id: string;
  handling_unit_id: string;
  order_line_id: string;
  service_catalog_id: string;
  quantity: number;
  quantity_unit: LaundryServiceQuantityUnit;
  piece_count: number | null;
  weight_kg: number | null;
  special_instructions: string | null;
  intake_verified_at: string | null;
};

export type Attendance = {
  id: string;
  tenant_id: string;
  worker_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  check_in_time: string | null;
  check_out_time: string | null;
  total_hours: number | null;
  marked_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AttendanceImport = {
  id: string;
  tenant_id: string;
  file_name: string;
  file_hash: string;
  report_month: string;
  idempotency_key: string;
  source_row_count: number;
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  result_json: Json;
  created_by: string | null;
  created_at: string;
};

export type SalaryPeriod = TenantOwnedBase & {
  period_start: string;
  period_end: string;
  status: SalaryPeriodStatus;
};

export type WorkerLedger = {
  id: string;
  tenant_id: string;
  worker_id: string;
  transaction_type: WorkerLedgerTransactionType;
  amount: number;
  transaction_date: string;
  description: string | null;
  linked_salary_period_id: string | null;
  payment_mode_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SalaryCalculation = TenantOwnedBase & {
  salary_period_id: string;
  worker_id: string;
  wage_type: WorkerWageType;
  wage_amount: number;
  attendance_days: number;
  attendance_hours: number;
  productive_minutes: number;
  gross_suggested_amount: number;
  advance_deduction: number;
  loan_deduction: number;
  other_deduction: number;
  repayment_credit: number;
  manual_adjustment: number;
  final_payable: number;
  finalized_payable_amount: number | null;
  finalized_at: string | null;
  finalized_by: string | null;
  finalization_note: string | null;
  amount_paid: number;
  payment_status: SalaryPaymentStatus;
  payment_date: string | null;
  payment_mode_id: string | null;
  notes: string | null;
};

export type Expense = {
  id: string;
  tenant_id: string;
  expense_date: string;
  category_id: string | null;
  amount: number;
  payment_mode_id: string | null;
  paid_to: string | null;
  vendor_gstin: string | null;
  vendor_invoice_number: string | null;
  vendor_invoice_date: string | null;
  gst_treatment: GstTreatment;
  gst_rate: number;
  taxable_amount: number;
  gst_amount: number;
  input_gst_status: ExpenseInputGstStatus;
  description: string | null;
  receipt_url: string | null;
  is_recurring: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ReceivablePayable = {
  id: string;
  tenant_id: string;
  type: ReceivablePayableType;
  party_name: string;
  amount: number;
  amount_settled: number;
  due_date: string | null;
  settled_at: string | null;
  status: ReceivablePayableStatus;
  description: string | null;
  linked_order_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Attachment = TenantOwnedBase & {
  entity_type: AttachmentEntityType;
  entity_id: string;
  file_url: string;
  file_type: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  file_size_bytes: number | null;
  label: string | null;
  notes: string | null;
  is_customer_visible: boolean;
  uploaded_by: string | null;
};

export type CommunicationChannelSetting = TenantOwnedBase & {
  channel: CommunicationChannel;
  provider: string | null;
  mode: CommunicationChannelMode;
  is_enabled: boolean;
  sender_name: string | null;
  sender_address: string | null;
  reply_to: string | null;
  provider_config_json: Json;
};

export type CommunicationTemplate = TenantOwnedBase & {
  channel: CommunicationChannel;
  purpose: CommunicationTemplatePurpose;
  name: string;
  subject: string | null;
  body_text: string;
  body_html: string | null;
  provider_template_name: string | null;
  safe_variables: Json;
  is_active: boolean;
};

export type CommunicationTriggerRule = TenantOwnedBase & {
  trigger_type: CommunicationTriggerType;
  channel: CommunicationChannel;
  template_id: string;
  delay_minutes: number;
  is_enabled: boolean;
};

export type CommunicationMessageQueue = TenantOwnedBase & {
  channel: CommunicationChannel;
  customer_id: string | null;
  order_id: string | null;
  order_item_id: string | null;
  receivable_payable_id: string | null;
  template_id: string | null;
  trigger_rule_id: string | null;
  trigger_type: CommunicationTriggerType | null;
  trigger_event_key: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  subject: string | null;
  body_text: string;
  body_html: string | null;
  status: CommunicationMessageStatus;
  scheduled_for: string;
  sent_at: string | null;
  attempt_count: number;
  provider_message_id: string | null;
  provider_response_json: Json;
  last_error: string | null;
};

export type CommunicationMessageLog = {
  id: string;
  tenant_id: string;
  message_queue_id: string | null;
  event_type: CommunicationMessageLogEvent;
  old_status: CommunicationMessageStatus | null;
  new_status: CommunicationMessageStatus | null;
  notes: string | null;
  provider_response_json: Json;
  created_by: string | null;
  created_at: string;
};

type TenantOwnedInsertBase = {
  id?: string;
  tenant_id: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;
};

type TenantRelationship = {
  foreignKeyName: string;
  columns: ["tenant_id"];
  isOneToOne: false;
  referencedRelation: "tenants";
  referencedColumns: ["id"];
};

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: Tenant;
        Insert: Omit<Tenant, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Tenant, "id" | "created_at">>;
        Relationships: [];
      };
      tenant_users: {
        Row: TenantUser;
        Insert: Omit<TenantUser, "id" | "created_at" | "updated_at" | "display_name" | "email" | "updated_by" | "clerk_user_id"> & {
          id?: string;
          clerk_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
          display_name?: string | null;
          email?: string | null;
          updated_by?: string | null;
        };
        Update: Partial<Omit<TenantUser, "id" | "created_at">>;
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
      tenant_billing_records: {
        Row: TenantBillingRecord;
        Insert: Omit<TenantBillingRecord, "id" | "created_at" | "updated_at" | "deleted_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Omit<TenantBillingRecord, "id" | "tenant_id" | "created_at">>;
        Relationships: [
          {
            foreignKeyName: "tenant_billing_records_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
      tenant_gst_rates: {
        Row: TenantGstRate;
        Insert: TenantOwnedInsertBase & {
          name: string;
          rate_percent: number;
          is_default_sales?: boolean;
          is_default_purchase?: boolean;
          is_active?: boolean;
        };
        Update: Partial<Omit<TenantGstRate, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      vertical_definitions: {
        Row: VerticalDefinition;
        Insert: {
          id?: string;
          key: TenantVerticalKey;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<VerticalDefinition, "id" | "created_at">>;
        Relationships: [];
      };
      tenant_verticals: {
        Row: TenantVertical;
        Insert: {
          id?: string;
          tenant_id: string;
          vertical_definition_id: string;
          is_enabled?: boolean;
          enabled_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: Partial<Omit<TenantVertical, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      tenant_locations: {
        Row: TenantLocation;
        Insert: TenantOwnedInsertBase & {
          code: string;
          name: string;
          location_type?: TenantLocationType;
          address_line_1?: string | null;
          address_line_2?: string | null;
          area?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          country_code?: string;
          is_active?: boolean;
        };
        Update: Partial<Omit<TenantLocation, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      customer_addresses: {
        Row: CustomerAddress;
        Insert: TenantOwnedInsertBase & {
          customer_id: string;
          label: string;
          address_line_1: string;
          address_line_2?: string | null;
          area?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          country_code?: string;
          landmark?: string | null;
          notes?: string | null;
          is_default?: boolean;
          source?: CustomerAddressSource;
        };
        Update: Partial<Omit<CustomerAddress, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      teams: {
        Row: Team;
        Insert: TenantOwnedInsertBase & {
          name: string;
          code: string;
          description?: string | null;
          location_id?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Omit<Team, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      team_members: {
        Row: TeamMember;
        Insert: {
          id?: string;
          tenant_id: string;
          team_id: string;
          tenant_user_id: string;
          is_active?: boolean;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
        };
        Update: Partial<Omit<TeamMember, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      customers: {
        Row: Customer;
        Insert: TenantOwnedInsertBase & {
          name: string;
          phone?: string | null;
          email?: string | null;
          gender?: CustomerGender | null;
          address?: string | null;
          notes?: string | null;
        };
        Update: Partial<Omit<Customer, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      customer_measurements: {
        Row: CustomerMeasurement;
        Insert: TenantOwnedInsertBase & {
          customer_id: string;
          item_type_id?: string | null;
          reference_name?: string | null;
          measurement_data_json?: Json;
          notes?: string | null;
          photo_url?: string | null;
          is_default?: boolean;
        };
        Update: Partial<Omit<CustomerMeasurement, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      item_type_measurement_fields: {
        Row: ItemTypeMeasurementField;
        Insert: TenantOwnedInsertBase & {
          item_type_id: string;
          field_key: string;
          field_label: string;
          unit?: string | null;
          sort_order?: number;
          is_required?: boolean;
          help_text?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Omit<ItemTypeMeasurementField, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      item_type_standard_sizes: {
        Row: ItemTypeStandardSize;
        Insert: TenantOwnedInsertBase & {
          item_type_id: string;
          size_label: string;
          measurement_data_json?: Json;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: Partial<Omit<ItemTypeStandardSize, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      orders: {
        Row: Order;
        Insert: TenantOwnedInsertBase & {
          order_number?: string;
          reference_order_id?: string | null;
          vertical_key?: TenantVerticalKey;
          runtime_model?: OrderRuntimeModel;
          source?: OrderSource;
          customer_id: string;
          order_date?: string;
          promised_delivery_date?: string | null;
          delivery_type?: DeliveryType;
          delivery_address?: string | null;
          subtotal?: number;
          discount_amount?: number;
          gst_treatment?: GstTreatment;
          gst_rate?: number;
          taxable_amount?: number;
          gst_amount?: number;
          total_amount?: number;
          amount_paid?: number;
          payment_status?: PaymentStatus;
          order_status?: OrderStatus;
          notes?: string | null;
          tracking_token: string;
        };
        Update: Partial<Omit<Order, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      order_lines: {
        Row: OrderLine;
        Insert: TenantOwnedInsertBase & {
          order_id: string;
          line_type?: OrderLineType;
          name: string;
          description?: string | null;
          quantity?: number;
          quantity_unit?: string;
          unit_price?: number;
          discount_amount?: number;
          gst_treatment?: GstTreatment;
          gst_rate?: number;
          estimated_amount?: number | null;
          final_amount?: number | null;
          source_vertical_key?: TenantVerticalKey | null;
          source_object_type?: string | null;
          source_object_id?: string | null;
          sort_order?: number;
        };
        Update: Partial<Omit<OrderLine, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      order_items: {
        Row: OrderItem;
        Insert: TenantOwnedInsertBase & {
          order_id: string;
          item_type_id: string;
          customer_measurement_id?: string | null;
          standard_size_id?: string | null;
          name: string;
          description?: string | null;
          color?: string | null;
          quantity?: number;
          unit_price?: number;
          discount_amount?: number;
          final_price?: number;
          workflow_id: string;
          expected_completion_date?: string | null;
          delivery_type_override?: DeliveryType | null;
          item_status?: ItemStatus;
          customer_status_id?: string | null;
          is_customer_visible?: boolean;
          final_photo_url?: string | null;
          notes?: string | null;
        };
        Update: Partial<Omit<OrderItem, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      order_payments: {
        Row: OrderPayment;
        Insert: {
          id?: string;
          tenant_id: string;
          order_id: string;
          amount: number;
          payment_mode_id?: string | null;
          payment_account?: string | null;
          payment_date?: string;
          reference_number?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Omit<OrderPayment, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      tenant_order_counters: {
        Row: TenantOrderCounter;
        Insert: {
          tenant_id: string;
          last_order_number?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<TenantOrderCounter, "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      item_workflow_instances: {
        Row: ItemWorkflowInstance;
        Insert: TenantOwnedInsertBase & {
          order_item_id: string;
          workflow_id: string;
          status?: ItemWorkflowStatus;
          started_at?: string | null;
          completed_at?: string | null;
          current_stage_instance_id?: string | null;
        };
        Update: Partial<Omit<ItemWorkflowInstance, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      item_stage_instances: {
        Row: ItemStageInstance;
        Insert: TenantOwnedInsertBase & {
          workflow_instance_id: string;
          order_item_id: string;
          workflow_stage_id: string;
          stage_master_id: string;
          sequence_number: number;
          status?: ItemStageStatus;
          planned_start_at?: string | null;
          planned_end_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          customer_status_id?: string | null;
          notes?: string | null;
        };
        Update: Partial<Omit<ItemStageInstance, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      item_stage_work_logs: {
        Row: ItemStageWorkLog;
        Insert: {
          id?: string;
          tenant_id: string;
          stage_instance_id: string;
          order_item_id: string;
          worker_id: string;
          workgroup_id?: string | null;
          started_at?: string;
          paused_at?: string | null;
          resumed_at?: string | null;
          completed_at?: string | null;
          duration_minutes?: number | null;
          status?: ItemStageWorkLogStatus;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Omit<ItemStageWorkLog, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      item_history: {
        Row: ItemHistory;
        Insert: {
          id?: string;
          tenant_id: string;
          order_item_id: string;
          event_type: string;
          old_value_json?: Json;
          new_value_json?: Json;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Omit<ItemHistory, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      order_payment_corrections: {
        Row: OrderPaymentCorrection;
        Insert: {
          id?: string;
          tenant_id: string;
          order_id: string;
          payment_id: string;
          reason: string;
          old_value_json: Json;
          new_value_json: Json;
          created_by: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [TenantRelationship];
      };
      work_units: {
        Row: WorkUnit;
        Insert: TenantOwnedInsertBase & {
          order_id: string;
          order_line_id?: string | null;
          vertical_key: TenantVerticalKey;
          vertical_object_type?: string | null;
          vertical_object_id?: string | null;
          display_code: string;
          workflow_id: string;
          current_workflow_instance_id?: string | null;
          status?: WorkUnitStatus;
          customer_status_id?: string | null;
          current_location_id?: string | null;
          expected_completion_at?: string | null;
          production_completed_at?: string | null;
          blocked_reason?: string | null;
        };
        Update: Partial<Omit<WorkUnit, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      work_unit_workflow_instances: {
        Row: WorkUnitWorkflowInstance;
        Insert: TenantOwnedInsertBase & {
          work_unit_id: string;
          workflow_id: string;
          status?: WorkUnitWorkflowStatus;
          started_at?: string | null;
          completed_at?: string | null;
          current_stage_instance_id?: string | null;
        };
        Update: Partial<Omit<WorkUnitWorkflowInstance, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      work_unit_stage_instances: {
        Row: WorkUnitStageInstance;
        Insert: TenantOwnedInsertBase & {
          workflow_instance_id: string;
          work_unit_id: string;
          workflow_stage_id: string;
          stage_master_id: string;
          sequence_number: number;
          status?: ItemStageStatus;
          planned_start_at?: string | null;
          planned_end_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          customer_status_id?: string | null;
          notes?: string | null;
        };
        Update: Partial<Omit<WorkUnitStageInstance, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      work_unit_stage_work_logs: {
        Row: WorkUnitStageWorkLog;
        Insert: {
          id?: string;
          tenant_id: string;
          stage_instance_id: string;
          work_unit_id: string;
          worker_id: string;
          workgroup_id?: string | null;
          started_at?: string;
          paused_at?: string | null;
          resumed_at?: string | null;
          completed_at?: string | null;
          duration_minutes?: number | null;
          status?: ItemStageWorkLogStatus;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Omit<WorkUnitStageWorkLog, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      command_idempotency: {
        Row: CommandIdempotency;
        Insert: {
          id?: string;
          tenant_id: string;
          command_type: string;
          idempotency_key: string;
          request_hash: string;
          status?: CommandIdempotencyStatus;
          result_json?: Json | null;
          error_json?: Json | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: Partial<Omit<CommandIdempotency, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      domain_events: {
        Row: DomainEvent;
        Insert: {
          id?: string;
          tenant_id: string;
          event_type: string;
          aggregate_type: string;
          aggregate_id: string;
          actor_type: CommandActorType;
          actor_id?: string | null;
          source: CommandSource;
          correlation_id: string;
          causation_event_id?: string | null;
          payload_json?: Json;
          occurred_at?: string;
        };
        Update: never;
        Relationships: [TenantRelationship];
      };
      tasks: {
        Row: Task;
        Insert: TenantOwnedInsertBase & {
          task_type: TaskType;
          title: string;
          description?: string | null;
          subject_type: TaskSubjectType;
          subject_id: string;
          assigned_user_id?: string | null;
          assigned_team_id?: string | null;
          priority?: TaskPriority;
          status?: TaskStatus;
          due_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          source: CommandSource;
          source_event_id?: string | null;
          automation_rule_id?: string | null;
        };
        Update: Partial<Omit<Task, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      task_history: {
        Row: TaskHistory;
        Insert: {
          id?: string;
          tenant_id: string;
          task_id: string;
          event_type: string;
          old_value_json?: Json | null;
          new_value_json?: Json | null;
          actor_type: CommandActorType;
          actor_id?: string | null;
          source: CommandSource;
          notes?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [TenantRelationship];
      };
      qr_identities: {
        Row: QRIdentity;
        Insert: {
          id?: string;
          tenant_id: string;
          token: string;
          entity_type: QRIdentityEntityType;
          entity_id: string;
          status?: QRIdentityStatus;
          created_at?: string;
          rotated_at?: string | null;
          revoked_at?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Omit<QRIdentity, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      laundry_service_catalog: {
        Row: LaundryServiceCatalog;
        Insert: TenantOwnedInsertBase & {
          name: string;
          code: string;
          description?: string | null;
          default_workflow_id: string;
          default_sla_hours?: number | null;
          default_quantity_unit?: LaundryServiceQuantityUnit;
          allows_weight?: boolean;
          allows_piece_count?: boolean;
          is_active?: boolean;
        };
        Update: Partial<Omit<LaundryServiceCatalog, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      laundry_pickup_requests: {
        Row: LaundryPickupRequest;
        Insert: TenantOwnedInsertBase & {
          customer_id: string;
          pickup_address_id?: string | null;
          requested_date: string;
          requested_window: string;
          source: LaundryPickupSource;
          status?: LaundryPickupStatus;
          assigned_user_id?: string | null;
          assigned_team_id?: string | null;
          scheduled_at?: string | null;
          assigned_at?: string | null;
          arrived_at?: string | null;
          completed_at?: string | null;
          notes?: string | null;
        };
        Update: Partial<Omit<LaundryPickupRequest, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      laundry_container_assets: {
        Row: LaundryContainerAsset;
        Insert: TenantOwnedInsertBase & {
          container_code: string;
          qr_identity_id?: string | null;
          container_type?: LaundryContainerType;
          assigned_customer_id?: string | null;
          status?: LaundryContainerStatus;
          notes?: string | null;
        };
        Update: Partial<Omit<LaundryContainerAsset, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      laundry_handling_units: {
        Row: LaundryHandlingUnit;
        Insert: TenantOwnedInsertBase & {
          handling_unit_code: string;
          qr_identity_id?: string | null;
          container_asset_id?: string | null;
          customer_id: string;
          order_id?: string | null;
          handling_unit_type?: LaundryHandlingUnitType;
          current_location_id?: string | null;
          custody_status?: LaundryCustodyStatus;
          created_from_pickup_id?: string | null;
          created_from_collection_batch_id?: string | null;
          opened_at?: string;
          closed_at?: string | null;
          notes?: string | null;
        };
        Update: Partial<Omit<LaundryHandlingUnit, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      laundry_custody_events: {
        Row: LaundryCustodyEvent;
        Insert: {
          id?: string;
          tenant_id: string;
          handling_unit_id: string;
          event_type: LaundryCustodyEventType;
          from_location_id?: string | null;
          to_location_id?: string | null;
          from_custody_type?: string | null;
          from_custody_id?: string | null;
          to_custody_type?: string | null;
          to_custody_id?: string | null;
          manifest_id?: string | null;
          actor_type: CommandActorType;
          actor_id?: string | null;
          source: CommandSource;
          notes?: string | null;
          payload_json?: Json;
          occurred_at?: string;
        };
        Update: never;
        Relationships: [TenantRelationship];
      };
      laundry_service_lots: {
        Row: LaundryServiceLot;
        Insert: TenantOwnedInsertBase & {
          work_unit_id: string;
          handling_unit_id: string;
          order_line_id: string;
          service_catalog_id: string;
          quantity?: number;
          quantity_unit?: LaundryServiceQuantityUnit;
          piece_count?: number | null;
          weight_kg?: number | null;
          special_instructions?: string | null;
          intake_verified_at?: string | null;
        };
        Update: Partial<Omit<LaundryServiceLot, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      attendance: {
        Row: Attendance;
        Insert: {
          id?: string;
          tenant_id: string;
          worker_id: string;
          attendance_date: string;
          status?: AttendanceStatus;
          check_in_time?: string | null;
          check_out_time?: string | null;
          total_hours?: number | null;
          marked_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Omit<Attendance, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      attendance_imports: {
        Row: AttendanceImport;
        Insert: {
          id?: string;
          tenant_id: string;
          file_name: string;
          file_hash: string;
          report_month: string;
          idempotency_key: string;
          source_row_count?: number;
          inserted_count?: number;
          updated_count?: number;
          skipped_count?: number;
          result_json?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [TenantRelationship];
      };
      salary_periods: {
        Row: SalaryPeriod;
        Insert: TenantOwnedInsertBase & {
          period_start: string;
          period_end: string;
          status?: SalaryPeriodStatus;
        };
        Update: Partial<Omit<SalaryPeriod, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      worker_ledger: {
        Row: WorkerLedger;
        Insert: {
          id?: string;
          tenant_id: string;
          worker_id: string;
          transaction_type: WorkerLedgerTransactionType;
          amount: number;
          transaction_date?: string;
          description?: string | null;
          linked_salary_period_id?: string | null;
          payment_mode_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Omit<WorkerLedger, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      salary_calculations: {
        Row: SalaryCalculation;
        Insert: TenantOwnedInsertBase & {
          salary_period_id: string;
          worker_id: string;
          wage_type: WorkerWageType;
          wage_amount?: number;
          attendance_days?: number;
          attendance_hours?: number;
          productive_minutes?: number;
          gross_suggested_amount?: number;
          advance_deduction?: number;
          loan_deduction?: number;
          other_deduction?: number;
          repayment_credit?: number;
          manual_adjustment?: number;
          final_payable?: number;
          finalized_payable_amount?: number | null;
          finalized_at?: string | null;
          finalized_by?: string | null;
          finalization_note?: string | null;
          amount_paid?: number;
          payment_status?: SalaryPaymentStatus;
          payment_date?: string | null;
          payment_mode_id?: string | null;
          notes?: string | null;
        };
        Update: Partial<Omit<SalaryCalculation, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      expenses: {
        Row: Expense;
        Insert: {
          id?: string;
          tenant_id: string;
          expense_date?: string;
          category_id?: string | null;
          amount: number;
          payment_mode_id?: string | null;
          paid_to?: string | null;
          vendor_gstin?: string | null;
          vendor_invoice_number?: string | null;
          vendor_invoice_date?: string | null;
          gst_treatment?: GstTreatment;
          gst_rate?: number;
          taxable_amount?: number;
          gst_amount?: number;
          input_gst_status?: ExpenseInputGstStatus;
          description?: string | null;
          receipt_url?: string | null;
          is_recurring?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Omit<Expense, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      receivables_payables: {
        Row: ReceivablePayable;
        Insert: {
          id?: string;
          tenant_id: string;
          type: ReceivablePayableType;
          party_name: string;
          amount: number;
          amount_settled?: number;
          due_date?: string | null;
          settled_at?: string | null;
          status?: ReceivablePayableStatus;
          description?: string | null;
          linked_order_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Omit<ReceivablePayable, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      attachments: {
        Row: Attachment;
        Insert: TenantOwnedInsertBase & {
          entity_type: AttachmentEntityType;
          entity_id: string;
          file_url: string;
          file_type?: string | null;
          storage_bucket?: string | null;
          storage_path?: string | null;
          file_size_bytes?: number | null;
          label?: string | null;
          notes?: string | null;
          is_customer_visible?: boolean;
          uploaded_by?: string | null;
        };
        Update: Partial<Omit<Attachment, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      communication_channel_settings: {
        Row: CommunicationChannelSetting;
        Insert: TenantOwnedInsertBase & {
          channel: CommunicationChannel;
          provider?: string | null;
          mode?: CommunicationChannelMode;
          is_enabled?: boolean;
          sender_name?: string | null;
          sender_address?: string | null;
          reply_to?: string | null;
          provider_config_json?: Json;
        };
        Update: Partial<Omit<CommunicationChannelSetting, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      communication_templates: {
        Row: CommunicationTemplate;
        Insert: TenantOwnedInsertBase & {
          channel: CommunicationChannel;
          purpose: CommunicationTemplatePurpose;
          name: string;
          subject?: string | null;
          body_text: string;
          body_html?: string | null;
          provider_template_name?: string | null;
          safe_variables?: Json;
          is_active?: boolean;
        };
        Update: Partial<Omit<CommunicationTemplate, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      communication_trigger_rules: {
        Row: CommunicationTriggerRule;
        Insert: TenantOwnedInsertBase & {
          trigger_type: CommunicationTriggerType;
          channel: CommunicationChannel;
          template_id: string;
          delay_minutes?: number;
          is_enabled?: boolean;
        };
        Update: Partial<Omit<CommunicationTriggerRule, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      communication_message_queue: {
        Row: CommunicationMessageQueue;
        Insert: TenantOwnedInsertBase & {
          channel: CommunicationChannel;
          customer_id?: string | null;
          order_id?: string | null;
          order_item_id?: string | null;
          receivable_payable_id?: string | null;
          template_id?: string | null;
          trigger_rule_id?: string | null;
          trigger_type?: CommunicationTriggerType | null;
          trigger_event_key?: string | null;
          recipient_name?: string | null;
          recipient_phone?: string | null;
          recipient_email?: string | null;
          subject?: string | null;
          body_text: string;
          body_html?: string | null;
          status?: CommunicationMessageStatus;
          scheduled_for?: string;
          sent_at?: string | null;
          attempt_count?: number;
          provider_message_id?: string | null;
          provider_response_json?: Json;
          last_error?: string | null;
        };
        Update: Partial<Omit<CommunicationMessageQueue, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      communication_message_logs: {
        Row: CommunicationMessageLog;
        Insert: {
          id?: string;
          tenant_id: string;
          message_queue_id?: string | null;
          event_type: CommunicationMessageLogEvent;
          old_status?: CommunicationMessageStatus | null;
          new_status?: CommunicationMessageStatus | null;
          notes?: string | null;
          provider_response_json?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Omit<CommunicationMessageLog, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      customer_statuses: {
        Row: CustomerStatus;
        Insert: TenantOwnedInsertBase & {
          name: string;
          description?: string | null;
          sort_order?: number;
          is_final_status?: boolean;
          is_active?: boolean;
        };
        Update: Partial<Omit<CustomerStatus, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      item_types: {
        Row: ItemType;
        Insert: TenantOwnedInsertBase & {
          name: string;
          description?: string | null;
          default_workflow_id?: string | null;
          default_sla_days?: number | null;
          is_active?: boolean;
        };
        Update: Partial<Omit<ItemType, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      stage_master: {
        Row: StageMaster;
        Insert: TenantOwnedInsertBase & {
          name: string;
          description?: string | null;
          default_customer_status_id?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Omit<StageMaster, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      workgroups: {
        Row: Workgroup;
        Insert: TenantOwnedInsertBase & {
          name: string;
          description?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Omit<Workgroup, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      payment_modes: {
        Row: PaymentMode;
        Insert: TenantOwnedInsertBase & {
          name: string;
          description?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Omit<PaymentMode, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      expense_categories: {
        Row: ExpenseCategory;
        Insert: TenantOwnedInsertBase & {
          name: string;
          is_default?: boolean;
          is_active?: boolean;
        };
        Update: Partial<Omit<ExpenseCategory, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      workflows: {
        Row: Workflow;
        Insert: TenantOwnedInsertBase & {
          name: string;
          description?: string | null;
          item_type_id?: string | null;
          is_default?: boolean;
          is_active?: boolean;
        };
        Update: Partial<Omit<Workflow, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      workflow_stages: {
        Row: WorkflowStage;
        Insert: TenantOwnedInsertBase & {
          workflow_id: string;
          stage_master_id: string;
          sequence_number: number;
          is_mandatory?: boolean;
          expected_duration_hours?: number | null;
          customer_status_id?: string | null;
          requires_attachment?: boolean;
          allows_multiple_workers?: boolean;
          parent_stage_id?: string | null;
          parallel_group_id?: string | null;
          dependency_type?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Omit<WorkflowStage, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      stage_workgroups: {
        Row: StageWorkgroup;
        Insert: {
          id?: string;
          tenant_id: string;
          stage_master_id: string;
          workgroup_id: string;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Omit<StageWorkgroup, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      workers: {
        Row: Worker;
        Insert: TenantOwnedInsertBase & {
          name: string;
          phone?: string | null;
          joining_date?: string | null;
          status?: WorkerStatus;
          primary_workgroup_id?: string | null;
          wage_type?: WorkerWageType;
          wage_amount?: number;
          notes?: string | null;
        };
        Update: Partial<Omit<Worker, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
      worker_workgroups: {
        Row: WorkerWorkgroup;
        Insert: {
          id?: string;
          tenant_id: string;
          worker_id: string;
          workgroup_id: string;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Omit<WorkerWorkgroup, "id" | "tenant_id" | "created_at">>;
        Relationships: [TenantRelationship];
      };
    };
    Views: Record<string, never>;
    Functions: {
      import_attendance_rows: {
        Args: {
          p_tenant_id: string;
          p_file_name: string;
          p_file_hash: string;
          p_report_month: string;
          p_idempotency_key: string;
          p_rows: Json;
          p_summary: Json;
          p_actor_id: string;
        };
        Returns: Json;
      };
      add_items_to_existing_order: {
        Args: {
          p_tenant_id: string;
          p_order_id: string;
          p_items: Json;
          p_actor_id: string;
          p_idempotency_key: string;
        };
        Returns: Json;
      };
      recalculate_order_payment_summary: {
        Args: {
          p_tenant_id: string;
          p_order_id: string;
          p_actor_id: string;
        };
        Returns: Json;
      };
      record_order_payment: {
        Args: {
          p_tenant_id: string;
          p_order_id: string;
          p_amount: number;
          p_payment_mode_id: string | null;
          p_payment_date: string;
          p_reference_number: string | null;
          p_notes: string | null;
          p_actor_id: string;
        };
        Returns: Json;
      };
      correct_order_payment: {
        Args: {
          p_tenant_id: string;
          p_payment_id: string;
          p_amount: number;
          p_payment_mode_id: string | null;
          p_payment_date: string;
          p_reference_number: string | null;
          p_notes: string | null;
          p_reason: string;
          p_actor_id: string;
        };
        Returns: Json;
      };
      update_worker_configuration: {
        Args: {
          p_tenant_id: string; p_worker_id: string; p_name: string; p_phone: string | null;
          p_joining_date: string | null; p_status: WorkerStatus; p_primary_workgroup_id: string | null;
          p_wage_type: WorkerWageType; p_wage_amount: number; p_notes: string | null;
          p_workgroup_ids: string[]; p_actor_id: string;
        };
        Returns: string;
      };
      seed_default_expense_categories_for_tenant: {
        Args: { p_tenant_id: string; p_actor_id?: string | null };
        Returns: number;
      };
      update_stage_configuration: {
        Args: { p_tenant_id: string; p_stage_id: string; p_name: string; p_description: string | null; p_is_active: boolean; p_actor_id: string };
        Returns: string;
      };
      create_workflow_configuration: {
        Args: { p_tenant_id: string; p_name: string; p_description: string | null; p_item_type_id: string | null; p_is_default: boolean; p_stage_ids: string[]; p_actor_id: string };
        Returns: string;
      };
      replace_workflow_stage_sequence: {
        Args: { p_tenant_id: string; p_workflow_id: string; p_stage_ids: string[]; p_customer_status_ids: Array<string | null>; p_actor_id: string };
        Returns: string;
      };
      update_workflow_configuration: {
        Args: { p_tenant_id: string; p_workflow_id: string; p_name: string; p_description: string | null; p_item_type_id: string | null; p_is_default: boolean; p_is_active: boolean; p_actor_id: string };
        Returns: string;
      };
      create_task_command: {
        Args: {
          p_tenant_id: string;
          p_actor_type: CommandActorType;
          p_actor_id: string | null;
          p_source: CommandSource;
          p_correlation_id: string;
          p_idempotency_key: string | null;
          p_task_type: TaskType;
          p_title: string;
          p_description: string | null;
          p_subject_type: TaskSubjectType;
          p_subject_id: string;
          p_assigned_user_id?: string | null;
          p_assigned_team_id?: string | null;
          p_priority?: TaskPriority;
          p_due_at?: string | null;
          p_source_event_id?: string | null;
        };
        Returns: Json;
      };
      assign_task_command: {
        Args: {
          p_tenant_id: string;
          p_actor_type: CommandActorType;
          p_actor_id: string | null;
          p_source: CommandSource;
          p_correlation_id: string;
          p_idempotency_key: string | null;
          p_task_id: string;
          p_assigned_user_id?: string | null;
          p_assigned_team_id?: string | null;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      start_task_command: {
        Args: {
          p_tenant_id: string;
          p_actor_type: CommandActorType;
          p_actor_id: string | null;
          p_source: CommandSource;
          p_correlation_id: string;
          p_idempotency_key: string | null;
          p_task_id: string;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      complete_task_command: {
        Args: {
          p_tenant_id: string;
          p_actor_type: CommandActorType;
          p_actor_id: string | null;
          p_source: CommandSource;
          p_correlation_id: string;
          p_idempotency_key: string | null;
          p_task_id: string;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      cancel_task_command: {
        Args: {
          p_tenant_id: string;
          p_actor_type: CommandActorType;
          p_actor_id: string | null;
          p_source: CommandSource;
          p_correlation_id: string;
          p_idempotency_key: string | null;
          p_task_id: string;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      start_work_unit_stage_command: {
        Args: {
          p_tenant_id: string;
          p_actor_type: CommandActorType;
          p_actor_id: string | null;
          p_source: CommandSource;
          p_correlation_id: string;
          p_idempotency_key: string | null;
          p_stage_instance_id: string;
          p_worker_id: string;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      complete_work_unit_stage_command: {
        Args: {
          p_tenant_id: string;
          p_actor_type: CommandActorType;
          p_actor_id: string | null;
          p_source: CommandSource;
          p_correlation_id: string;
          p_idempotency_key: string | null;
          p_stage_instance_id: string;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      create_laundry_pickup_request_command: {
        Args: {
          p_tenant_id: string;
          p_actor_type: CommandActorType;
          p_actor_id: string | null;
          p_source: CommandSource;
          p_correlation_id: string;
          p_idempotency_key: string | null;
          p_customer_id: string;
          p_pickup_address_id: string | null;
          p_requested_date: string;
          p_requested_window: string;
          p_pickup_source: LaundryPickupSource;
          p_assigned_user_id?: string | null;
          p_assigned_team_id?: string | null;
          p_scheduled_at?: string | null;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      create_laundry_container_asset_command: {
        Args: {
          p_tenant_id: string;
          p_actor_type: CommandActorType;
          p_actor_id: string | null;
          p_source: CommandSource;
          p_correlation_id: string;
          p_idempotency_key: string | null;
          p_container_code?: string | null;
          p_container_type?: LaundryContainerType;
          p_assigned_customer_id?: string | null;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      complete_laundry_pickup_request_command: {
        Args: {
          p_tenant_id: string;
          p_actor_type: CommandActorType;
          p_actor_id: string | null;
          p_source: CommandSource;
          p_correlation_id: string;
          p_idempotency_key: string | null;
          p_pickup_request_id: string;
          p_handling_unit_type?: LaundryHandlingUnitType;
          p_current_location_id?: string | null;
          p_container_asset_id?: string | null;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      create_laundry_service_lot_command: {
        Args: {
          p_tenant_id: string;
          p_actor_type: CommandActorType;
          p_actor_id: string | null;
          p_source: CommandSource;
          p_correlation_id: string;
          p_idempotency_key: string | null;
          p_handling_unit_id: string;
          p_order_id: string;
          p_service_catalog_id: string;
          p_quantity?: number;
          p_quantity_unit?: LaundryServiceQuantityUnit | null;
          p_piece_count?: number | null;
          p_weight_kg?: number | null;
          p_special_instructions?: string | null;
          p_display_code?: string | null;
        };
        Returns: Json;
      };
      initialize_work_unit_workflow: {
        Args: {
          p_tenant_id: string;
          p_work_unit_id: string;
          p_actor?: string | null;
        };
        Returns: string;
      };
      start_work_unit_stage: {
        Args: {
          p_tenant_id: string;
          p_stage_instance_id: string;
          p_worker_id: string;
          p_actor?: string | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
      complete_work_unit_stage: {
        Args: {
          p_tenant_id: string;
          p_stage_instance_id: string;
          p_actor?: string | null;
          p_notes?: string | null;
        };
        Returns: string | null;
      };
      create_work_unit_runtime: {
        Args: {
          p_tenant_id: string;
          p_order_id: string;
          p_vertical_key: TenantVerticalKey;
          p_workflow_id: string;
          p_display_code: string;
          p_line_name: string;
          p_line_type?: OrderLineType;
          p_line_description?: string | null;
          p_quantity?: number;
          p_quantity_unit?: string;
          p_unit_price?: number;
          p_discount_amount?: number;
          p_gst_treatment?: GstTreatment;
          p_gst_rate?: number;
          p_current_location_id?: string | null;
          p_vertical_object_type?: string | null;
          p_vertical_object_id?: string | null;
          p_actor?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      tenant_status: TenantStatus;
      tenant_billing_payment_status: TenantBillingPaymentStatus;
      gst_treatment: GstTreatment;
      expense_input_gst_status: ExpenseInputGstStatus;
      tenant_user_role: TenantUserRole;
      tenant_user_status: TenantUserStatus;
      worker_status: WorkerStatus;
      worker_wage_type: WorkerWageType;
      customer_gender: CustomerGender;
      order_source: OrderSource;
      delivery_type: DeliveryType;
      payment_status: PaymentStatus;
      order_status: OrderStatus;
      item_status: ItemStatus;
      item_workflow_status: ItemWorkflowStatus;
      item_stage_status: ItemStageStatus;
      item_stage_work_log_status: ItemStageWorkLogStatus;
      attendance_status: AttendanceStatus;
      worker_ledger_transaction_type: WorkerLedgerTransactionType;
      salary_period_status: SalaryPeriodStatus;
      salary_payment_status: SalaryPaymentStatus;
      receivable_payable_type: ReceivablePayableType;
      receivable_payable_status: ReceivablePayableStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
