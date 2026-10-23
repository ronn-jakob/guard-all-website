import { describe, expect, it } from "vitest";
import {
  buildBillingBreakdown,
  filterInvoicesByPeriod,
  periodKey,
  periodLabel,
  summariseInvoices,
} from "./billing.js";

const invoice = (overrides) => ({
  id: "INV-1",
  status: "pending",
  issueDate: "2026-10-05",
  totalAmount: 1000,
  paidAmount: 400,
  balance: 600,
  ...overrides,
});

describe("periodKey", () => {
  it("takes the month or the year from a date", () => {
    expect(periodKey("2026-10-05", "month")).toBe("2026-10");
    expect(periodKey("2026-10-05", "year")).toBe("2026");
    expect(periodKey("2026-10-05", "all")).toBe("");
  });
});

describe("filterInvoicesByPeriod", () => {
  const invoices = [
    invoice({ id: "A", issueDate: "2026-10-05" }),
    invoice({ id: "B", issueDate: "2026-09-20" }),
    invoice({ id: "C", issueDate: "2025-10-01" }),
    invoice({ id: "D", issueDate: "2026-10-15", status: "cancelled" }),
  ];

  it("returns every non-cancelled invoice for All time", () => {
    expect(filterInvoicesByPeriod(invoices, { mode: "all" })).toHaveLength(3);
  });

  it("filters by month", () => {
    const result = filterInvoicesByPeriod(invoices, { mode: "month", value: "2026-10" });
    expect(result.map((entry) => entry.id)).toEqual(["A"]);
  });

  it("filters by year", () => {
    const result = filterInvoicesByPeriod(invoices, { mode: "year", value: "2026" });
    expect(result.map((entry) => entry.id)).toEqual(["A", "B"]);
  });

  it("never includes cancelled invoices", () => {
    const result = filterInvoicesByPeriod(invoices, { mode: "year", value: "2026" });
    expect(result.some((entry) => entry.status === "cancelled")).toBe(false);
  });
});

describe("summariseInvoices", () => {
  it("adds invoiced, collected and outstanding", () => {
    const result = summariseInvoices([
      invoice({ totalAmount: 1000, paidAmount: 400, balance: 600 }),
      invoice({ id: "B", totalAmount: 500, paidAmount: 500, balance: 0, status: "paid" }),
    ]);
    expect(result).toEqual({
      invoiced: 1500,
      collected: 900,
      outstanding: 600,
      openCount: 1,
      count: 2,
    });
  });

  it("rounds floating-point noise", () => {
    const result = summariseInvoices([
      invoice({ totalAmount: 0.1, paidAmount: 0.2, balance: 0.2 }),
    ]);
    expect(result.collected).toBe(0.2);
  });

  it("handles an empty list", () => {
    expect(summariseInvoices([])).toEqual({
      invoiced: 0,
      collected: 0,
      outstanding: 0,
      openCount: 0,
      count: 0,
    });
  });
});

describe("periodLabel", () => {
  it("labels months and years", () => {
    expect(periodLabel("month", "2026-10")).toBe("October 2026");
    expect(periodLabel("year", "2026")).toBe("2026");
  });

  it("returns empty for malformed values", () => {
    expect(periodLabel("month", "2026")).toBe("");
    expect(periodLabel("year", "2026-10")).toBe("");
    expect(periodLabel("all", "")).toBe("");
  });
});

describe("buildBillingBreakdown", () => {
  it("groups by month and sorts newest first", () => {
    const result = buildBillingBreakdown(
      [
        invoice({ id: "A", issueDate: "2026-09-10", totalAmount: 500, paidAmount: 100, balance: 400 }),
        invoice({ id: "B", issueDate: "2026-10-05", totalAmount: 1000, paidAmount: 1000, balance: 0 }),
        invoice({ id: "C", issueDate: "2026-10-20", totalAmount: 250, paidAmount: 0, balance: 250 }),
      ],
      { mode: "month" },
    );

    expect(result.map((entry) => entry.key)).toEqual(["2026-10", "2026-09"]);
    expect(result[0]).toMatchObject({
      label: "October 2026",
      count: 2,
      invoiced: 1250,
      collected: 1000,
      outstanding: 250,
    });
  });

  it("groups by year", () => {
    const result = buildBillingBreakdown(
      [
        invoice({ id: "A", issueDate: "2025-06-01" }),
        invoice({ id: "B", issueDate: "2026-01-01" }),
      ],
      { mode: "year" },
    );
    expect(result.map((entry) => entry.key)).toEqual(["2026", "2025"]);
  });

  it("skips cancelled invoices", () => {
    const result = buildBillingBreakdown(
      [invoice({ id: "A" }), invoice({ id: "B", status: "cancelled" })],
      { mode: "month" },
    );
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(1);
  });

  it("returns nothing when there are no invoices", () => {
    expect(buildBillingBreakdown([], { mode: "month" })).toEqual([]);
  });
});
