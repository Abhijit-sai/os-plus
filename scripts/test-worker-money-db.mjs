import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const container = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_os-plus";

if (!container.startsWith("supabase_db_")) {
  throw new Error("Refusing to run worker-money DB tests outside a local Supabase database container.");
}

function runSql(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "docker",
      ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`psql exited ${code}: ${stderr || stdout}`));
    });
    child.stdin.end(sql);
  });
}

const ids = {
  tenantA: "10000000-0000-4000-8000-000000000001",
  tenantB: "10000000-0000-4000-8000-000000000002",
  workerA: "20000000-0000-4000-8000-000000000001",
  workerA2: "20000000-0000-4000-8000-000000000003",
  workerB: "20000000-0000-4000-8000-000000000002",
  modeA: "30000000-0000-4000-8000-000000000001",
  modeB: "30000000-0000-4000-8000-000000000002",
  periodA: "40000000-0000-4000-8000-000000000001",
};

const salaryRow = (workerId, finalPayable) => ({
  worker_id: workerId,
  wage_type: "monthly",
  wage_amount: 1000,
  attendance_days: 10,
  attendance_hours: 80,
  productive_minutes: 1200,
  gross_suggested_amount: finalPayable,
  advance_deduction: 0,
  loan_deduction: 0,
  other_deduction: 0,
  repayment_credit: 0,
  manual_adjustment: 0,
  final_payable: finalPayable,
  notes: "DB lifecycle suggestion",
});
const salaryPayload = (workerId, finalPayable) => JSON.stringify([salaryRow(workerId, finalPayable)]).replaceAll("'", "''");
const salaryPayloadForRows = (rows) => JSON.stringify(rows).replaceAll("'", "''");

const cleanup = `delete from tenants where id in ('${ids.tenantA}', '${ids.tenantB}');`;

