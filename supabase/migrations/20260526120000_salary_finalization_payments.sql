alter table salary_calculations
add column finalized_payable_amount numeric(12, 2),
add column finalized_at timestamptz,
add column finalized_by text,
add column finalization_note text;

alter table salary_calculations
add constraint salary_calculations_finalized_amount_non_negative
check (finalized_payable_amount is null or finalized_payable_amount >= 0);

alter table worker_ledger
add column payment_mode_id uuid references payment_modes(id) on delete set null;

create index worker_ledger_tenant_payment_mode_idx on worker_ledger(tenant_id, payment_mode_id);

comment on column salary_calculations.finalized_payable_amount is 'Founder/admin-confirmed payable amount. System suggestion remains preserved in final_payable.';
comment on column salary_calculations.finalization_note is 'Required/recommended explanation when finalized amount differs from system suggestion.';
comment on column worker_ledger.payment_mode_id is 'Payment mode used for salary-paid ledger entries and finance aggregation.';
