import { getJobStage } from "./jobStage.js";
import { isWithinPeriod } from "./reportPeriods.js";

const OPEN_STAGES = new Set(["Draft", "Pending", "Scheduled", "In progress"]);
const CLOSED_STAGES = new Set(["Completed", "Billed", "Paid"]);
const STAGE_ORDER = [
  "Draft",
  "Pending",
  "Scheduled",
  "In progress",
  "Completed",
  "Billed",
  "Paid",
];

const byCountThenName = (left, right) =>
  left.count === right.count
    ? left.name.localeCompare(right.name)
    : right.count - left.count;

// Schedule rows for a printable period report. Rows carry the same workflow
// stage the board shows, so paid/billed work is included but clearly labelled.
export function buildScheduleReport(schedules, period) {
  const rows = (schedules ?? [])
    .filter((job) => isWithinPeriod(job.date, period))
    .map((job) => ({
      ...job,
      stage: getJobStage({
        status: job.status,
        partsStatus: job.partsStatus,
        assignmentConfirmed: Boolean(job.assignmentConfirmedAt),
        invoiceStatus: job.invoice?.status ?? null,
      }),
    }))
    .sort((left, right) => {
      const leftKey = `${left.date} ${left.time}`;
      const rightKey = `${right.date} ${right.time}`;
      if (leftKey !== rightKey) return leftKey < rightKey ? -1 : 1;
      return String(left.order ?? "").localeCompare(String(right.order ?? ""));
    });

  const stageCounts = new Map();
  const stageStyles = new Map();
  const technicianCounts = new Map();
  const branchCounts = new Map();

  rows.forEach((job) => {
    const stage = job.stage.label;
    stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
    if (!stageStyles.has(stage)) stageStyles.set(stage, job.stage.style);

    const names = job.technicians?.length
      ? job.technicians.map((technician) => technician.name)
      : [job.technician || "Unassigned"];
    names.forEach((name) => {
      technicianCounts.set(name, (technicianCounts.get(name) ?? 0) + 1);
    });

    const branch = job.branch
      ? String(job.branch).replace(/^./, (letter) => letter.toUpperCase())
      : "—";
    branchCounts.set(branch, (branchCounts.get(branch) ?? 0) + 1);
  });

  const byStage = STAGE_ORDER.filter((stage) => stageCounts.has(stage))
    .concat([...stageCounts.keys()].filter((stage) => !STAGE_ORDER.includes(stage)))
    .map((stage) => ({
      stage,
      count: stageCounts.get(stage),
      style: stageStyles.get(stage),
    }));

  const byTechnician = [...technicianCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort(byCountThenName);

  const byBranch = [...branchCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    period,
    rows,
    byStage,
    byTechnician,
    byBranch,
    totals: {
      jobs: rows.length,
      drafts: rows.filter((job) => job.isDraft).length,
      confirmed: rows.filter((job) => !job.isDraft).length,
      open: rows.filter((job) => OPEN_STAGES.has(job.stage.label)).length,
      closed: rows.filter((job) => CLOSED_STAGES.has(job.stage.label)).length,
    },
  };
}