try {
  await runSql(`
    ${cleanup}
    insert into tenants (id, name, slug, store_name) values
      ('${ids.tenantA}', 'Worker Money DB A', 'worker-money-db-a', 'Worker Money DB A'),
      ('${ids.tenantB}', 'Worker Money DB B', 'worker-money-db-b', 'Worker Money DB B');
    insert into workers (id, tenant_id, name, wage_type, wage_amount) values
      ('${ids.workerA}', '${ids.tenantA}', 'Worker A', 'monthly', 1000),
      ('${ids.workerA2}', '${ids.tenantA}', 'Worker A2', 'monthly', 1000),
      ('${ids.workerB}', '${ids.tenantB}', 'Worker B', 'monthly', 1000);
    update workers set status = 'inactive' where id = '${ids.workerA2}';
    insert into payment_modes (id, tenant_id, name) values
      ('${ids.modeA}', '${ids.tenantA}', 'DB cash A'),
      ('${ids.modeB}', '${ids.tenantB}', 'DB cash B');
    insert into salary_periods (id, tenant_id, period_start, period_end, status)
      values ('${ids.periodA}', '${ids.tenantA}', '2026-08-01', '2026-08-31', 'finalized');
    insert into salary_calculations (
      tenant_id, salary_period_id, worker_id, wage_type, wage_amount,
      final_payable, finalized_payable_amount, finalized_at, finalized_by
    ) values (
      '${ids.tenantA}', '${ids.periodA}', '${ids.workerA}', 'monthly', 1000,
      500, 500, now(), 'db-test'
    );
  `);

  assert.equal(
    await runSql(`
      select
        has_function_privilege('authenticated', 'create_salary_period_with_calculations(uuid,date,date,jsonb,text,uuid)', 'EXECUTE')::int || ':' ||
        has_function_privilege('authenticated', 'update_salary_period_with_calculations(uuid,uuid,date,date,jsonb,text,uuid)', 'EXECUTE')::int || ':' ||
        has_function_privilege('authenticated', 'regenerate_salary_period_calculations(uuid,uuid,jsonb,text,uuid)', 'EXECUTE')::int || ':' ||
        has_function_privilege('authenticated', 'finalize_salary_calculation(uuid,uuid,numeric,text,text,uuid)', 'EXECUTE')::int || ':' ||
        has_function_privilege('authenticated', 'finalize_salary_calculations_bulk(uuid,uuid,jsonb,text,uuid)', 'EXECUTE')::int || ':' ||
        has_function_privilege('authenticated', 'record_salary_payments_bulk(uuid,uuid,jsonb,date,uuid,text,text,uuid)', 'EXECUTE')::int;
    `),
    "0:0:0:0:0:0",
    "authenticated clients must not execute service-only salary workflow commands directly",
  );
  assert.equal(
    await runSql(`select has_function_privilege('authenticated', 'create_worker_configuration(uuid,text,text,date,uuid,worker_wage_type,numeric,text,uuid[],text)', 'EXECUTE')::int || ':' || has_function_privilege('authenticated', 'update_worker_configuration(uuid,uuid,text,text,date,worker_status,uuid,worker_wage_type,numeric,text,uuid[],text)', 'EXECUTE')::int;`),
    "0:0",
    "authenticated clients must not bypass worker configuration permissions through security-definer RPCs",
  );
  assert.equal(
    await runSql(`select has_function_privilege('authenticated', 'worker_money_summaries(uuid)', 'EXECUTE')::int || ':' || has_function_privilege('service_role', 'worker_money_summaries(uuid)', 'EXECUTE')::int;`),
    "0:1",
    "worker money summaries must be exposed only to the trusted server client",
  );
  assert.equal(
    await runSql(`select has_function_privilege('service_role', 'insert_salary_calculation_payload(uuid,uuid,jsonb,text)', 'EXECUTE')::int || ':' || has_function_privilege('service_role', 'salary_workflow_receipt(uuid,uuid,text,text,text)', 'EXECUTE')::int || ':' || has_function_privilege('service_role', 'lock_salary_period(uuid,uuid)', 'EXECUTE')::int || ':' || has_function_privilege('service_role', 'worker_money_balance(uuid,uuid,text,uuid)', 'EXECUTE')::int || ':' || has_function_privilege('service_role', 'refresh_salary_payment_from_ledger(uuid,uuid,uuid,text)', 'EXECUTE')::int;`),
    "0:0:0:0:0",
    "internal salary helpers must not be directly executable through the service API",
  );
  await runSql(`insert into worker_ledger (tenant_id, worker_id, transaction_type, amount, transaction_date, description, idempotency_key) values ('${ids.tenantA}', '${ids.workerA}', 'adjustment', 5, '2026-08-01', 'Legacy null fingerprint fixture', '50000000-0000-4000-8000-000000000099');`);
  await assert.rejects(
    runSql(`select (record_worker_money_entry('${ids.tenantA}', '${ids.workerA}', 'adjustment', 5, '2026-08-01', null, null, null, 'Legacy null fingerprint fixture', 'db-test', '50000000-0000-4000-8000-000000000099')).id;`),
    /WORKER_MONEY_IDEMPOTENCY_CONFLICT/,
    "legacy retry rows without a command fingerprint must fail closed rather than bind an arbitrary payload",
  );

  const concurrentAdvanceSql = `
    select (record_worker_money_entry(
      '${ids.tenantA}', '${ids.workerA}', 'advance_given', 100, '2026-08-05',
      null, '${ids.modeA}', null, 'Concurrent advance', 'db-test',
      '50000000-0000-4000-8000-000000000001'
    )).id;
  `;
  const [advanceOne, advanceTwo] = await Promise.all([
    runSql(concurrentAdvanceSql),
    runSql(concurrentAdvanceSql),
  ]);
  assert.equal(advanceOne, advanceTwo, "concurrent record retries must resolve to one entry");
  await assert.rejects(
    runSql(`select (record_worker_money_entry('${ids.tenantA}', '${ids.workerA}', 'advance_given', 101, '2026-08-05', null, '${ids.modeA}', null, 'Concurrent advance', 'db-test', '50000000-0000-4000-8000-000000000001')).id;`),
    /WORKER_MONEY_IDEMPOTENCY_CONFLICT/,
    "an edited record retry must not be reported as the old saved command",
  );

  const concurrentCorrectionSql = `
    select (correct_worker_money_entry(
      '${ids.tenantA}', '${advanceOne}', 120, '2026-08-05', null, '${ids.modeA}',
      'Corrected concurrent advance', 'DB concurrency correction', 'db-test',
      '50000000-0000-4000-8000-000000000002'
    )).id;
  `;
  const [correctionOne, correctionTwo] = await Promise.all([
    runSql(concurrentCorrectionSql),
    runSql(concurrentCorrectionSql),
  ]);
  assert.equal(correctionOne, correctionTwo, "concurrent correction retries must resolve to one replacement");
  await assert.rejects(
    runSql(`select (correct_worker_money_entry('${ids.tenantA}', '${advanceOne}', 121, '2026-08-05', null, '${ids.modeA}', 'Corrected concurrent advance', 'Changed retry amount', 'db-test', '50000000-0000-4000-8000-000000000002')).id;`),
    /WORKER_MONEY_IDEMPOTENCY_CONFLICT/,
    "an edited correction retry must not be reported as the old replacement",
  );

  await runSql(`
    do $$
    declare
      v_before integer;
      v_count integer;
      v_summary record;
    begin
      select count(*) into v_count from worker_ledger
      where tenant_id = '${ids.tenantA}' and idempotency_key = '50000000-0000-4000-8000-000000000001';
      if v_count <> 1 then raise exception 'DB_TEST_DUPLICATE_RECORD'; end if;

      select count(*) into v_count from worker_ledger
      where tenant_id = '${ids.tenantA}' and idempotency_key = '50000000-0000-4000-8000-000000000002';
      if v_count <> 1 then raise exception 'DB_TEST_DUPLICATE_CORRECTION'; end if;

      select count(*) into v_before from worker_ledger where tenant_id = '${ids.tenantA}';
      begin
        perform record_worker_money_entry(
          '${ids.tenantA}', '${ids.workerB}', 'advance_given', 10, '2026-08-05',
          null, '${ids.modeA}', null, 'Foreign worker', 'db-test',
          '50000000-0000-4000-8000-000000000003'
        );
        raise exception 'DB_TEST_FOREIGN_WORKER_ACCEPTED';
      exception when others then
        if sqlerrm = 'DB_TEST_FOREIGN_WORKER_ACCEPTED' then raise; end if;
      end;
      begin
        perform record_worker_money_entry(
          '${ids.tenantA}', '${ids.workerA}', 'loan_given', 10, '2026-08-05',
          null, '${ids.modeB}', null, 'Foreign mode', 'db-test',
          '50000000-0000-4000-8000-000000000004'
        );
        raise exception 'DB_TEST_FOREIGN_MODE_ACCEPTED';
      exception when others then
        if sqlerrm = 'DB_TEST_FOREIGN_MODE_ACCEPTED' then raise; end if;
      end;
      select count(*) into v_count from worker_ledger where tenant_id = '${ids.tenantA}';
      if v_count <> v_before then raise exception 'DB_TEST_FAILED_COMMAND_LEFT_ROWS'; end if;

      begin
        perform record_worker_money_entry(
          '${ids.tenantA}', '${ids.workerA}', 'repayment', 121, '2026-08-06',
          'advance', '${ids.modeA}', null, 'Too much repayment', 'db-test',
          '50000000-0000-4000-8000-000000000005'
        );
        raise exception 'DB_TEST_OVER_BALANCE_ACCEPTED';
      exception when others then
        if sqlerrm = 'DB_TEST_OVER_BALANCE_ACCEPTED' then raise; end if;
      end;

      perform record_worker_money_entry(
        '${ids.tenantA}', '${ids.workerA}', 'repayment', 40, '2026-08-06',
        'advance', '${ids.modeA}', null, 'Valid repayment', 'db-test',
        '50000000-0000-4000-8000-000000000006'
      );

      select * into v_summary from worker_money_summaries('${ids.tenantA}')
      where worker_id = '${ids.workerA}';
      if v_summary.advance_balance <> 80 then raise exception 'DB_TEST_ADVANCE_SUMMARY:%', v_summary.advance_balance; end if;

      perform record_worker_money_entry(
        '${ids.tenantA}', '${ids.workerA}', 'salary_paid', 400, '2026-08-07',
        null, '${ids.modeA}', '${ids.periodA}', 'Salary part payment', 'db-test',
        '50000000-0000-4000-8000-000000000007'
      );
      begin
        perform record_worker_money_entry(
          '${ids.tenantA}', '${ids.workerA}', 'salary_paid', 101, '2026-08-07',
          null, '${ids.modeA}', '${ids.periodA}', 'Salary overpayment', 'db-test',
          '50000000-0000-4000-8000-000000000008'
        );
        raise exception 'DB_TEST_OVERPAY_ACCEPTED';
      exception when others then
        if sqlerrm = 'DB_TEST_OVERPAY_ACCEPTED' then raise; end if;
      end;

      perform reverse_worker_money_entry(
        '${ids.tenantA}',
        (select id from worker_ledger where tenant_id = '${ids.tenantA}' and idempotency_key = '50000000-0000-4000-8000-000000000006'),
        'DB reversal test', 'db-test'
      );
      perform reverse_worker_money_entry(
        '${ids.tenantA}',
        (select id from worker_ledger where tenant_id = '${ids.tenantA}' and idempotency_key = '50000000-0000-4000-8000-000000000006'),
        'DB reversal retry', 'db-test'
      );

      select * into v_summary from worker_money_summaries('${ids.tenantA}')
      where worker_id = '${ids.workerA}';
      if v_summary.advance_balance <> 120 then raise exception 'DB_TEST_REVERSAL_SUMMARY:%', v_summary.advance_balance; end if;
      if v_summary.salary_paid <> 400 then raise exception 'DB_TEST_SALARY_SUMMARY:%', v_summary.salary_paid; end if;

      if (select amount_paid from salary_calculations where tenant_id = '${ids.tenantA}' and worker_id = '${ids.workerA}') <> 400 then
        raise exception 'DB_TEST_SALARY_REFRESH';
      end if;
    end;
    $$;
  `);

  const septemberCreateSql = `
    select create_salary_period_with_calculations(
      '${ids.tenantA}', '2026-09-01', '2026-09-30',
      '${salaryPayload(ids.workerA, 0)}'::jsonb, 'db-test',
      '60000000-0000-4000-8000-000000000001'
    );
  `;
  const septemberOne = await runSql(septemberCreateSql);
  const septemberTwo = await runSql(septemberCreateSql);
  assert.equal(septemberOne, septemberTwo, "salary period creation retries must return the same result");
  const septemberPeriodId = JSON.parse(septemberOne).periodId;

  const septemberCalculationId = await runSql(`
    select id from salary_calculations
    where tenant_id = '${ids.tenantA}' and salary_period_id = '${septemberPeriodId}' and deleted_at is null;
  `);
  assert.ok(septemberCalculationId, "atomic creation must include the worker calculation");

  assert.equal(
    await runSql(`select create_salary_period_with_calculations('${ids.tenantA}', '2026-09-01', '2026-09-30', '${salaryPayload(ids.workerA, 99)}'::jsonb, 'db-test', '60000000-0000-4000-8000-000000000001');`),
    septemberOne,
    "a lost-response retry must return the original receipt even if live generated inputs changed",
  );
  assert.equal(
    await runSql(`select final_payable from salary_calculations where id = '${septemberCalculationId}';`),
    "0.00",
    "a lost-response retry must not rewrite the committed calculation payload",
  );
  await assert.rejects(
    runSql(`select finalize_salary_calculation('${ids.tenantA}', '${septemberCalculationId}', 0, null, 'db-test', '60000000-0000-4000-8000-000000000001');`),
    /SALARY_WORKFLOW_IDEMPOTENCY_CONFLICT/,
    "an idempotency key must not be reused across command types",
  );

  await runSql(`insert into workers (tenant_id, name, wage_type, wage_amount) values ('${ids.tenantA}', 'Second active worker', 'monthly', 800);`);
  await assert.rejects(
    runSql(`select regenerate_salary_period_calculations('${ids.tenantA}', '${septemberPeriodId}', '${salaryPayload(ids.workerA, 0)}'::jsonb, 'db-test', '60000000-0000-4000-8000-000000000016');`),
    /SALARY_CALCULATIONS_INCOMPLETE/,
    "salary payloads must contain exactly one row for every active tenant worker",
  );
  await runSql(`update workers set status = 'inactive' where tenant_id = '${ids.tenantA}' and name = 'Second active worker';`);

  await runSql(`
    do $$
    declare
      v_before uuid;
      v_count integer;
    begin
      select id into v_before from salary_calculations
      where tenant_id = '${ids.tenantA}' and salary_period_id = '${septemberPeriodId}' and deleted_at is null;
      begin
        perform regenerate_salary_period_calculations(
          '${ids.tenantA}', '${septemberPeriodId}',
          '${salaryPayload(ids.workerB, 50)}'::jsonb, 'db-test',
          '60000000-0000-4000-8000-000000000002'
        );
        raise exception 'DB_TEST_FOREIGN_REGEN_ACCEPTED';
      exception when others then
        if sqlerrm = 'DB_TEST_FOREIGN_REGEN_ACCEPTED' then raise; end if;
      end;
      select count(*) into v_count from salary_calculations
      where tenant_id = '${ids.tenantA}' and salary_period_id = '${septemberPeriodId}'
        and deleted_at is null and id = v_before;
      if v_count <> 1 then raise exception 'DB_TEST_REGEN_ROLLBACK_LOST_ORIGINAL'; end if;
    end;
    $$;
  `);

  const updatePeriodSql = `
    select update_salary_period_with_calculations(
      '${ids.tenantA}', '${septemberPeriodId}', '2026-09-02', '2026-09-29',
      '${salaryPayload(ids.workerA, 0)}'::jsonb, 'db-test',
      '60000000-0000-4000-8000-000000000014'
    );
  `;
  assert.equal(await runSql(updatePeriodSql), await runSql(updatePeriodSql), "period date edit retries must be idempotent");
  assert.equal(
    await runSql(`select period_start || ':' || period_end from salary_periods where id = '${septemberPeriodId}';`),
    "2026-09-02:2026-09-29",
    "period date edit must update dates and calculations together",
  );

  const regenerated = await runSql(`
    select regenerate_salary_period_calculations(
      '${ids.tenantA}', '${septemberPeriodId}',
      '${salaryPayload(ids.workerA, 0)}'::jsonb, 'db-test',
      '60000000-0000-4000-8000-000000000003'
    );
  `);
  assert.equal(JSON.parse(regenerated).calculationCount, 1, "regeneration must replace the draft atomically");
  const activeSeptemberCalculation = await runSql(`
    select id from salary_calculations
    where tenant_id = '${ids.tenantA}' and salary_period_id = '${septemberPeriodId}' and deleted_at is null;
  `);

  const zeroFinalizeSql = `
    select finalize_salary_calculation(
      '${ids.tenantA}', '${activeSeptemberCalculation}', 0, null, 'db-test',
      '60000000-0000-4000-8000-000000000004'
    );
  `;
  const zeroFinalizeOne = await runSql(zeroFinalizeSql);
  const zeroFinalizeTwo = await runSql(zeroFinalizeSql);
  assert.equal(zeroFinalizeOne, zeroFinalizeTwo, "finalization retries must return the same result");
  assert.equal(
    await runSql(`select payment_status || ':' || status from salary_calculations join salary_periods on salary_periods.id = salary_calculations.salary_period_id where salary_calculations.id = '${activeSeptemberCalculation}';`),
    "paid:paid",
    "zero-payable salary must be an explicit paid/no-payment-due state",
  );
  assert.equal(
    await runSql(`select count(*) from salary_calculation_revisions where salary_calculation_id = '${activeSeptemberCalculation}';`),
    "1",
    "idempotent finalization must write one audit revision",
  );

  await runSql(`
    select finalize_salary_calculation(
      '${ids.tenantA}', '${activeSeptemberCalculation}', 600, 'Founder approved manual payable', 'db-test',
      '60000000-0000-4000-8000-000000000005'
    );
  `);
  await runSql(`
    do $$
    begin
      begin
        perform update_salary_period_with_calculations(
          '${ids.tenantA}', '${septemberPeriodId}', '2026-09-01', '2026-09-30',
          '${salaryPayload(ids.workerA, 600)}'::jsonb, 'db-test',
          '60000000-0000-4000-8000-000000000015'
        );
        raise exception 'DB_TEST_DECIDED_PERIOD_EDIT_ACCEPTED';
      exception when others then
        if sqlerrm = 'DB_TEST_DECIDED_PERIOD_EDIT_ACCEPTED' then raise; end if;
      end;
    end;
    $$;
  `);
  assert.equal(
    await runSql(`select payment_status || ':' || status from salary_calculations join salary_periods on salary_periods.id = salary_calculations.salary_period_id where salary_calculations.id = '${activeSeptemberCalculation}';`),
    "unpaid:finalized",
    "raising a zero payable must reopen the finalized amount without recording cash",
  );

  await runSql(`
    select record_worker_money_entry(
      '${ids.tenantA}', '${ids.workerA}', 'salary_paid', 400, '2026-09-30',
      null, '${ids.modeA}', '${septemberPeriodId}', 'Lifecycle partial salary', 'db-test',
      '60000000-0000-4000-8000-000000000006'
    );
  `);
  assert.equal(
    await runSql(`select amount_paid || ':' || payment_status || ':' || status from salary_calculations join salary_periods on salary_periods.id = salary_calculations.salary_period_id where salary_calculations.id = '${activeSeptemberCalculation}';`),
    "400.00:partially_paid:finalized",
    "partial payment must update worker and period state",
  );

  await runSql(`
    do $$
    declare v_revisions integer;
    begin
      select count(*) into v_revisions from salary_calculation_revisions where salary_calculation_id = '${activeSeptemberCalculation}';
      begin
        perform finalize_salary_calculation(
          '${ids.tenantA}', '${activeSeptemberCalculation}', 399, 'Below paid test', 'db-test',
          '60000000-0000-4000-8000-000000000007'
        );
        raise exception 'DB_TEST_PAYABLE_BELOW_PAID_ACCEPTED';
      exception when others then
        if sqlerrm = 'DB_TEST_PAYABLE_BELOW_PAID_ACCEPTED' then raise; end if;
      end;
      if (select count(*) from salary_calculation_revisions where salary_calculation_id = '${activeSeptemberCalculation}') <> v_revisions then
        raise exception 'DB_TEST_REJECTED_FINALIZE_LEFT_AUDIT';
      end if;
    end;
    $$;
  `);

  await runSql(`
    select record_worker_money_entry(
      '${ids.tenantA}', '${ids.workerA}', 'salary_paid', 200, '2026-09-30',
      null, '${ids.modeA}', '${septemberPeriodId}', 'Lifecycle final salary', 'db-test',
      '60000000-0000-4000-8000-000000000008'
    );
  `);
  assert.equal(
    await runSql(`select amount_paid || ':' || payment_status || ':' || status from salary_calculations join salary_periods on salary_periods.id = salary_calculations.salary_period_id where salary_calculations.id = '${activeSeptemberCalculation}';`),
    "600.00:paid:paid",
    "full payment must close the worker and period",
  );

  const correctedSalaryPaymentId = await runSql(`
    select (correct_worker_money_entry(
      '${ids.tenantA}',
      (select id from worker_ledger where tenant_id = '${ids.tenantA}' and idempotency_key = '60000000-0000-4000-8000-000000000008'),
      100, '2026-09-30', null, '${ids.modeA}', 'Corrected lifecycle salary',
      'Payment amount entered incorrectly', 'db-test',
      '60000000-0000-4000-8000-000000000012'
    )).id;
  `);
  assert.equal(
    await runSql(`select amount_paid || ':' || payment_status || ':' || status from salary_calculations join salary_periods on salary_periods.id = salary_calculations.salary_period_id where salary_calculations.id = '${activeSeptemberCalculation}';`),
    "500.00:partially_paid:finalized",
    "salary payment correction must reopen the worker and period",
  );

  await runSql(`select reverse_worker_money_entry('${ids.tenantA}', '${correctedSalaryPaymentId}', 'Replacement should be removed', 'db-test');`);
  assert.equal(
    await runSql(`select amount_paid || ':' || payment_status || ':' || status from salary_calculations join salary_periods on salary_periods.id = salary_calculations.salary_period_id where salary_calculations.id = '${activeSeptemberCalculation}';`),
    "400.00:partially_paid:finalized",
    "salary payment reversal must refresh the worker and period",
  );

  await runSql(`
    select record_worker_money_entry(
      '${ids.tenantA}', '${ids.workerA}', 'salary_paid', 200, '2026-09-30',
      null, '${ids.modeA}', '${septemberPeriodId}', 'Replacement final salary', 'db-test',
      '60000000-0000-4000-8000-000000000013'
    );
  `);
  assert.equal(
    await runSql(`select amount_paid || ':' || payment_status || ':' || status from salary_calculations join salary_periods on salary_periods.id = salary_calculations.salary_period_id where salary_calculations.id = '${activeSeptemberCalculation}';`),
    "600.00:paid:paid",
    "replacement salary payment must close the worker and period again",
  );

  const overlapPayload = salaryPayload(ids.workerA, 100);
  const overlapCalls = await Promise.allSettled([
    runSql(`select create_salary_period_with_calculations('${ids.tenantA}', '2026-10-01', '2026-10-15', '${overlapPayload}'::jsonb, 'db-test', '60000000-0000-4000-8000-000000000009');`),
    runSql(`select create_salary_period_with_calculations('${ids.tenantA}', '2026-10-10', '2026-10-31', '${overlapPayload}'::jsonb, 'db-test', '60000000-0000-4000-8000-000000000010');`),
  ]);
  assert.equal(overlapCalls.filter((result) => result.status === "fulfilled").length, 1, "tenant lock must allow only one concurrent overlapping salary period");
  assert.equal(overlapCalls.filter((result) => result.status === "rejected").length, 1, "one concurrent overlapping salary period must fail closed");
  assert.match(overlapCalls.find((result) => result.status === "rejected").reason.message, /SALARY_PERIOD_OVERLAP/);

  await runSql(`
    do $$
    declare v_before integer;
    begin
      select count(*) into v_before from salary_periods where tenant_id = '${ids.tenantA}';
      begin
        perform create_salary_period_with_calculations(
          '${ids.tenantA}', '2026-12-01', '2026-12-31', '[]'::jsonb, 'db-test',
          '60000000-0000-4000-8000-000000000011'
        );
        raise exception 'DB_TEST_EMPTY_PERIOD_ACCEPTED';
      exception when others then
        if sqlerrm = 'DB_TEST_EMPTY_PERIOD_ACCEPTED' then raise; end if;
      end;
      if (select count(*) from salary_periods where tenant_id = '${ids.tenantA}') <> v_before then
        raise exception 'DB_TEST_FAILED_CREATE_LEFT_PERIOD';
      end if;
    end;
    $$;
  `);

  const racePayload = salaryPayload(ids.workerA, 250);
  const raceCreate = JSON.parse(await runSql(`select create_salary_period_with_calculations('${ids.tenantA}', '2027-01-01', '2027-01-31', '${racePayload}'::jsonb, 'db-test', '60000000-0000-4000-8000-000000000017');`));
  const raceCalculation = await runSql(`select id from salary_calculations where salary_period_id = '${raceCreate.periodId}' and deleted_at is null;`);
  const finalizeRegenerateRace = await Promise.allSettled([
    runSql(`select finalize_salary_calculation('${ids.tenantA}', '${raceCalculation}', 250, null, 'db-test', '60000000-0000-4000-8000-000000000018');`),
    runSql(`select regenerate_salary_period_calculations('${ids.tenantA}', '${raceCreate.periodId}', '${racePayload}'::jsonb, 'db-test', '60000000-0000-4000-8000-000000000019');`),
  ]);
  assert.notEqual(
    finalizeRegenerateRace.filter((result) => result.status === "fulfilled").length,
    2,
    "concurrent finalize and regenerate must not both commit",
  );
  assert.equal(
    await runSql(`select count(*) from salary_calculations where salary_period_id = '${raceCreate.periodId}' and deleted_at is null and finalized_payable_amount is not null;`),
    finalizeRegenerateRace[0].status === "fulfilled" ? "1" : "0",
    "a committed finalization must remain the active calculation decision",
  );

  const dateRaceCreate = JSON.parse(await runSql(`select create_salary_period_with_calculations('${ids.tenantA}', '2027-02-01', '2027-02-28', '${racePayload}'::jsonb, 'db-test', '60000000-0000-4000-8000-000000000020');`));
  const dateRaceCalculation = await runSql(`select id from salary_calculations where salary_period_id = '${dateRaceCreate.periodId}' and deleted_at is null;`);
  const finalizeDateRace = await Promise.allSettled([
    runSql(`select finalize_salary_calculation('${ids.tenantA}', '${dateRaceCalculation}', 250, null, 'db-test', '60000000-0000-4000-8000-000000000021');`),
    runSql(`select update_salary_period_with_calculations('${ids.tenantA}', '${dateRaceCreate.periodId}', '2027-02-02', '2027-02-27', '${racePayload}'::jsonb, 'db-test', '60000000-0000-4000-8000-000000000022');`),
  ]);
  assert.notEqual(
    finalizeDateRace.filter((result) => result.status === "fulfilled").length,
    2,
    "concurrent finalize and date edit must not both commit",
  );
  assert.equal(
    await runSql(`select count(*) from salary_calculations where salary_period_id = '${dateRaceCreate.periodId}' and deleted_at is null and finalized_payable_amount is not null;`),
    finalizeDateRace[0].status === "fulfilled" ? "1" : "0",
    "a committed finalization must survive a concurrent date-edit attempt",
  );

  await assert.rejects(
    runSql(`update salary_workflow_operations set result_json = '{}'::jsonb where tenant_id = '${ids.tenantA}';`),
    /IMMUTABLE_AUDIT_RECORD/,
    "salary command receipts must be immutable",
  );
  await assert.rejects(
    runSql(`delete from salary_calculation_revisions where tenant_id = '${ids.tenantA}';`),
    /IMMUTABLE_AUDIT_RECORD/,
    "salary decision revisions must be immutable",
  );

  await runSql(`update workers set status = 'active' where id = '${ids.workerA2}';`);
  const twoWorkerPayload = salaryPayloadForRows([
    salaryRow(ids.workerA, 100),
    salaryRow(ids.workerA2, 100),
  ]);
  const twoWorkerPeriod = JSON.parse(await runSql(`select create_salary_period_with_calculations('${ids.tenantA}', '2027-03-01', '2027-03-31', '${twoWorkerPayload}'::jsonb, 'db-test', '60000000-0000-4000-8000-000000000023');`));
  const [twoWorkerCalculationA, twoWorkerCalculationB] = (await runSql(`select id from salary_calculations where salary_period_id = '${twoWorkerPeriod.periodId}' and deleted_at is null order by worker_id;`)).split("\n");
  await runSql(`select finalize_salary_calculation('${ids.tenantA}', '${twoWorkerCalculationA}', 100, null, 'db-test', '60000000-0000-4000-8000-000000000024');`);
  await runSql(`select finalize_salary_calculation('${ids.tenantA}', '${twoWorkerCalculationB}', 100, null, 'db-test', '60000000-0000-4000-8000-000000000025');`);
  const concurrentFinalPayments = await Promise.all([
    runSql(`select (record_worker_money_entry('${ids.tenantA}', '${ids.workerA}', 'salary_paid', 100, '2027-03-31', null, '${ids.modeA}', '${twoWorkerPeriod.periodId}', 'Concurrent final A', 'db-test', '60000000-0000-4000-8000-000000000026')).id;`),
    runSql(`select (record_worker_money_entry('${ids.tenantA}', '${ids.workerA2}', 'salary_paid', 100, '2027-03-31', null, '${ids.modeA}', '${twoWorkerPeriod.periodId}', 'Concurrent final B', 'db-test', '60000000-0000-4000-8000-000000000027')).id;`),
  ]);
  assert.equal(
    await runSql(`select status from salary_periods where id = '${twoWorkerPeriod.periodId}';`),
    "paid",
    "concurrent final payments for different workers must close the aggregate period",
  );
  await runSql(`select reverse_worker_money_entry('${ids.tenantA}', '${concurrentFinalPayments[1]}', 'Reopen concurrent payment test', 'db-test');`);
  assert.equal(
    await runSql(`select status from salary_periods where id = '${twoWorkerPeriod.periodId}';`),
    "finalized",
    "reversing one payment must reopen the aggregate period",
  );

  const bulkPeriod = JSON.parse(await runSql(`select create_salary_period_with_calculations('${ids.tenantA}', '2027-04-01', '2027-04-30', '${twoWorkerPayload}'::jsonb, 'db-test', '60000000-0000-4000-8000-000000000028');`));
  const bulkFinalizeRows = await runSql(`
    select jsonb_agg(jsonb_build_object(
      'calculationId', id,
      'expectedUpdatedAt', updated_at,
      'finalizedPayableAmount', final_payable,
      'finalizationNote', null
    ) order by worker_id)
    from salary_calculations
    where tenant_id = '${ids.tenantA}'
      and salary_period_id = '${bulkPeriod.periodId}'
      and deleted_at is null;
  `);
  const bulkFinalizeSql = `select finalize_salary_calculations_bulk(
    '${ids.tenantA}', '${bulkPeriod.periodId}', '${bulkFinalizeRows.replaceAll("'", "''")}'::jsonb,
    'db-test', '60000000-0000-4000-8000-000000000029'
  );`;
  const invalidBulkFinalizeRows = JSON.parse(bulkFinalizeRows);
  invalidBulkFinalizeRows[1].finalizedPayableAmount = 99;
  await assert.rejects(
    runSql(`select finalize_salary_calculations_bulk('${ids.tenantA}', '${bulkPeriod.periodId}', '${JSON.stringify(invalidBulkFinalizeRows).replaceAll("'", "''")}'::jsonb, 'db-test', '60000000-0000-4000-8000-000000000031');`),
    /SALARY_FINALIZATION_NOTE_REQUIRED/,
    "one invalid payable must reject the complete selected batch",
  );
  assert.equal(
    await runSql(`select count(*) from salary_calculations where salary_period_id = '${bulkPeriod.periodId}' and finalized_payable_amount is not null;`),
    "0",
    "a rejected bulk finalization must leave every selected calculation unchanged",
  );
  const bulkFinalizeOne = await runSql(bulkFinalizeSql);
  const bulkFinalizeTwo = await runSql(bulkFinalizeSql);
  assert.equal(bulkFinalizeOne, bulkFinalizeTwo, "bulk payable finalization retries must return the same result");
  assert.equal(JSON.parse(bulkFinalizeOne).finalizedCount, 2, "bulk payable finalization must save every selected worker");
  assert.equal(
    await runSql(`select count(*) || ':' || min(status) from salary_calculations join salary_periods on salary_periods.id = salary_calculations.salary_period_id where salary_periods.id = '${bulkPeriod.periodId}' and salary_calculations.finalized_payable_amount is not null;`),
    "2:finalized",
    "bulk payable finalization must atomically finalize the selected rows and period",
  );
  assert.equal(
    await runSql(`select count(*) from salary_calculation_revisions where salary_period_id = '${bulkPeriod.periodId}';`),
    "2",
    "bulk payable finalization must preserve one immutable decision record per worker",
  );

  const bulkPaymentRows = await runSql(`
    select jsonb_agg(jsonb_build_object(
      'calculationId', id,
      'expectedUpdatedAt', updated_at,
      'amount', finalized_payable_amount - amount_paid
    ) order by worker_id)
    from salary_calculations
    where tenant_id = '${ids.tenantA}'
      and salary_period_id = '${bulkPeriod.periodId}'
      and deleted_at is null;
  `);
  const bulkPaymentSql = `select record_salary_payments_bulk(
    '${ids.tenantA}', '${bulkPeriod.periodId}', '${bulkPaymentRows.replaceAll("'", "''")}'::jsonb,
    '2027-04-30', '${ids.modeA}', 'Salary paid for April 2027', 'db-test',
    '60000000-0000-4000-8000-000000000030'
  );`;
  const invalidBulkPaymentRows = JSON.parse(bulkPaymentRows);
  invalidBulkPaymentRows[1].amount = 101;
  await assert.rejects(
    runSql(`select record_salary_payments_bulk('${ids.tenantA}', '${bulkPeriod.periodId}', '${JSON.stringify(invalidBulkPaymentRows).replaceAll("'", "''")}'::jsonb, '2027-04-30', '${ids.modeA}', 'Invalid bulk payment', 'db-test', '60000000-0000-4000-8000-000000000032');`),
    /WORKER_MONEY_SALARY_OVERPAY/,
    "one overpaying worker must reject the complete selected payment batch",
  );
  assert.equal(
    await runSql(`select count(*) from worker_ledger where linked_salary_period_id = '${bulkPeriod.periodId}' and transaction_type = 'salary_paid';`),
    "0",
    "a rejected bulk payment must leave every selected worker unpaid",
  );
  const bulkPaymentOne = await runSql(bulkPaymentSql);
  const bulkPaymentTwo = await runSql(bulkPaymentSql);
  assert.equal(bulkPaymentOne, bulkPaymentTwo, "bulk salary payment retries must return the same result");
  assert.equal(JSON.parse(bulkPaymentOne).paymentCount, 2, "bulk salary payment must create one payment per selected worker");
  assert.equal(
    await runSql(`select status || ':' || (select count(*) from worker_ledger where linked_salary_period_id = '${bulkPeriod.periodId}' and transaction_type = 'salary_paid' and reversed_at is null and deleted_at is null) from salary_periods where id = '${bulkPeriod.periodId}';`),
    "paid:2",
    "bulk salary payment must atomically settle the period with separate worker ledger entries",
  );

  console.log("Worker money disposable database tests passed.");
} finally {
  await runSql(cleanup);
}
