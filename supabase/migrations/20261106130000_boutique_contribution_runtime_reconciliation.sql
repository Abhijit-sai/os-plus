-- Revision 2: preserve completed historical quarter credits; new active credits use tenths.
-- Reconcile two observed legacy contribution behaviours and protect final-label publication.
-- Applies to all tenants future relevant item writes; no immediate operational-row backfill.
-- No operational row is rounded, backfilled, renamed, delivered or deleted.
-- Frozen historical migrations are not replayed. Unknown definitions/credits stop atomically.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $compatibility$
DECLARE c record; normalized text;
BEGIN
  -- Completed quarter-unit credits are an older supported ledger format. Preserve
  -- those rows and money exactly. Open quarter credits or unknown increments stop.
  IF EXISTS (SELECT 1 FROM public.item_stage_work_logs
    WHERE mod(credited_units * 100, 10) <> 0
      AND (status <> 'completed' OR mod(credited_units * 100, 25) <> 0)) THEN
    RAISE EXCEPTION 'HISTORICAL_CREDIT_COMPATIBILITY_REQUIRES_REVIEW';
  END IF;
  FOR c IN SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conrelid='public.item_stage_work_logs'::regclass
      AND conname IN ('item_stage_work_logs_credited_units_quarter_step','item_stage_work_logs_credited_units_tenth_step','item_stage_work_logs_credited_units_supported_step')
  LOOP
    normalized := regexp_replace(c.definition, '::[a-z_][a-z_0-9]*|[[:space:]()]', '', 'g');
    IF normalized NOT IN ('CHECKmodcredited_units*100,25=0','CHECKmodcredited_units*100,10=0',
      'CHECKmodcredited_units*100,10=0ORstatus=''completed''ANDmodcredited_units*100,25=0') THEN
      RAISE EXCEPTION 'UNEXPECTED_CREDITED_UNIT_CONSTRAINT';
    END IF;
  END LOOP;
END
$compatibility$;

DO $repair$
DECLARE definition text; fingerprint text;
BEGIN
  definition := replace(pg_get_functiondef('public.apply_item_stage_contributions(uuid,uuid,jsonb,text,text,boolean,boolean)'::regprocedure), chr(13), '');
  fingerprint := md5(definition);
  IF fingerprint = 'bbb0518f8fe2da90852a45375b30fb2f' THEN
    IF length(definition) - length(replace(definition, $old$mod(v_units * 100, 25) <> 0$old$, '')) <> length($old$mod(v_units * 100, 25) <> 0$old$) THEN
      RAISE EXCEPTION 'UNEXPECTED_APPLY_ITEM_STAGE_CONTRIBUTIONS_BRANCH';
    END IF;
    EXECUTE replace(definition, $old$mod(v_units * 100, 25) <> 0$old$, $new$mod(v_units * 100, 10) <> 0$new$);
  ELSIF fingerprint NOT IN ('e184fb2477a15cc62ba9d0b1e97d3ee2', '7603880c28d78980a1506c61b72241c9') THEN
    RAISE EXCEPTION 'UNEXPECTED_APPLY_ITEM_STAGE_CONTRIBUTIONS_DEFINITION';
  END IF;
END
$repair$;

DO $repair$
DECLARE definition text; fingerprint text;
  old_branch text := replace($before$select case when lower(coalesce(stage_master.name, '')) like '%deliver%'
      or lower(coalesce(stage_master.name, '')) like '%handoff%'
      or lower(coalesce(customer_statuses.name, '')) like '%deliver%'
      or lower(coalesce(customer_statuses.name, '')) like '%handoff%'
      then 'delivered'::item_status else 'completed'::item_status end$before$, chr(13), '');
  new_branch text := replace($after$select case when coalesce(customer_statuses.is_final_status, false)
      then 'delivered'::item_status else 'completed'::item_status end$after$, chr(13), '');
BEGIN
  definition := replace(pg_get_functiondef('public.complete_item_stage_with_contributions(uuid,uuid,jsonb,text,text,text,bigint,uuid)'::regprocedure), chr(13), '');
  fingerprint := md5(definition);
  IF fingerprint = 'cd55f445f00236186450f20bc435b40d' THEN
    IF length(definition) - length(replace(definition, old_branch, '')) <> length(old_branch) THEN
      RAISE EXCEPTION 'UNEXPECTED_COMPLETE_ITEM_STAGE_WITH_CONTRIBUTIONS_BRANCH';
    END IF;
    EXECUTE replace(definition, old_branch, new_branch);
  ELSIF fingerprint <> 'fe47d860a06efc44d3ebf1780abaaab7' THEN
    RAISE EXCEPTION 'UNEXPECTED_COMPLETE_ITEM_STAGE_WITH_CONTRIBUTIONS_DEFINITION';
  END IF;
END
$repair$;

ALTER TABLE public.item_stage_work_logs
  DROP CONSTRAINT IF EXISTS item_stage_work_logs_credited_units_quarter_step,
  DROP CONSTRAINT IF EXISTS item_stage_work_logs_credited_units_tenth_step,
  DROP CONSTRAINT IF EXISTS item_stage_work_logs_credited_units_supported_step;
ALTER TABLE public.item_stage_work_logs
  ADD CONSTRAINT item_stage_work_logs_credited_units_supported_step
    CHECK (mod(credited_units * 100, 10) = 0
      OR (status = 'completed' AND mod(credited_units * 100, 25) = 0));
-- Stage mappings describe the status AFTER completion. Advance/start/initialization
-- paths may copy them sooner; never publish a final label before recorded delivery.
-- This protects both contribution RPCs and legacy application writes without
-- changing completed history or backfilling any operational row.
CREATE OR REPLACE FUNCTION public.enforce_completed_delivery_customer_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $guard$
BEGIN
  IF NEW.customer_status_id IS NOT NULL
    AND NEW.item_status IS DISTINCT FROM 'delivered'::public.item_status
    AND EXISTS(SELECT 1 FROM public.customer_statuses cs WHERE cs.tenant_id=NEW.tenant_id
      AND cs.id=NEW.customer_status_id AND cs.is_final_status AND cs.deleted_at IS NULL)
  THEN
    IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM public.customer_statuses cs WHERE cs.tenant_id=NEW.tenant_id
        AND cs.id=OLD.customer_status_id AND NOT cs.is_final_status AND cs.deleted_at IS NULL)
    THEN NEW.customer_status_id := OLD.customer_status_id;
    ELSE NEW.customer_status_id := NULL;
    END IF;
  END IF;
  RETURN NEW;
END
$guard$;
REVOKE ALL ON FUNCTION public.enforce_completed_delivery_customer_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_completed_delivery_customer_status() TO service_role;
DROP TRIGGER IF EXISTS order_items_completed_delivery_customer_status ON public.order_items;
CREATE TRIGGER order_items_completed_delivery_customer_status
BEFORE INSERT OR UPDATE OF customer_status_id,item_status ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_completed_delivery_customer_status();
COMMIT;
