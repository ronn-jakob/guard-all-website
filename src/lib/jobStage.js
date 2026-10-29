// Workflow stage for a scheduled job, shared by the Scheduling board and the
// printable schedule report. Kept in lib so reports do not import a feature.

export const STAGE_STYLES = {
  done: "border-[#a8dfb7] bg-[#effaf2] text-[#267340]",
  ready: "border-[#a8dfb7] bg-[#effaf2] text-[#267340]",
  active: "border-[#bcd3ee] bg-[#eef4ff] text-[#1250a0]",
  waiting: "border-[#ffd9a3] bg-[#fff7e8] text-[#a86a12]",
  todo: "border-[#ffc9b8] bg-[#fff3ef] text-[#d0552f]",
};

// Stock is reserved (or not needed), so the job has reached the scheduled stage.
export function isStockAllocated(partsStatus) {
  return partsStatus === "confirmed" || partsStatus === "not_required";
}

// Workflow stage shown on the badge:
//   Paid                 -> the job's invoice is settled, so the board is done with it
//   Billed               -> an invoice is issued and still being collected
//   Waiting confirmation -> assignment not confirmed yet
//   Pending              -> confirmed, queued for stock allocation
//   Scheduled            -> stock allocated (parts_status = confirmed)
// The jobs table's own status is never advanced after insert, so invoicing is the
// only signal that a job is finished.
export function getJobStage({
  status,
  partsStatus,
  assignmentConfirmed,
  invoiceStatus,
}) {
  if (invoiceStatus === "paid") {
    return { label: "Paid", style: STAGE_STYLES.done };
  }
  if (invoiceStatus) {
    return { label: "Billed", style: STAGE_STYLES.active };
  }
  if (status === "completed") {
    return { label: "Completed", style: STAGE_STYLES.done };
  }
  if (status === "in_progress") {
    return { label: "In progress", style: STAGE_STYLES.active };
  }
  if (isStockAllocated(partsStatus)) {
    return { label: "Scheduled", style: STAGE_STYLES.ready };
  }
  if (assignmentConfirmed) {
    return { label: "Pending", style: STAGE_STYLES.waiting };
  }
  return { label: "Draft", style: STAGE_STYLES.todo };
}
