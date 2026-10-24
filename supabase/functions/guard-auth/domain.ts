// Domain vocabulary shared by the dispatcher and the extracted handlers. These
// are pure mappings; keeping them here prevents a handler from importing index.ts.

export function jobTypeFor(serviceType: string) {
  if (serviceType === "Installation") return "installation";
  if (serviceType === "Preventive maintenance") return "maintenance";
  if (serviceType === "Inspection") return "inspection";
  return "repair";
}

// Single source of truth for presenting job_type. Previously this ternary was
// duplicated at every call site, so a new job type could be added to the enum
// and the write path while the read paths silently reported "Service call".
export function serviceLabelFor(jobType: unknown) {
  if (jobType === "installation") return "Installation";
  if (jobType === "maintenance") return "Preventive maintenance";
  if (jobType === "inspection") return "Inspection";
  return "Service call";
}
