import type { WorkerLedgerTransactionType } from "@/types/database";

export type WorkerMoneyBalanceAccount = "advance" | "loan";
export type WorkerMoneyCashDirection = "in" | "none" | "out";

export type WorkerMoneyEntry = {
  amount: number;
  balance_account?: WorkerMoneyBalanceAccount | null;
  deleted_at?: string | null;
  reversed_at?: string | null;
  transaction_type: WorkerLedgerTransactionType;
};

export type WorkerMoneySummary = {
  advanceBalance: number;
  cashIn: number;
  cashOut: number;
  loanBalance: number;
  salaryCredits: number;
  salaryDeductions: number;
  unallocatedBalanceReduction: number;
};

export type WorkerLedgerSalaryEffect = {
  credit: number;
  deduction: number;
  net: number;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getWorkerMoneyCashDirection(
  transactionType: WorkerLedgerTransactionType,
): WorkerMoneyCashDirection {
  if (transactionType === "repayment") return "in";
  if (
    transactionType === "advance_given" ||
    transactionType === "loan_given" ||
    transactionType === "salary_paid"
  ) {
    return "out";
  }

  return "none";
}

export function summarizeWorkerMoney(
  entries: WorkerMoneyEntry[],
): WorkerMoneySummary {
  const summary: WorkerMoneySummary = {
    advanceBalance: 0,
    cashIn: 0,
    cashOut: 0,
    loanBalance: 0,
    salaryCredits: 0,
    salaryDeductions: 0,
    unallocatedBalanceReduction: 0,
  };

  for (const entry of entries) {
    if (entry.deleted_at || entry.reversed_at) continue;

    const amount = roundMoney(Number(entry.amount));
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const cashDirection = getWorkerMoneyCashDirection(entry.transaction_type);
    if (cashDirection === "in") summary.cashIn += amount;
    if (cashDirection === "out") summary.cashOut += amount;

    if (entry.transaction_type === "advance_given") {
      summary.advanceBalance += amount;
      continue;
    }

    if (entry.transaction_type === "loan_given") {
      summary.loanBalance += amount;
      continue;
    }

    if (entry.transaction_type === "adjustment") {
      summary.salaryCredits += amount;
      continue;
    }

    if (
      entry.transaction_type === "deduction" ||
      entry.transaction_type === "repayment"
    ) {
      if (entry.transaction_type === "deduction") {
        summary.salaryDeductions += amount;
      }

      if (entry.balance_account === "advance") {
        summary.advanceBalance -= amount;
      } else if (entry.balance_account === "loan") {
        summary.loanBalance -= amount;
      } else {
        summary.unallocatedBalanceReduction += amount;
      }
    }
  }

  return {
    advanceBalance: roundMoney(Math.max(0, summary.advanceBalance)),
    cashIn: roundMoney(summary.cashIn),
    cashOut: roundMoney(summary.cashOut),
    loanBalance: roundMoney(Math.max(0, summary.loanBalance)),
    salaryCredits: roundMoney(summary.salaryCredits),
    salaryDeductions: roundMoney(summary.salaryDeductions),
    unallocatedBalanceReduction: roundMoney(
      summary.unallocatedBalanceReduction,
    ),
  };
}

export function calculateWorkerLedgerSalaryEffect(
  entries: WorkerMoneyEntry[],
): WorkerLedgerSalaryEffect {
  let credit = 0;
  let deduction = 0;

  for (const entry of entries) {
    if (entry.deleted_at || entry.reversed_at) continue;

    const amount = roundMoney(Number(entry.amount));
    if (!Number.isFinite(amount) || amount <= 0) continue;

    if (entry.transaction_type === "adjustment") credit += amount;
    if (entry.transaction_type === "deduction") deduction += amount;
  }

  return {
    credit: roundMoney(credit),
    deduction: roundMoney(deduction),
    net: roundMoney(credit - deduction),
  };
}
