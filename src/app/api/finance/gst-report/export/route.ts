import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { getGstReportData } from "@/features/finance/queries";
import type { Expense, GstTreatment } from "@/types/database";

const gstTreatmentLabels: Record<GstTreatment, string> = {
  exempt_or_nil: "Exempt / nil rated",
  non_gst: "Non-GST",
  not_applicable: "Not applicable",
  taxable_exclusive: "GST added on top",
  taxable_inclusive: "GST included in amount"
};

function getDateParam(request: Request, name: string) {
  const value = new URL(request.url).searchParams.get(name);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function getIncludeNonGstParam(request: Request) {
  return new URL(request.url).searchParams.get("includeNonGst") === "true";
}

function formatMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function isTaxableTreatment(treatment: GstTreatment) {
  return treatment === "taxable_exclusive" || treatment === "taxable_inclusive";
}

function getExpenseExceptions(expense: Expense) {
  const exceptions: string[] = [];

  if (isTaxableTreatment(expense.gst_treatment)) {
    if (expense.input_gst_status === "needs_review") {
      exceptions.push("Input GST needs accountant review");
    }

    if (!expense.vendor_invoice_number) {
      exceptions.push("Missing vendor invoice number");
    }

    if (!expense.vendor_invoice_date) {
      exceptions.push("Missing vendor invoice date");
    }

    if (!expense.vendor_gstin && expense.input_gst_status === "claimable") {
      exceptions.push("Claimable input GST without vendor GSTIN");
    }
  }

  return exceptions;
}

function styleSheet(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    fgColor: { argb: "FFEDE9DD" },
    pattern: "solid",
    type: "pattern"
  };
  sheet.columns.forEach((column) => {
    column.width = Math.max(column.width ?? 12, 16);
  });
}

export async function GET(request: Request) {
  const startDate = getDateParam(request, "start");
  const endDate = getDateParam(request, "end");
  const includeNonGst = getIncludeNonGstParam(request);

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Start and end dates are required." }, { status: 400 });
  }

  const { context, customers, expenses, orders } = await getGstReportData({ endDate, includeNonGst, startDate });
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const outputGst = orders.reduce((sum, order) => sum + Number(order.gst_amount), 0);
  const claimableInputGst = expenses
    .filter((expense) => expense.input_gst_status === "claimable")
    .reduce((sum, expense) => sum + Number(expense.gst_amount), 0);
  const netPayable = Math.max(outputGst - claimableInputGst, 0);
  const expenseExceptions = expenses.flatMap((expense) =>
    getExpenseExceptions(expense).map((message) => ({
      amount: expense.amount,
      date: expense.expense_date,
      message,
      reference: expense.vendor_invoice_number ?? expense.paid_to ?? expense.id,
      type: "Expense"
    }))
  );
  const tenantExceptions = [
    !context.tenant.gst_registered ? "Tenant is not marked GST registered" : null,
    !context.tenant.gstin ? "Tenant GSTIN is missing" : null,
    !context.tenant.legal_name ? "Tenant legal business name is missing" : null,
    !context.tenant.registered_address ? "Tenant registered address is missing" : null
  ].filter((message): message is string => Boolean(message));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OS PLUS";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Summary");
  summary.addRows([
    ["Business", context.tenant.legal_name ?? context.tenant.name],
    ["Store", context.tenant.store_name],
    ["GSTIN", context.tenant.gstin ?? "Not set"],
    ["Registered address", context.tenant.registered_address ?? "Not set"],
    ["Period start", startDate],
    ["Period end", endDate],
    ["Rows included", includeNonGst ? "GST and non-GST transactions" : "GST-bearing transactions only"],
    ["Output GST collected", formatMoney(outputGst)],
    ["Claimable input GST", formatMoney(claimableInputGst)],
    ["Estimated net GST payable", formatMoney(netPayable)],
    ["Review exceptions", tenantExceptions.length + expenseExceptions.length]
  ]);
  summary.getColumn(1).width = 28;
  summary.getColumn(2).width = 42;

  const output = workbook.addWorksheet("Output GST");
  output.addRow(["Order date", "Order number", "Reference", "Customer", "GST treatment", "GST rate", "Taxable amount", "GST amount", "Order total"]);
  orders.forEach((order) => {
    const customer = customerById.get(order.customer_id);
    output.addRow([
      order.order_date,
      order.order_number,
      order.reference_order_id ?? "",
      customer?.name ?? "",
      gstTreatmentLabels[order.gst_treatment],
      order.gst_rate,
      formatMoney(order.taxable_amount),
      formatMoney(order.gst_amount),
      formatMoney(order.total_amount)
    ]);
  });
  styleSheet(output);

  const input = workbook.addWorksheet("Input GST");
  input.addRow(["Expense date", "Paid to", "Invoice number", "Invoice date", "Vendor GSTIN", "GST treatment", "GST rate", "Taxable amount", "GST amount", "Input GST status", "Amount paid"]);
  expenses.forEach((expense) => {
    input.addRow([
      expense.expense_date,
      expense.paid_to ?? "",
      expense.vendor_invoice_number ?? "",
      expense.vendor_invoice_date ?? "",
      expense.vendor_gstin ?? "",
      gstTreatmentLabels[expense.gst_treatment],
      expense.gst_rate,
      formatMoney(expense.taxable_amount),
      formatMoney(expense.gst_amount),
      expense.input_gst_status.replaceAll("_", " "),
      formatMoney(expense.amount)
    ]);
  });
  styleSheet(input);

  const exceptions = workbook.addWorksheet("Review Exceptions");
  exceptions.addRow(["Type", "Date", "Reference", "Amount", "Issue"]);
  tenantExceptions.forEach((message) => {
    exceptions.addRow(["Tenant profile", "", context.tenant.slug, "", message]);
  });
  expenseExceptions.forEach((exception) => {
    exceptions.addRow([exception.type, exception.date, exception.reference, formatMoney(exception.amount), exception.message]);
  });
  styleSheet(exceptions);

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `os-plus-gst-report-${startDate}-to-${endDate}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }
  });
}
