import { describe, expect, it } from "vitest";
import { buildAccountsReport } from "./accountsReport.js";

const account = (overrides = {}) => ({
  id: "u1",
  name: "Alice Cruz",
  email: "alice@example.com",
  role: "Technician",
  branch: "makati",
  status: "Active",
  createdAt: "Jan 2, 2026",
  ...overrides,
});

describe("buildAccountsReport", () => {
  it("sorts by name and counts roles and branches", () => {
    const report = buildAccountsReport([
      account({ id: "u2", name: "Zara Lim", role: "Admin", branch: "cebu" }),
      account({ id: "u1", name: "Alice Cruz" }),
      account({ id: "u3", name: "Ben Tan", role: "Admin", branch: "cebu" }),
    ]);

    expect(report.rows.map((row) => row.name)).toEqual([
      "Alice Cruz",
      "Ben Tan",
      "Zara Lim",
    ]);
    expect(report.byRole).toEqual([
      { role: "Admin", count: 2 },
      { role: "Technician", count: 1 },
    ]);
    expect(report.byBranch).toEqual([
      { branch: "Cebu", count: 2 },
      { branch: "Makati", count: 1 },
    ]);
    expect(report.totals).toEqual({
      accounts: 3,
      roles: 2,
      branches: 2,
      active: 3,
    });
  });

  it("falls back for missing roles and branches", () => {
    const report = buildAccountsReport([account({ role: "", branch: null })]);

    expect(report.byRole).toEqual([{ role: "No role", count: 1 }]);
    expect(report.byBranch).toEqual([{ branch: "—", count: 1 }]);
  });

  it("handles an empty directory", () => {
    const report = buildAccountsReport([]);

    expect(report.rows).toEqual([]);
    expect(report.totals.accounts).toBe(0);
  });
});
