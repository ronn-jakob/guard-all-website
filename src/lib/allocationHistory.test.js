import { describe, expect, it } from "vitest";
import {
  filterAllocationJobs,
  formatAllocationDate,
  formatPartsSummary,
} from "./allocationHistory.js";

const job = (overrides) => ({
  jobNumber: "WO-00020",
  clientName: "ABC Company",
  outcome: "Closed",
  lines: [{ sku: "CCTV-01", name: "CCTV Camera" }],
  ...overrides,
});

describe("filterAllocationJobs", () => {
  const jobs = [
    job({}),
    job({
      jobNumber: "WO-00015",
      clientName: "Juan Miguel",
      outcome: "In progress",
      lines: [{ sku: "BRK-04", name: "Bracket" }],
    }),
  ];

  it("returns everything with no query and the All filter", () => {
    expect(filterAllocationJobs(jobs)).toHaveLength(2);
  });

  it("matches on the work order number", () => {
    const result = filterAllocationJobs(jobs, { query: "00015" });
    expect(result.map((entry) => entry.jobNumber)).toEqual(["WO-00015"]);
  });

  it("matches on the client name, case-insensitively", () => {
    const result = filterAllocationJobs(jobs, { query: "abc" });
    expect(result.map((entry) => entry.clientName)).toEqual(["ABC Company"]);
  });

  it("matches on a part SKU or name", () => {
    expect(filterAllocationJobs(jobs, { query: "brk" })).toHaveLength(1);
    expect(filterAllocationJobs(jobs, { query: "camera" })).toHaveLength(1);
  });

  it("filters by outcome", () => {
    const result = filterAllocationJobs(jobs, { outcome: "In progress" });
    expect(result.map((entry) => entry.jobNumber)).toEqual(["WO-00015"]);
  });

  it("treats Closed as every finished outcome", () => {
    const mixed = [
      job({ jobNumber: "WO-1", outcome: "Fully used" }),
      job({ jobNumber: "WO-2", outcome: "Fully returned" }),
      job({ jobNumber: "WO-3", outcome: "Partly returned" }),
      job({ jobNumber: "WO-4", outcome: "In progress" }),
    ];
    const result = filterAllocationJobs(mixed, { outcome: "Closed" });
    expect(result.map((entry) => entry.jobNumber)).toEqual(["WO-1", "WO-2", "WO-3"]);
  });

  it("combines the query and the outcome", () => {
    expect(filterAllocationJobs(jobs, { query: "abc", outcome: "In progress" })).toEqual([]);
  });

  it("ignores whitespace-only queries", () => {
    expect(filterAllocationJobs(jobs, { query: "   " })).toHaveLength(2);
  });

  it("handles a job with no lines", () => {
    const result = filterAllocationJobs([job({ lines: [] })], { query: "abc" });
    expect(result).toHaveLength(1);
  });
});

describe("formatPartsSummary", () => {
  it("lists lines, reserved and used", () => {
    expect(
      formatPartsSummary({ partLines: 2, totalReserved: 3, totalUsed: 3, totalReturned: 0 }),
    ).toBe("2 lines · 3 reserved · 3 used");
  });

  it("appends returned stock when there is any", () => {
    expect(
      formatPartsSummary({ partLines: 1, totalReserved: 4, totalUsed: 1, totalReturned: 3 }),
    ).toBe("1 line · 4 reserved · 1 used · 3 returned");
  });

  it("falls back for an empty summary", () => {
    expect(formatPartsSummary(null)).toBe("No parts");
    expect(formatPartsSummary({ partLines: 0 })).toBe("No parts");
  });
});

describe("formatAllocationDate", () => {
  it("formats an ISO timestamp", () => {
    expect(formatAllocationDate("2026-10-17T14:31:00Z")).toMatch(/17 Oct 2026/);
  });

  it("returns a dash for missing or invalid values", () => {
    expect(formatAllocationDate(null)).toBe("—");
    expect(formatAllocationDate("")).toBe("—");
    expect(formatAllocationDate("not-a-date")).toBe("—");
  });
});
