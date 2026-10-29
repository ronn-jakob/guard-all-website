import { describe, expect, it } from "vitest";
import { buildFieldReportReport } from "./fieldReportReport.js";
import { resolvePeriod } from "./reportPeriods.js";

const period = resolvePeriod("month", "2026-10");

const report = (overrides = {}) => ({
  id: "FSR-00001",
  status: "Submitted",
  serviceDate: "2026-10-05",
  technician: "Albert Martinez",
  clientSignoff: true,
  parts: [{ sku: "CCTV-001", quantity: 2 }],
  ...overrides,
});

describe("buildFieldReportReport", () => {
  it("keeps filed reports inside the period and drops awaiting jobs", () => {
    const result = buildFieldReportReport(
      [
        report({ id: "FSR-00001", serviceDate: "2026-10-05" }),
        report({ id: "FSR-00002", serviceDate: "2026-09-30" }),
        report({ id: "job:WO-9", isPendingReport: true, serviceDate: undefined }),
      ],
      period,
    );

    expect(result.rows.map((row) => row.id)).toEqual(["FSR-00001"]);
    expect(result.awaitingCount).toBe(1);
  });

  it("sorts by service date, then report id", () => {
    const result = buildFieldReportReport(
      [
        report({ id: "FSR-00003", serviceDate: "2026-10-20" }),
        report({ id: "FSR-00002", serviceDate: "2026-10-05" }),
        report({ id: "FSR-00001", serviceDate: "2026-10-05" }),
      ],
      period,
    );

    expect(result.rows.map((row) => row.id)).toEqual([
      "FSR-00001",
      "FSR-00002",
      "FSR-00003",
    ]);
  });

  it("counts statuses, parts, and client sign-offs", () => {
    const result = buildFieldReportReport(
      [
        report({
          id: "FSR-00001",
          status: "Ready for Billing",
          parts: [{ quantity: 2 }, { quantity: 3 }],
        }),
        report({ id: "FSR-00002", status: "Needs Review", clientSignoff: false }),
        report({ id: "FSR-00003", status: "Submitted", parts: [] }),
        report({ id: "FSR-00004", status: "Paid", parts: [] }),
      ],
      period,
    );

    expect(result.totals).toEqual({
      reports: 4,
      readyForBilling: 1,
      needsReview: 1,
      submitted: 1,
      billed: 1,
      partsLines: 3,
      partsUnits: 7,
      signed: 3,
    });
    expect(result.byStatus).toEqual([
      { status: "Submitted", count: 1 },
      { status: "Ready for Billing", count: 1 },
      { status: "Needs Review", count: 1 },
      { status: "Paid", count: 1 },
    ]);
  });

  it("tallies technicians and falls back to Unassigned", () => {
    const result = buildFieldReportReport(
      [
        report({ technician: "Albert Martinez" }),
        report({ id: "FSR-00002", technician: "Albert Martinez" }),
        report({ id: "FSR-00003", technician: "" }),
      ],
      period,
    );

    expect(result.byTechnician).toEqual([
      { name: "Albert Martinez", count: 2 },
      { name: "Unassigned", count: 1 },
    ]);
  });
});
