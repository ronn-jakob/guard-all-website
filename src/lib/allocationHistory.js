// The allocation history is grouped by work order, so the list is filtered on the
// things someone actually knows when looking for a job: its number, the client, or
// a part on it.
export function filterAllocationJobs(jobs, { query = "", outcome = "All" } = {}) {
  const text = String(query ?? "").trim().toLowerCase();
  return (jobs ?? []).filter((job) => {
    // "Closed" is a group: every finished outcome, whatever its detail.
    const matchesOutcome =
      outcome === "All" ||
      (outcome === "In progress"
        ? job.outcome === "In progress"
        : job.outcome !== "In progress");
    if (!matchesOutcome) return false;
    if (!text) return true;
    const haystack = [
      job.jobNumber,
      job.clientName,
      ...(job.lines ?? []).flatMap((line) => [line.sku, line.name]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(text);
  });
}

export function formatPartsSummary(summary) {
  if (!summary || !summary.partLines) return "No parts";
  const parts = [
    `${summary.partLines} ${summary.partLines === 1 ? "line" : "lines"}`,
    `${summary.totalReserved} reserved`,
    `${summary.totalUsed} used`,
  ];
  if (summary.totalReturned > 0) {
    parts.push(`${summary.totalReturned} returned`);
  }
  return parts.join(" · ");
}

export function formatAllocationDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
