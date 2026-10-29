import { describe, expect, it } from "vitest";
import { buildAuditReport } from "./auditReport.js";
import { resolvePeriod } from "./reportPeriods.js";

const period = resolvePeriod("month", "2026-10");

const entry = (overrides = {}) => ({
  id: "a1",
  table: "jobs",
  action: "update",
  recordId: "11111111-1111-1111-1111-111111111111",
  recordLabel: "WO-00001",
  changedAt: "2026-10-05T09:00:00Z",
  actor: { name: "Website Admin", role: "Admin" },
  changes: [{ field: "status" }, { field: "branch" }],
  ...overrides,
});

describe("buildAuditReport", () => {
  it("sorts newest first without mutating the input", () => {
    const input = [
      entry({ id: "old", changedAt: "2026-10-01T09:00:00Z" }),
      entry({ id: "new", changedAt: "2026-10-09T09:00:00Z" }),
    ];
    const report = buildAuditReport(input, { total: 2 }, period);

    expect(report.rows.map((row) => row.id)).toEqual(["new", "old"]);
    expect(input[0].id).toBe("old");
  });

  it("counts actions, tables, and actors", () => {
    const report = buildAuditReport(
      [
        entry({ action: "insert" }),
        entry({ id: "a2", action: "update" }),
        entry({ id: "a3", action: "delete", table: "parts" }),
        entry({ id: "a4", action: "update", actor: null }),
      ],
      { total: 4 },
      period,
    );

    expect(report.totals).toEqual({
      events: 4,
      inserts: 1,
      updates: 2,
      deletes: 1,
      tables: 2,
      actors: 2,
    });
    expect(report.byAction).toEqual([
      { action: "insert", count: 1 },
      { action: "update", count: 2 },
      { action: "delete", count: 1 },
    ]);
    expect(report.byTable).toEqual([
      { table: "jobs", insert: 1, update: 2, delete: 0, total: 3 },
      { table: "parts", insert: 0, update: 0, delete: 1, total: 1 },
    ]);
    expect(report.byActor).toEqual([
      { name: "Website Admin", role: "Admin", count: 3 },
      { name: "Unattributed", role: "", count: 1 },
    ]);
  });

  it("flags truncation and keeps the reported total", () => {
    const report = buildAuditReport([entry()], { total: 6000, truncated: true }, period);

    expect(report.truncated).toBe(true);
    expect(report.total).toBe(6000);
    expect(report.totals.events).toBe(1);
  });

  it("handles an empty period", () => {
    const report = buildAuditReport([], { total: 0 }, period);

    expect(report.rows).toEqual([]);
    expect(report.byTable).toEqual([]);
    expect(report.byActor).toEqual([]);
    expect(report.totals.events).toBe(0);
  });
});
