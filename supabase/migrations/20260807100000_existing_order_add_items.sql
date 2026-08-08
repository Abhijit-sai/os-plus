create or replace function add_items_to_existing_order(
  p_tenant_id uuid,
  p_order_id uuid,
  p_items jsonb,
  p_actor_id text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_command_type text := 'AddItemsToExistingOrder';
  v_request jsonb;
  v_request_hash text;
  v_existing command_idempotency%rowtype;
  v_order orders%rowtype;
  v_item jsonb;
  v_stage record;
  v_item_type_id uuid;
  v_workflow_id uuid;
  v_customer_measurement_id uuid;
  v_standard_size_id uuid;
  v_order_item_id uuid;
  v_workflow_instance_id uuid;
  v_stage_instance_id uuid;
  v_first_stage_instance_id uuid;
  v_quantity integer;
  v_unit_price numeric(12, 2);
  v_item_discount numeric(12, 2);
  v_final_price numeric(12, 2);
  v_subtotal numeric(12, 2);
  v_discount_amount numeric(12, 2);
  v_base_amount numeric(12, 2);
  v_taxable_amount numeric(12, 2);
  v_gst_amount numeric(12, 2);
  v_total_amount numeric(12, 2);
  v_payment_total numeric(12, 2);
  v_amount_paid numeric(12, 2);
  v_payment_status payment_status;
  v_added_item_ids jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) = 0 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'ITEMS_MUST_BE_A_JSON_ARRAY' using errcode = 'P0001';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'ITEMS_MUST_CONTAIN_AT_LEAST_1_ROW' using errcode = 'P0001';
  end if;

  v_request := jsonb_build_object('order_id', p_order_id, 'items', p_items);
  v_request_hash := md5(v_request::text);

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_tenant_id::text || ':' || v_command_type || ':' || p_idempotency_key,
      0
    )
  );

  select * into v_existing
  from command_idempotency
  where tenant_id = p_tenant_id
    and command_type = v_command_type
    and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'
        using errcode = 'P0001';
    end if;

    if v_existing.status = 'completed' then
      return v_existing.result_json;
    end if;

    raise exception 'COMMAND_ALREADY_PROCESSING' using errcode = 'P0001';
  end if;

  insert into command_idempotency (
    tenant_id,
    command_type,
    idempotency_key,
    request_hash,
    status
  )
  values (
    p_tenant_id,
    v_command_type,
    p_idempotency_key,
    v_request_hash,
    'processing'
  );

  select * into v_order
  from orders
  where tenant_id = p_tenant_id
    and id = p_order_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_order.vertical_key <> 'boutique'
     or v_order.runtime_model <> 'legacy_item_v1' then
    raise exception 'ORDER_NOT_LEGACY_ITEM_RUNTIME' using errcode = 'P0001';
  end if;

  if v_order.order_status = 'cancelled' then
    raise exception 'ORDER_CANCELLED' using errcode = 'P0001';
  end if;

  if v_order.order_status = 'delivered'
     or (
       exists (
         select 1
         from order_items existing_item
         where existing_item.tenant_id = p_tenant_id
           and existing_item.order_id = p_order_id
           and existing_item.deleted_at is null
       )
       and not exists (
         select 1
         from order_items existing_item
         where existing_item.tenant_id = p_tenant_id
           and existing_item.order_id = p_order_id
           and existing_item.deleted_at is null
           and existing_item.item_status <> 'delivered'
       )
     ) then
    raise exception 'ORDER_FULLY_DELIVERED' using errcode = 'P0001';
  end if;

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop
    v_item_type_id := nullif(v_item->>'item_type_id', '')::uuid;
    v_workflow_id := nullif(v_item->>'workflow_id', '')::uuid;
    v_customer_measurement_id := nullif(v_item->>'customer_measurement_id', '')::uuid;
    v_standard_size_id := nullif(v_item->>'standard_size_id', '')::uuid;
    v_quantity := coalesce((v_item->>'quantity')::integer, 1);
    v_unit_price := round(coalesce((v_item->>'unit_price')::numeric, 0), 2);
    v_item_discount := round(coalesce((v_item->>'discount_amount')::numeric, 0), 2);

    if v_item_type_id is null
       or not exists (
         select 1
         from item_types
         where tenant_id = p_tenant_id
           and id = v_item_type_id
           and is_active = true
           and deleted_at is null
       ) then
      raise exception 'ITEM_TYPE_NOT_FOUND' using errcode = 'P0001';
    end if;

    if v_workflow_id is null
       or not exists (
         select 1
         from workflows
         where tenant_id = p_tenant_id
           and id = v_workflow_id
           and is_active = true
           and deleted_at is null
       ) then
      raise exception 'WORKFLOW_NOT_FOUND' using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from workflows
      where tenant_id = p_tenant_id
        and id = v_workflow_id
        and item_type_id is not null
        and item_type_id <> v_item_type_id
  ) then
      raise exception 'WORKFLOW_ITEM_TYPE_MISMATCH' using errcode = 'P0001';
    end if;

    if not exists (
      select 1
      from workflow_stages workflow_stage
      join stage_master stage
        on stage.id = workflow_stage.stage_master_id
       and stage.tenant_id = p_tenant_id
       and stage.is_active = true
       and stage.deleted_at is null
      where workflow_stage.tenant_id = p_tenant_id
        and workflow_stage.workflow_id = v_workflow_id
        and workflow_stage.is_active = true
        and workflow_stage.deleted_at is null
    ) then
      raise exception 'WORKFLOW_HAS_NO_ACTIVE_STAGES' using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from workflow_stages workflow_stage
      left join stage_master stage
        on stage.id = workflow_stage.stage_master_id
       and stage.tenant_id = p_tenant_id
       and stage.is_active = true
       and stage.deleted_at is null
      left join customer_statuses customer_status
        on customer_status.id = workflow_stage.customer_status_id
       and customer_status.tenant_id = p_tenant_id
       and customer_status.deleted_at is null
      where workflow_stage.tenant_id = p_tenant_id
        and workflow_stage.workflow_id = v_workflow_id
        and workflow_stage.is_active = true
        and workflow_stage.deleted_at is null
        and (
          stage.id is null
          or (
            workflow_stage.customer_status_id is not null
            and customer_status.id is null
          )
        )
    ) then
      raise exception 'WORKFLOW_STAGE_REFERENCE_INVALID' using errcode = 'P0001';
    end if;

    if v_customer_measurement_id is not null
       and v_standard_size_id is not null then
      raise exception 'FIT_REFERENCE_MUST_BE_SINGLE' using errcode = 'P0001';
    end if;

    if v_customer_measurement_id is not null then
      if not exists (
        select 1
        from customer_measurements
        where tenant_id = p_tenant_id
          and id = v_customer_measurement_id
          and deleted_at is null
      ) then
        raise exception 'MEASUREMENT_NOT_FOUND' using errcode = 'P0001';
      end if;

      if exists (
        select 1
        from customer_measurements
        where tenant_id = p_tenant_id
          and id = v_customer_measurement_id
          and customer_id <> v_order.customer_id
      ) then
        raise exception 'MEASUREMENT_CUSTOMER_MISMATCH' using errcode = 'P0001';
      end if;

      if exists (
        select 1
        from customer_measurements
        where tenant_id = p_tenant_id
          and id = v_customer_measurement_id
          and item_type_id is not null
          and item_type_id <> v_item_type_id
      ) then
        raise exception 'MEASUREMENT_ITEM_TYPE_MISMATCH' using errcode = 'P0001';
      end if;
    end if;

    if v_standard_size_id is not null then
      if not exists (
        select 1
        from item_type_standard_sizes
        where tenant_id = p_tenant_id
          and id = v_standard_size_id
          and is_active = true
          and deleted_at is null
      ) then
        raise exception 'STANDARD_SIZE_NOT_FOUND' using errcode = 'P0001';
      end if;

      if exists (
        select 1
        from item_type_standard_sizes
        where tenant_id = p_tenant_id
          and id = v_standard_size_id
          and item_type_id <> v_item_type_id
      ) then
        raise exception 'STANDARD_SIZE_ITEM_TYPE_MISMATCH' using errcode = 'P0001';
      end if;
    end if;

    if length(btrim(coalesce(v_item->>'name', ''))) = 0 then
      raise exception 'ITEM_NAME_REQUIRED' using errcode = 'P0001';
    end if;

    if v_quantity <= 0
       or v_unit_price < 0
       or v_item_discount < 0 then
      raise exception 'ITEM_AMOUNT_INVALID' using errcode = 'P0001';
    end if;

    v_final_price := greatest(
      round((v_quantity * v_unit_price) - v_item_discount, 2),
      0
    );

    insert into order_items (
      tenant_id,
      order_id,
      item_type_id,
      customer_measurement_id,
      standard_size_id,
      name,
      description,
      color,
      quantity,
      unit_price,
      discount_amount,
      final_price,
      workflow_id,
      expected_completion_date,
      delivery_type_override,
      notes,
      created_by,
      updated_by
    )
    values (
      p_tenant_id,
      p_order_id,
      v_item_type_id,
      v_customer_measurement_id,
      v_standard_size_id,
      btrim(v_item->>'name'),
      nullif(btrim(v_item->>'description'), ''),
      nullif(btrim(v_item->>'color'), ''),
      v_quantity,
      v_unit_price,
      v_item_discount,
      v_final_price,
      v_workflow_id,
      nullif(v_item->>'expected_completion_date', '')::date,
      nullif(v_item->>'delivery_type_override', '')::delivery_type,
      nullif(btrim(v_item->>'notes'), ''),
      p_actor_id,
      p_actor_id
    )
    returning id into v_order_item_id;

    insert into item_workflow_instances (
      tenant_id,
      order_item_id,
      workflow_id,
      status,
      created_by,
      updated_by
    )
    values (
      p_tenant_id,
      v_order_item_id,
      v_workflow_id,
      'not_started',
      p_actor_id,
      p_actor_id
    )
    returning id into v_workflow_instance_id;

    v_first_stage_instance_id := null;

    for v_stage in
      select
        workflow_stage.id,
        workflow_stage.stage_master_id,
        workflow_stage.sequence_number,
        workflow_stage.customer_status_id
      from workflow_stages workflow_stage
      join stage_master stage
        on stage.id = workflow_stage.stage_master_id
       and stage.tenant_id = p_tenant_id
       and stage.is_active = true
       and stage.deleted_at is null
      where workflow_stage.tenant_id = p_tenant_id
        and workflow_stage.workflow_id = v_workflow_id
        and workflow_stage.is_active = true
        and workflow_stage.deleted_at is null
      order by workflow_stage.sequence_number
    loop
      insert into item_stage_instances (
        tenant_id,
        workflow_instance_id,
        order_item_id,
        workflow_stage_id,
        stage_master_id,
        sequence_number,
        status,
        customer_status_id,
        created_by,
        updated_by
      )
      values (
        p_tenant_id,
        v_workflow_instance_id,
        v_order_item_id,
        v_stage.id,
        v_stage.stage_master_id,
        v_stage.sequence_number,
        case
          when v_first_stage_instance_id is null then 'ready_to_start'::item_stage_status
          else 'not_started'::item_stage_status
        end,
        v_stage.customer_status_id,
        p_actor_id,
        p_actor_id
      )
      returning id into v_stage_instance_id;

      if v_first_stage_instance_id is null then
        v_first_stage_instance_id := v_stage_instance_id;
      end if;
    end loop;

    update item_workflow_instances
    set
      current_stage_instance_id = v_first_stage_instance_id,
      updated_by = p_actor_id
    where tenant_id = p_tenant_id
      and id = v_workflow_instance_id;

    insert into item_history (
      tenant_id,
      order_item_id,
      event_type,
      old_value_json,
      new_value_json,
      notes,
      created_by
    )
    values
      (
        p_tenant_id,
        v_order_item_id,
        'item_added_to_existing_order',
        null,
        jsonb_build_object(
          'order_id', p_order_id,
          'workflow_id', v_workflow_id,
          'workflow_instance_id', v_workflow_instance_id,
          'idempotency_key', p_idempotency_key
        ),
        'Item added after the order was created.',
        p_actor_id
      ),
      (
        p_tenant_id,
        v_order_item_id,
        'workflow_assigned',
        null,
        jsonb_build_object(
          'workflow_id', v_workflow_id,
          'workflow_instance_id', v_workflow_instance_id
        ),
        'Workflow instance generated from configured workflow.',
        p_actor_id
      );

    v_added_item_ids := v_added_item_ids || jsonb_build_array(v_order_item_id);
  end loop;

  select
    round(coalesce(sum(quantity * unit_price), 0), 2),
    round(coalesce(sum(discount_amount), 0), 2)
  into v_subtotal, v_discount_amount
  from order_items
  where tenant_id = p_tenant_id
    and order_id = p_order_id
    and deleted_at is null;

  v_base_amount := greatest(v_subtotal - v_discount_amount, 0);

  if v_base_amount > 0
     and v_order.gst_rate > 0
     and v_order.gst_treatment = 'taxable_exclusive' then
    v_taxable_amount := round(v_base_amount, 2);
    v_gst_amount := round((v_taxable_amount * v_order.gst_rate) / 100, 2);
    v_total_amount := round(v_taxable_amount + v_gst_amount, 2);
  elsif v_base_amount > 0
        and v_order.gst_rate > 0
        and v_order.gst_treatment = 'taxable_inclusive' then
    v_total_amount := round(v_base_amount, 2);
    v_taxable_amount := round(v_total_amount / (1 + v_order.gst_rate / 100), 2);
    v_gst_amount := round(v_total_amount - v_taxable_amount, 2);
  else
    v_taxable_amount := 0;
    v_gst_amount := 0;
    v_total_amount := round(v_base_amount, 2);
  end if;

  select round(coalesce(sum(amount), 0), 2)
  into v_payment_total
  from order_payments
  where tenant_id = p_tenant_id
    and order_id = p_order_id
    and deleted_at is null;

  v_amount_paid := least(v_payment_total, v_total_amount);
  v_payment_status := case
    when v_amount_paid <= 0 then 'unpaid'::payment_status
    when v_amount_paid >= v_total_amount then 'paid'::payment_status
    else 'partially_paid'::payment_status
  end;

  update orders
  set
    subtotal = v_subtotal,
    discount_amount = v_discount_amount,
    taxable_amount = v_taxable_amount,
    gst_amount = v_gst_amount,
    total_amount = v_total_amount,
    amount_paid = v_amount_paid,
    payment_status = v_payment_status,
    order_status = case
      when order_status in ('ready', 'completed') then 'in_progress'::order_status
      else order_status
    end,
    updated_by = p_actor_id
  where tenant_id = p_tenant_id
    and id = p_order_id;

  v_result := jsonb_build_object(
    'order_id', p_order_id,
    'added_item_ids', v_added_item_ids,
    'added_item_count', jsonb_array_length(v_added_item_ids),
    'subtotal', v_subtotal,
    'discount_amount', v_discount_amount,
    'taxable_amount', v_taxable_amount,
    'gst_amount', v_gst_amount,
    'total_amount', v_total_amount,
    'amount_paid', v_amount_paid,
    'payment_status', v_payment_status
  );

  update command_idempotency
  set
    status = 'completed',
    result_json = v_result,
    completed_at = now()
  where tenant_id = p_tenant_id
    and command_type = v_command_type
    and idempotency_key = p_idempotency_key;

  return v_result;
