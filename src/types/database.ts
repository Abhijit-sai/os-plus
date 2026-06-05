export type TenantStatus = "active" | "inactive" | "suspended";
export type TenantBillingPaymentStatus = "pending" | "partially_paid" | "paid" | "overdue" | "waived" | "cancelled";
export type TenantUserRole = "owner_admin" | "manager" | "finance" | "viewer";
export type TenantUserStatus = "active" | "invited" | "disabled";
export type WorkerStatus = "active" | "inactive";
export type WorkerWageType = "hourly" | "daily" | "weekly" | "monthly" | "per_piece" | "hybrid";
export type CustomerGender = "female" | "male" | "other" | "not_specified";
export type OrderSource = "walk_in" | "shopify_manual" | "whatsapp" | "other";
export type DeliveryType = "store_pickup" | "self_delivery" | "courier";
export type PaymentStatus = "unpaid" | "partially_paid" | "paid" | "refunded";
export type OrderStatus = "confirmed" | "in_progress" | "ready" | "partially_delivered" | "completed" | "delivered" | "cancelled";
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
  status: TenantStatus;
  custom_domain: string | null;
  tracking_subdomain: string | null;
  created_at: string;
  updated_at: string;
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
  source: OrderSource;
  customer_id: string;
  order_date: string;
  promised_delivery_date: string | null;
  delivery_type: DeliveryType;
  delivery_address: string | null;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  notes: string | null;
  tracking_token: string;
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
          source?: OrderSource;
          customer_id: string;
          order_date?: string;
          promised_delivery_date?: string | null;
          delivery_type?: DeliveryType;
          delivery_address?: string | null;
          subtotal?: number;
          discount_amount?: number;
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
    Functions: Record<string, never>;
    Enums: {
      tenant_status: TenantStatus;
      tenant_billing_payment_status: TenantBillingPaymentStatus;
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
