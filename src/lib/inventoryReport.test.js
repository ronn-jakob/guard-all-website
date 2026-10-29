import { describe, expect, it } from "vitest";
import { buildInventoryReport, movementRange } from "./inventoryReport.js";
import { resolvePeriod } from "./reportPeriods.js";

const period = resolvePeriod("month", "2026-10");

const stockItem = (overrides = {}) => ({
  branch: "makati",
  quantity_on_hand: 10,
  parts: {
    sku: "CCTV-001",
    name: "Dome Camera",
    category: "CCTV",
    unit_cost: 100,
    reorder_threshold: 5,
    ...overrides.parts,
  },
  ...overrides,
});

const movement = (overrides = {}) => ({
  id: "m1",
  date: "2026-10-05T02:00:00.000Z",
  partId: "p1",
  sku: "CCTV-001",
  name: "Dome Camera",
  category: "CCTV",
  branch: "Makati",
  direction: "in",
  quantity: 5,
  reason: "restock",
  jobNumber: "",
  performedBy: "Website Admin",
  ...overrides,
});

describe("movementRange", () => {
  it("covers the local start of the first day to the next day after the last", () => {
    const { from, to } = movementRange(period);
    const start = new Date(from);
    const end = new Date(to);

    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([2026, 9, 1]);
    expect([start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([0, 0, 0]);
    expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([2026, 10, 1]);
    expect(new Date(from).getTime()).toBeLessThan(new Date(to).getTime());
  });
});

describe("buildInventoryReport", () => {
  it("totals the snapshot and the period's movements", () => {
    const report = buildInventoryReport(
      {
        movements: [
          movement({ quantity: 5, direction: "in" }),
          movement({ id: "m2", quantity: 2, direction: "out", reason: "job_usage" }),
        ],
        stockItems: [
          stockItem({ quantity_on_hand: 10 }),
          stockItem({ branch: "cebu", quantity_on_hand: 4, parts: { sku: "ACC-1", name: "Bracket", category: "Access", unit_cost: 50, reorder_threshold: 5 } }),
        ],
      },
      period,
    );

    expect(report.totals).toEqual({
      items: 2,
      unitsOnHand: 14,
      valueOnHand: 1200,
      lowStock: 1,
      movements: 2,
      inQty: 5,
      outQty: 2,
      netQty: 3,
    });
    expect(report.lowStockRows.map((row) => row.sku)).toEqual(["ACC-1"]);
  });

  it("counts low stock at the threshold", () => {
    const report = buildInventoryReport(
      {
        stockItems: [
          stockItem({ quantity_on_hand: 5, parts: { reorder_threshold: 5 } }),
          stockItem({ quantity_on_hand: 6, parts: { reorder_threshold: 5 } }),
        ],
      },
      period,
    );

    expect(report.totals.lowStock).toBe(1);
  });

  it("groups movements by reason with labels and volumes", () => {
    const report = buildInventoryReport(
      {
        movements: [
          movement({ quantity: 4, direction: "in", reason: "restock" }),
          movement({ quantity: 1, direction: "out", reason: "job_usage" }),
          movement({ quantity: 2, direction: "out", reason: "adjustment" }),
        ],
      },
      period,
    );

    expect(
      report.byReason.filter((row) => row.count > 0).map((row) => ({
        reason: row.reason,
        label: row.label,
        count: row.count,
        inQty: row.inQty,
        outQty: row.outQty,
      })),
    ).toEqual([
      { reason: "restock", label: "Restock", count: 1, inQty: 4, outQty: 0 },
      { reason: "job_usage", label: "Job usage", count: 1, inQty: 0, outQty: 1 },
      { reason: "adjustment", label: "Adjustment", count: 1, inQty: 0, outQty: 2 },
    ]);
  });

  it("combines category value with movement totals", () => {
    const report = buildInventoryReport(
      {
        movements: [movement({ quantity: 3, direction: "in" })],
        stockItems: [stockItem({ quantity_on_hand: 2 })],
      },
      period,
    );

    expect(report.byCategory).toEqual([
      { category: "CCTV", inQty: 3, outQty: 0, value: 200 },
    ]);
  });

  it("rolls up branches from both stock and movements", () => {
    const report = buildInventoryReport(
      {
        movements: [movement({ quantity: 3, direction: "out", reason: "job_usage" })],
        stockItems: [stockItem()],
      },
      period,
    );

    expect(report.byBranch).toEqual([
      { branch: "Makati", unitsOnHand: 10, value: 1000, movements: 1, inQty: 0, outQty: 3 },
    ]);
  });

  it("passes the truncation flag through", () => {
    const report = buildInventoryReport({ truncated: true }, period);
    expect(report.truncated).toBe(true);
    expect(report.totals.movements).toBe(0);
  });
});
