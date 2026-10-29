import { describe, expect, it } from "vitest";
import { buildTemplatesReport } from "./templatesReport.js";

const template = (overrides = {}) => ({
  id: "t1",
  name: "Standard CCTV Install",
  jobType: "installation",
  branch: "",
  isActive: true,
  items: [
    { description: "Dome camera", quantity: 2, unitPriceClient: 100, lineTotalClient: 200 },
    { description: "Labour", quantity: 1, unitPriceClient: 500, lineTotalClient: 500 },
  ],
  total: 700,
  ...overrides,
});

describe("buildTemplatesReport", () => {
  it("sorts by name and computes totals", () => {
    const report = buildTemplatesReport([
      template({ id: "t2", name: "Zeta package", branch: "cebu", isActive: false, total: 100, items: [] }),
      template({ id: "t1", name: "Alpha package" }),
    ]);

    expect(report.rows.map((row) => row.name)).toEqual([
      "Alpha package",
      "Zeta package",
    ]);
    expect(report.totals).toEqual({
      templates: 2,
      active: 1,
      shared: 1,
      lines: 2,
    });
  });

  it("labels service types and branch scope", () => {
    const report = buildTemplatesReport([
      template(),
      template({ id: "t2", name: "Cebu repair", jobType: "repair", branch: "cebu" }),
    ]);

    expect(report.rows.find((row) => row.id === "t1").jobTypeLabel).toBe("Installation");
    expect(report.rows.find((row) => row.id === "t1").branchLabel).toBe("All branches");
    expect(report.rows.find((row) => row.id === "t2").branchLabel).toBe("Cebu");
    expect(report.byJobType).toEqual([
      { jobType: "Installation", count: 1 },
      { jobType: "Repair", count: 1 },
    ]);
  });

  it("handles an empty catalogue", () => {
    const report = buildTemplatesReport([]);

    expect(report.rows).toEqual([]);
    expect(report.totals).toEqual({ templates: 0, active: 0, shared: 0, lines: 0 });
  });
});
