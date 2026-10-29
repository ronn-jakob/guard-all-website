import { isWithinPeriod } from "./reportPeriods.js";

// Aggregates the invoice payload for a printable report. Kept pure so the
// printed figures can be tested without rendering anything.

const round = (value) => Math.round((Number(value) || 0) * 100) / 100;
const sum = (rows, pick) => round(rows.reduce((total, row) => total + pick(row), 0));

export function buildBillingReport(invoices, period) {
  const active = (invoices ?? []).filter((invoice) => invoice.status !== "cancelled");
  const invoicesInPeriod = active
    .filter((invoice) => isWithinPeriod(invoice.issueDate, period))
    .sort((left, right) =>
      left.issueDate < right.issueDate ? -1 : left.issueDate > right.issueDate ? 1 : 0,
    );

  // Collected stays consistent with the screen: payments received against this
  // period's invoices. The separate payments list is filtered by payment date.
  const totals = {
    count: invoicesInPeriod.length,
    invoiced: sum(invoicesInPeriod, (invoice) => invoice.totalAmount),
    collected: sum(invoicesInPeriod, (invoice) => invoice.paidAmount),
    outstanding: sum(invoicesInPeriod, (invoice) => invoice.balance),
  };

  const statusSplit = ["paid", "pending", "overdue"].map((status) => {
    const rows = invoicesInPeriod.filter((invoice) => invoice.status === status);
    return {
      status,
      count: rows.length,
      amount: sum(rows, (invoice) => invoice.totalAmount),
    };
  });

  const payments = [];
  invoicesInPeriod.forEach((invoice) => {
    (invoice.payments ?? []).forEach((payment) => {
      if (!isWithinPeriod(payment.date, period)) return;
      payments.push({
        date: String(payment.date).slice(0, 10),
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
        method: payment.method,
        amount: Number(payment.amount) || 0,
      });
    });
  });
  payments.sort((left, right) => (left.date < right.date ? -1 : left.date > right.date ? 1 : 0));

  return {
    period,
    invoices: invoicesInPeriod,
    totals,
    statusSplit,
    payments,
    paymentsTotal: sum(payments, (payment) => payment.amount),
  };
}
