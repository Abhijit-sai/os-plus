create or replace function create_work_unit_runtime(
  p_tenant_id uuid,
  p_order_id uuid,
  p_vertical_key text,
  p_workflow_id uuid,
  p_display_code text,
  p_line_name text,
  p_line_type text default 'service',
  p_line_description text default null,
  p_quantity numeric default 1,
  p_quantity_unit text default 'unit',
  p_unit_price numeric default 0,
  p_discount_amount numeric default 0,
  p_gst_treatment gst_treatment default 'not_applicable',
  p_gst_rate numeric default 0,
  p_current_location_id uuid default null,
  p_vertical_object_type text default null,
  p_vertical_object_id uuid default null,
  p_actor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_order_line_id uuid;
  v_work_unit_id uuid;
  v_workflow_instance_id uuid;
  v_sort_order integer;
  v_estimated_amount numeric(12, 2);
begin
  select *
  into v_order
  from orders
  where tenant_id = p_tenant_id
    and id = p_order_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  if v_order.runtime_model <> 'work_unit_v2' then
    raise exception 'ORDER_NOT_WORK_UNIT_RUNTIME'
      using errcode = 'P0001';
  end if;

  if v_order.vertical_key <> p_vertical_key then
    raise exception 'ORDER_VERTICAL_MISMATCH'
      using errcode = 'P0001';
  end if;

  perform 1
  from tenant_verticals
  inner join vertical_definitions
    on vertical_definitions.id = tenant_verticals.vertical_definition_id
  where tenant_verticals.tenant_id = p_tenant_id
    and tenant_verticals.is_enabled = true
    and vertical_definitions.key = p_vertical_key
    and vertical_definitions.is_active = true;

  if not found then
    raise exception 'TENANT_VERTICAL_NOT_ENABLED'
      using errcode = 'P0001';
  end if;

  perform 1
  from workflows
  where tenant_id = p_tenant_id
    and id = p_workflow_id
    and is_active = true
    and deleted_at is null;

  if not found then
    raise exception 'WORKFLOW_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  if p_current_location_id is not null then
    perform 1
    from tenant_locations
    where tenant_id = p_tenant_id
      and id = p_current_location_id
      and is_active = true
      and deleted_at is null;

    if not found then
      raise exception 'LOCATION_NOT_FOUND'
        using errcode = 'P0001';
    end if;
  end if;

  select coalesce(max(sort_order), 0) + 1
  into v_sort_order
  from order_lines
  where tenant_id = p_tenant_id
    and order_id = p_order_id
    and deleted_at is null;

  v_estimated_amount := greatest((p_quantity * p_unit_price) - p_discount_amount, 0);

  insert into order_lines (
    tenant_id,
    order_id,
    line_type,
    name,
    description,
    quantity,
    quantity_unit,
    unit_price,
    discount_amount,
    gst_treatment,
    gst_rate,
    estimated_amount,
    source_vertical_key,
    source_object_type,
    source_object_id,
    sort_order,
    created_by,
    updated_by
  )
  values (
    p_tenant_id,
    p_order_id,
    p_line_type,
    p_line_name,
    p_line_description,
    p_quantity,
    p_quantity_unit,
    p_unit_price,
    p_discount_amount,
    p_gst_treatment,
    p_gst_rate,
    v_estimated_amount,
    p_vertical_key,
    p_vertical_object_type,
    p_vertical_object_id,
    v_sort_order,
    p_actor,
    p_actor
  )
  returning id into v_order_line_id;

  insert into work_units (
    tenant_id,
    order_id,
    order_line_id,
    vertical_key,
    vertical_object_type,
    vertical_object_id,
    display_code,
    workflow_id,
    current_location_id,
    status,
    created_by,
    updated_by
  )
  values (
    p_tenant_id,
    p_order_id,
    v_order_line_id,
    p_vertical_key,
    p_vertical_object_type,
    p_vertical_object_id,
    p_display_code,
    p_workflow_id,
    p_current_location_id,
    'not_started',
    p_actor,
    p_actor
  )
  returning id into v_work_unit_id;

  select initialize_work_unit_workflow(p_tenant_id, v_work_unit_id, p_actor)
  into v_workflow_instance_id;

  return jsonb_build_object(
    'order_line_id', v_order_line_id,
    'work_unit_id', v_work_unit_id,
    'workflow_instance_id', v_workflow_instance_id
  );
end;
$$;

comment on function create_work_unit_runtime(
  uuid,
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  text,
  numeric,
  numeric,
  gst_treatment,
  numeric,
  uuid,
  text,
  uuid,
  text
) is 'Atomically creates a V2 Order Line, Work Unit, and initialized Work Unit workflow. Refuses legacy_item_v1 orders.';
