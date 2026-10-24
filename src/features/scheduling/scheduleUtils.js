export function formatDateRange(startDate, endDate) {
  const startMonth = startDate.toLocaleString("en-US", { month: "long" });
  const endMonth = endDate.toLocaleString("en-US", { month: "long" });

  if (
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getFullYear() === endDate.getFullYear()
  ) {
    return `${startDate.getDate()}-${endDate.getDate()} ${startMonth} ${startDate.getFullYear()}`;
  }

  return `${startDate.getDate()} ${startMonth} - ${endDate.getDate()} ${endMonth} ${endDate.getFullYear()}`;
}

export function formatMonthLabel(date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getToday() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

export function formatSelectedDate(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Sunday-first, matching the Calendar view's column order.
export const DAY_LABELS = ["S", "M", "T", "W", "TH", "F", "ST"];

// Row shape shared by the schedule list and the selected-job panel.
// Index order is load-bearing and must stay in sync with mapScheduleRow:
// 0 time, 1 day, 2 client, 3 order, 4 service, 5 location, 6 technician,
// 7 stock, 8 technicians, 9 status, 10 branch, 11 date,
// 12 partsStatus, 13 assignmentConfirmedAt, 14 invoice.
export function mapScheduleRow(job) {
  return [
    job.time,
    job.dayLabel,
    job.client,
    job.order,
    job.service,
    job.location,
    job.technician,
    job.stock,
    job.technicians,
    job.status,
    job.branch,
    job.date,
    job.partsStatus,
    job.assignmentConfirmedAt,
    job.invoice ?? null,
  ];
}

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

export function formatShortDate(dateValue) {
  const [year, month, day] = String(dateValue ?? "").split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day)
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}

export function capitalizeFirst(value) {
  return String(value ?? "").replace(/^./, (letter) => letter.toUpperCase());
}

// Invoice statuses arrive already derived by the backend: pending | overdue | paid.
export function invoiceStatusLabel(status) {
  if (status === "paid") return "Paid";
  if (status === "overdue") return "Overdue";
  if (status === "pending") return "Pending";
  return "—";
}

export function formatLongDate(dateValue) {
  const [year, month, day] = String(dateValue ?? "").split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
