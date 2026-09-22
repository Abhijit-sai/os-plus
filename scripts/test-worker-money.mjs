import assert from "node:assert/strict";

import {
  calculateWorkerLedgerSalaryEffect,
  summarizeWorkerMoney,
} from "../src/features/salary/worker-money.ts";

const entries = [
  { amount: 1_000, balance_account: "advance", transaction_type: "advance_given" },
  { amount: 2_000, balance_account: "loan", transaction_type: "loan_given" },
  { amount: 300, balance_account: "advance", transaction_type: "repayment" },
  { amount: 200, balance_account: "loan", transaction_type: "deduction" },
  { amount: 150, balance_account: null, transaction_type: "adjustment" },
  { amount: 500, balance_account: null, transaction_type: "salary_paid" },
  { amount: 999, balance_account: "advance", reversed_at: "2026-08-10T00:00:00.000Z", transaction_type: "advance_given" },
  { amount: 999, balance_account: "loan", deleted_at: "2026-08-10T00:00:00.000Z", transaction_type: "loan_given" },
];

assert.deepEqual(summarizeWorkerMoney(entries), {
  advanceBalance: 700,
  cashIn: 300,
  cashOut: 3_500,
  loanBalance: 1_800,
  salaryCredits: 150,
  salaryDeductions: 200,
  unallocatedBalanceReduction: 0,
});

const legacy = summarizeWorkerMoney([
  { amount: 100, balance_account: null, transaction_type: "repayment" },
  { amount: 50, balance_account: null, transaction_type: "deduction" },
]);

assert.equal(legacy.cashIn, 100);
assert.equal(legacy.salaryDeductions, 50);
assert.equal(legacy.unallocatedBalanceReduction, 150);
assert.equal(legacy.advanceBalance, 0);
assert.equal(legacy.loanBalance, 0);

assert.deepEqual(
  calculateWorkerLedgerSalaryEffect([
    { amount: 1_000, balance_account: "advance", transaction_type: "advance_given" },
    { amount: 2_000, balance_account: "loan", transaction_type: "loan_given" },
    { amount: 300, balance_account: "advance", transaction_type: "repayment" },
    { amount: 200, balance_account: "loan", transaction_type: "deduction" },
    { amount: 150, balance_account: null, transaction_type: "adjustment" },
  ]),
  { credit: 150, deduction: 200, net: -50 },
);

console.log("Worker money behavior tests passed.");