end;
$$;

revoke all on function add_items_to_existing_order(uuid, uuid, jsonb, text, text) from public;
revoke all on function add_items_to_existing_order(uuid, uuid, jsonb, text, text) from anon;
revoke all on function add_items_to_existing_order(uuid, uuid, jsonb, text, text) from authenticated;
grant execute on function add_items_to_existing_order(uuid, uuid, jsonb, text, text) to service_role;

comment on function add_items_to_existing_order(uuid, uuid, jsonb, text, text) is
  'Atomically adds one or more production items to an active legacy Boutique order, initializes each workflow, recalculates commercial and payment summaries, and supports idempotent retries.';

create or replace function recalculate_order_payment_summary(
  p_tenant_id uuid,
  p_order_id uuid,
  p_actor_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_payment_total numeric(12, 2);
  v_amount_paid numeric(12, 2);
  v_payment_status payment_status;
begin
  select * into v_order
  from orders
  where tenant_id = p_tenant_id
    and id = p_order_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  select round(coalesce(sum(amount), 0), 2)
  into v_payment_total
  from order_payments
  where tenant_id = p_tenant_id
    and order_id = p_order_id
    and deleted_at is null;

  v_amount_paid := least(v_payment_total, v_order.total_amount);
  v_payment_status := case
    when v_amount_paid <= 0 then 'unpaid'::payment_status
    when v_amount_paid >= v_order.total_amount then 'paid'::payment_status
    else 'partially_paid'::payment_status
  end;

  update orders
  set
    amount_paid = v_amount_paid,
    payment_status = v_payment_status,
    updated_by = p_actor_id
  where tenant_id = p_tenant_id
    and id = p_order_id;

  return jsonb_build_object(
    'order_id', p_order_id,
    'total_amount', v_order.total_amount,
    'payment_total', v_payment_total,
    'amount_paid', v_amount_paid,
    'payment_status', v_payment_status
  );
end;
$$;

revoke all on function recalculate_order_payment_summary(uuid, uuid, text) from public;
revoke all on function recalculate_order_payment_summary(uuid, uuid, text) from anon;
revoke all on function recalculate_order_payment_summary(uuid, uuid, text) from authenticated;
grant execute on function recalculate_order_payment_summary(uuid, uuid, text) to service_role;

comment on function recalculate_order_payment_summary(uuid, uuid, text) is
  'Recalculates an order payment summary while holding the same order-row lock used by commercial total changes.';
