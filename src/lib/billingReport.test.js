import { describe, expect, it } from "vitest";
import { buildBillingReport } from "./billingReport.js";
import { resolvePeriod } from "./reportPeriods.js";

const period = resolvePeriod("month", "2026-10");

const invoice = (overrides = {}) => ({
  invoiceNumber: "INV-00001",
  clientName: "Acme",
  status: "pending",
  issueDate: "2026-10-05",
  totalAmount: 1000,
  paidAmount: 0,
  balance: 1000,
  payments: [],
  ...overrides,
});

describe("buildBillingReport", () => {
  it("keeps only invoices issued inside the period, in date order", () => {
    const report = buildBillingReport(
      [
        invoice({ invoiceNumber: "INV-00002", issueDate: "2026-10-20" }),
        invoice({ invoiceNumber: "INV-00001", issueDate: "2026-10-05" }),
        invoice({ invoiceNumber: "INV-00000", issueDate: "2026-09-30" }),
        invoice({ invoiceNumber: "INV-00003", issueDate: "2026-11-01" }),
      ],
      period,
    );

    expect(report.invoices.map((row) => row.invoiceNumber)).toEqual([
      "INV-00001",
      "INV-00002",
    ]);
  });

  it("drops cancelled invoices", () => {
    const report = buildBillingReport(
      [invoice({ status: "cancelled" }), invoice({ invoiceNumber: "INV-00002" })],
      period,
    );

    expect(report.totals.count).toBe(1);
    expect(report.invoices[0].invoiceNumber).toBe("INV-00002");
  });

  it("totals the period and splits it by status", () => {
    const report = buildBillingReport(
      [
        invoice({ status: "paid", totalAmount: 500, paidAmount: 500, balance: 0 }),
        invoice({ invoiceNumber: "INV-00002", status: "pending", totalAmount: 300, paidAmount: 100, balance: 200 }),
        invoice({ invoiceNumber: "INV-00003", status: "overdue", totalAmount: 200, paidAmount: 0, balance: 200 }),
      ],
      period,
    );

    expect(report.totals).toEqual({
      count: 3,
      invoiced: 1000,
      collected: 600,
      outstanding: 400,
    });
    expect(report.statusSplit).toEqual([
      { status: "paid", count: 1, amount: 500 },
      { status: "pending", count: 1, amount: 300 },
      { status: "overdue", count: 1, amount: 200 },
    ]);
  });

  it("lists payments received in the period, not just against period invoices", () => {
    const report = buildBillingReport(
      [
        invoice({
          invoiceNumber: "INV-00001",
          paidAmount: 400,
          payments: [
            { date: "2026-10-02", amount: 100, method: "cash" },
            { date: "2026-10-29", amount: 300, method: "bank_transfer" },
            { date: "2026-11-02", amount: 999, method: "cash" },
          ],
        }),
      ],
      period,
    );

    expect(report.payments).toEqual([
      { date: "2026-10-02", invoiceNumber: "INV-00001", clientName: "Acme", method: "cash", amount: 100 },
      { date: "2026-10-29", invoiceNumber: "INV-00001", clientName: "Acme", method: "bank_transfer", amount: 300 },
    ]);
    expect(report.paymentsTotal).toBe(400);
  });

  it("returns an empty report for a quiet period", () => {
    const report = buildBillingReport([invoice({ issueDate: "2026-09-01" })], period);

    expect(report.totals).toEqual({
      count: 0,
      invoiced: 0,
      collected: 0,
      outstanding: 0,
    });
    expect(report.payments).toEqual([]);
    expect(report.paymentsTotal).toBe(0);
  });
});
