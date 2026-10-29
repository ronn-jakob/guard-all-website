// Aggregates job templates for the printable price list. The list already
// carries client-facing line prices; markup and base prices stay out of the
// report so a printed or emailed PDF never exposes the margin.

const capitalise = (value) =>
  String(value ?? "").replace(/^./, (letter) => letter.toUpperCase());

export function buildTemplatesReport(templates) {
  const rows = [...(templates ?? [])]
    .sort((left, right) => String(left.name ?? "").localeCompare(String(right.name ?? "")))
    .map((template) => ({
      ...template,
      lineCount: Array.isArray(template.items) ? template.items.length : 0,
      clientTotal: Number(template.total) || 0,
      jobTypeLabel: template.jobType ? capitalise(template.jobType) : "—",
      branchLabel: template.branch ? capitalise(template.branch) : "All branches",
    }));

  const jobTypes = new Map();
  rows.forEach((template) => {
    const key = template.jobTypeLabel;
    jobTypes.set(key, (jobTypes.get(key) ?? 0) + 1);
  });

  const byJobType = [...jobTypes.entries()]
    .map(([jobType, count]) => ({ jobType, count }))
    .sort((left, right) => right.count - left.count || left.jobType.localeCompare(right.jobType));

  return {
    rows,
    byJobType,
    totals: {
      templates: rows.length,
      active: rows.filter((template) => template.isActive).length,
      shared: rows.filter((template) => !template.branch).length,
      lines: rows.reduce((total, template) => total + template.lineCount, 0),
    },
  };
}
