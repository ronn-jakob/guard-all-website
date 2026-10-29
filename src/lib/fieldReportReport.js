import { isWithinPeriod } from "./reportPeriods.js";

const STATUS_ORDER = [
  "Submitted",
  "Ready for Billing",
  "Needs Review",
  "Billed",
  "Paid",
];

const byCountThenName = (left, right) =>
  left.count === right.count
    ? left.name.localeCompare(right.name)
    : right.count - left.count;

// Filed field reports for a period, by service date. Jobs still owing a report
// arrive in the same payload but carry no service date, so they are counted
// separately and never mixed into the period figures.
export function buildFieldReportReport(reports, period) {
  const all = reports ?? [];
  const awaitingCount = all.filter((report) => report.isPendingReport).length;

  const rows = all
    .filter(
      (report) =>
        !report.isPendingReport && isWithinPeriod(report.serviceDate, period),
    )
    .sort((left, right) => {
      const leftKey = `${left.serviceDate} ${left.id}`;
      const rightKey = `${right.serviceDate} ${right.id}`;
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });

  const statusCounts = new Map();
  const technicianCounts = new Map();
  let partsLines = 0;
  let partsUnits = 0;
  let signed = 0;

  rows.forEach((report) => {
    const status = report.status || "Submitted";
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);

    const name = report.technician || "Unassigned";
    technicianCounts.set(name, (technicianCounts.get(name) ?? 0) + 1);

    const parts = Array.isArray(report.parts) ? report.parts : [];
    partsLines += parts.length;
    partsUnits += parts.reduce(
      (total, part) => total + (Number(part.quantity) || 0),
      0,
    );

    if (report.clientSignoff) signed += 1;
  });

  const byStatus = STATUS_ORDER.filter((status) => statusCounts.has(status))
    .concat([...statusCounts.keys()].filter((status) => !STATUS_ORDER.includes(status)))
    .map((status) => ({ status, count: statusCounts.get(status) }));

  const byTechnician = [...technicianCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort(byCountThenName);

  return {
    period,
    rows,
    byStatus,
    byTechnician,
    awaitingCount,
    totals: {
      reports: rows.length,
      readyForBilling: statusCounts.get("Ready for Billing") ?? 0,
      needsReview: statusCounts.get("Needs Review") ?? 0,
      submitted: statusCounts.get("Submitted") ?? 0,
      billed:
        (statusCounts.get("Billed") ?? 0) + (statusCounts.get("Paid") ?? 0),
      partsLines,
      partsUnits,
      signed,
    },
  };
}
