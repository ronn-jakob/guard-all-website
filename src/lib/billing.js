// Billing periods are derived from the invoice issue date. "Collected" always
// means payments received against the invoices of that period, so the three
// figures on a period add up to each other.
const round = (value) => Math.round((Number(value) || 0) * 100) / 100;

export function periodKey(dateValue, mode) {
  const text = String(dateValue ?? "");
  if (mode === "year") return text.slice(0, 4);
  if (mode === "month") return text.slice(0, 7);
  return "";
}

export function filterInvoicesByPeriod(invoices, { mode = "all", value = "" } = {}) {
  const active = (invoices ?? []).filter((invoice) => invoice.status !== "cancelled");
  if (mode === "all" || !value) return active;
  return active.filter((invoice) => periodKey(invoice.issueDate, mode) === value);
}

export function summariseInvoices(invoices) {
  const list = (invoices ?? []).filter((invoice) => invoice.status !== "cancelled");
  return {
    invoiced: round(list.reduce((sum, invoice) => sum + invoice.totalAmount, 0)),
    collected: round(list.reduce((sum, invoice) => sum + invoice.paidAmount, 0)),
    outstanding: round(list.reduce((sum, invoice) => sum + invoice.balance, 0)),
    openCount: list.filter((invoice) => invoice.balance > 0).length,
    count: list.length,
  };
}

export function periodLabel(mode, value) {
  if (mode === "month" && /^\d{4}-\d{2}$/.test(String(value ?? ""))) {
    return new Date(`${value}-01T00:00:00`).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
  }
  if (mode === "year" && /^\d{4}$/.test(String(value ?? ""))) {
    return String(value);
  }
  return "";
}

export function buildBillingBreakdown(invoices, { mode = "month" } = {}) {
  const groups = new Map();
  filterInvoicesByPeriod(invoices, { mode: "all" }).forEach((invoice) => {
    const key = periodKey(invoice.issueDate, mode);
    if (!key) return;
    const entry = groups.get(key) ?? { key, label: periodLabel(mode, key), invoices: [] };
    entry.invoices.push(invoice);
    groups.set(key, entry);
  });

  return [...groups.values()]
    .map((entry) => ({
      key: entry.key,
      label: entry.label,
      ...summariseInvoices(entry.invoices),
    }))
    .sort((left, right) => {
      if (left.key < right.key) return 1;
      if (left.key > right.key) return -1;
      return 0;
    });
}
