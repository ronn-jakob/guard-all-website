// Queue filters for the Incoming Reports list.
export const queueFilters = [
  { value: "all", label: "All open" },
  { value: "submitted", label: "Submitted" },
  { value: "awaiting", label: "Awaiting report" },
  { value: "billed", label: "Billed" },
];

// An invoiced report is finished work: it only appears under "Billed", so the
// open queue stays the reviewer's to-do list.
export function matchesQueueFilter(report, filter) {
  const isInvoiced = Boolean(report.invoice);
  if (filter === "billed") return isInvoiced;
  if (isInvoiced) return false;
  if (filter === "submitted") return !report.isPendingReport;
  if (filter === "awaiting") return Boolean(report.isPendingReport);
  return true;
}

export function filterReportsByQueue(reports, filter) {
  return reports.filter((report) => matchesQueueFilter(report, filter));
}

export function queueFilterLabelFor(filter) {
  return queueFilters.find((option) => option.value === filter)?.label ?? "All open";
}

// Submitted reports are grouped by job so a multi-technician job reads as one
// collection. Pending-report rows are already job-level and stand alone.
export function buildQueueRows(reports, filteredQueue) {
  const reportsPerJob = new Map();
  reports.forEach((report) => {
    if (!report.jobId || report.isPendingReport) return;
    reportsPerJob.set(report.jobId, (reportsPerJob.get(report.jobId) ?? 0) + 1);
  });

  const queueRows = [];
  const announcedJobs = new Set();
  filteredQueue.forEach((report) => {
    const groupSize = report.jobId ? (reportsPerJob.get(report.jobId) ?? 0) : 0;
    if (groupSize > 1 && !announcedJobs.has(report.jobId)) {
      announcedJobs.add(report.jobId);
      queueRows.push({
        type: "header",
        key: `header-${report.jobId}`,
        jobNumber: report.jobNumber || "Job",
        reported: groupSize,
        assigned: Math.max(report.jobTechnicianCount || 0, groupSize),
      });
    }
    queueRows.push({ type: "report", key: report.id, report });
  });
  return queueRows;
}
