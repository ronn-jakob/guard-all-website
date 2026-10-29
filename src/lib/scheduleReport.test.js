import { describe, expect, it } from "vitest";
import { buildScheduleReport } from "./scheduleReport.js";
import { resolvePeriod } from "./reportPeriods.js";

const period = resolvePeriod("month", "2026-10");

const job = (overrides = {}) => ({
  order: "WO-00001",
  date: "2026-10-05",
  time: "09:00",
  status: "scheduled",
  partsStatus: "pending",
  assignmentConfirmedAt: null,
  isDraft: true,
  branch: "makati",
  technician: "Unassigned",
  technicians: [],
  invoice: null,
  client: "Acme",
  service: "Installation",
  ...overrides,
});

describe("buildScheduleReport", () => {
  it("keeps jobs inside the period, sorted by date and time", () => {
    const report = buildScheduleReport(
      [
        job({ order: "WO-00003", date: "2026-10-20", time: "08:00" }),
        job({ order: "WO-00001", date: "2026-10-05", time: "13:00" }),
        job({ order: "WO-00002", date: "2026-10-05", time: "09:00" }),
        job({ order: "WO-00009", date: "2026-09-30" }),
      ],
      period,
    );

    expect(report.rows.map((row) => row.order)).toEqual([
      "WO-00002",
      "WO-00001",
      "WO-00003",
    ]);
  });

  it("labels each row with the board's workflow stage", () => {
    const report = buildScheduleReport(
      [
        job({ order: "PAID", invoice: { status: "paid", number: "INV-1" } }),
        job({ order: "BILLED", invoice: { status: "pending", number: "INV-2" } }),
        job({ order: "DRAFT" }),
        job({
          order: "PENDING",
          assignmentConfirmedAt: "2026-10-01T08:00:00Z",
          isDraft: false,
        }),
        job({ order: "SCHEDULED", partsStatus: "confirmed", isDraft: false }),
        job({ order: "INPROGRESS", status: "in_progress", isDraft: false }),
      ],
      period,
    );

    const stages = Object.fromEntries(
      report.rows.map((row) => [row.order, row.stage.label]),
    );
    expect(stages).toEqual({
      PAID: "Paid",
      BILLED: "Billed",
      DRAFT: "Draft",
      PENDING: "Pending",
      SCHEDULED: "Scheduled",
      INPROGRESS: "In progress",
    });
  });

  it("splits open and closed work and counts drafts", () => {
    const report = buildScheduleReport(
      [
        job({ isDraft: true }),
        job({ order: "WO-2", partsStatus: "confirmed", isDraft: false }),
        job({ order: "WO-3", invoice: { status: "paid", number: "INV-1" }, isDraft: false }),
        job({ order: "WO-4", invoice: { status: "pending", number: "INV-2" }, isDraft: false }),
      ],
      period,
    );

    expect(report.totals).toEqual({
      jobs: 4,
      drafts: 1,
      confirmed: 3,
      open: 2,
      closed: 2,
    });
  });

  it("counts a job once per assigned technician", () => {
    const report = buildScheduleReport(
      [
        job({
          technicians: [{ id: "t1", name: "Albert" }, { id: "t2", name: "Boy" }],
        }),
        job({ order: "WO-2", technicians: [{ id: "t1", name: "Albert" }] }),
      ],
      period,
    );

    expect(report.byTechnician).toEqual([
      { name: "Albert", count: 2 },
      { name: "Boy", count: 1 },
    ]);
  });

  it("tallies branches with capitalised labels", () => {
    const report = buildScheduleReport(
      [job({ branch: "makati" }), job({ order: "WO-2", branch: "cebu" })],
      period,
    );

    expect(report.byBranch).toEqual([
      { name: "Cebu", count: 1 },
      { name: "Makati", count: 1 },
    ]);
  });

  it("returns an empty report for a quiet period", () => {
    const report = buildScheduleReport([job({ date: "2026-09-01" })], period);

    expect(report.rows).toEqual([]);
    expect(report.byStage).toEqual([]);
    expect(report.totals.jobs).toBe(0);
  });
});
