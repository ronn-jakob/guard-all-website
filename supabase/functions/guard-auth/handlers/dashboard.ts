import { branchScope } from "../auth.ts";
import { serviceLabelFor } from "../domain.ts";
import { response } from "../shared.ts";
import { findCurrentTechnicianId } from "./reports.ts";
import { listPendingJobRequests } from "./scheduling.ts";
export async function handleDashboardSummary({ session, db }: { session: any; db: any }) {
  const first = (value: any) => (Array.isArray(value) ? value[0] : value);
  const role = String(session.role ?? "");
  const technicianRoles = new Set(["Technician", "Service Manager", "Sales Manager"]);
  const isTechnicianView = technicianRoles.has(role);
  const myTechnicianId = isTechnicianView ? await findCurrentTechnicianId(session) : "";
  const today = new Date().toISOString().slice(0, 10);
  // Non-admins are pinned to their branch. A Technician is the exception:
  // they may be assigned to a job in the other branch and still need to see it.
  const scope = branchScope(session);
  const jobScope = role === "Technician" ? null : scope;

  let jobQuery = db
    .from("jobs")
    .select("job_id, job_number, job_type, branch, status, parts_status, scheduled_date, scheduled_time, clients(name, address), job_technicians(technician_id, is_active, technicians(users(first_name, last_name)))")
    .neq("status", "cancelled")
    .gte("scheduled_date", today);
  if (jobScope !== null) jobQuery = jobQuery.eq("branch", jobScope);
  const { data: jobRows, error: jobsError } = await jobQuery
    .order("scheduled_date")
    .order("scheduled_time")
    .limit(60);
  if (jobsError) throw jobsError;

  const activeAssignments = (job: any) =>
    (Array.isArray(job.job_technicians) ? job.job_technicians : []).filter(
      (assignment: any) => assignment.is_active,
    );
  // A technician only ever sees their own work; everyone else sees the board.
  // Drafts are not committed bookings yet: they get their own counter and never
  // reach the board or the "jobs today" figure.
  const isDraftJob = (job: any) =>
    !job.assignment_confirmed_at && job.parts_status === "pending";
  const scopedJobs = (
    isTechnicianView && myTechnicianId
      ? (jobRows ?? []).filter((job: any) =>
          activeAssignments(job).some(
            (assignment: any) => assignment.technician_id === myTechnicianId,
          ),
        )
      : (jobRows ?? [])
  ).filter((job: any) => !isDraftJob(job));

  const nameOfAssignment = (assignment: any) => {
    const technician = first(assignment.technicians);
    const user = technician ? first(technician.users) : null;
    return user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "";
  };

  const jobs = scopedJobs.slice(0, 5).map((job: any) => {
    const client = first(job.clients);
    const names = activeAssignments(job).map(nameOfAssignment).filter(Boolean);
    return {
      jobNumber: job.job_number,
      time: String(job.scheduled_time ?? "").slice(0, 5),
      scheduledDate: String(job.scheduled_date),
      serviceLabel: serviceLabelFor(job.job_type),
      clientName: client?.name ?? "Unnamed client",
      siteAddress:
        client?.address ??
        `${String(job.branch).replace(/^./, (letter) => letter.toUpperCase())} branch`,
      technicianNames: names,
      technicianName: names[0] ?? "Unassigned",
      additionalTechnicianCount: Math.max(0, names.length - 1),
      technicianInitials: names.length
        ? names[0]
            .split(/\s+/)
            .map((part: string) => part[0])
            .slice(0, 2)
            .join("")
        : "—",
      partsStatus: job.parts_status,
    };
  });

  const pendingRequests = await listPendingJobRequests(scope);

  let reviewQuery = db
    .from("field_reports")
    .select("report_id, jobs!field_reports_job_id_fkey!inner(branch)", { count: "exact", head: true })
    .eq("review_status", "submitted");
  if (jobScope !== null) reviewQuery = reviewQuery.eq("jobs.branch", jobScope);
  const { count: reportsAwaitingReview, error: reportCountError } = await reviewQuery;
  if (reportCountError) throw reportCountError;

  let stockQuery = db
    .from("stock")
    .select("quantity_on_hand, parts!inner(reorder_threshold)")
    .eq("parts.is_active", true);
  if (scope !== null) stockQuery = stockQuery.eq("branch", scope);
  const { data: stockRows, error: stockError } = await stockQuery;
  if (stockError) throw stockError;
  const lowStock = (stockRows ?? []).filter((row: any) => {
    const threshold = Number(first(row.parts)?.reorder_threshold ?? 0);
    return Number(row.quantity_on_hand) <= threshold;
  }).length;

  // Financial figures are limited to Admin, Service Manager and Billing Staff.
  let openInvoices: { count: number; amount: number } | null = null;
  if (["Admin", "Service Manager", "Billing Staff"].includes(role)) {
    let invoiceQuery = db
      .from("invoices")
      .select("invoice_id, total_amount, status, payments(amount), jobs!invoices_job_id_fkey!inner(branch)")
      .neq("status", "cancelled");
    if (scope !== null) invoiceQuery = invoiceQuery.eq("jobs.branch", scope);
    const { data: invoiceRows, error: invoiceError } = await invoiceQuery;
    if (invoiceError) throw invoiceError;
    let amount = 0;
    let count = 0;
    (invoiceRows ?? []).forEach((invoice: any) => {
      const total = Number(invoice.total_amount) || 0;
      const paid = (Array.isArray(invoice.payments) ? invoice.payments : []).reduce(
        (sum: number, payment: any) => sum + (Number(payment.amount) || 0),
        0,
      );
      const balance = total - paid;
      if (balance > 0) {
        count += 1;
        amount += balance;
      }
    });
    openInvoices = { count, amount: Math.round(amount * 100) / 100 };
  }

  // Drafts are only actionable for the roles that create and confirm them.
  let draftJobs: number | null = null;
  if (["Admin", "Service Manager"].includes(role)) {
    let draftQuery = db
      .from("jobs")
      .select("job_id", { count: "exact", head: true })
      .is("assignment_confirmed_at", null)
      .eq("parts_status", "pending")
      .neq("status", "cancelled");
    if (jobScope !== null) draftQuery = draftQuery.eq("branch", jobScope);
    const { count: draftCount, error: draftError } = await draftQuery;
    if (draftError) throw draftError;
    draftJobs = draftCount ?? 0;
  }

  return response({
    jobs,
    counts: {
      todayJobs: scopedJobs.filter((job: any) => String(job.scheduled_date) === today).length,
      upcomingJobs: scopedJobs.length,
      pendingAllocation: pendingRequests.length,
      reportsAwaitingReview: reportsAwaitingReview ?? 0,
      lowStock,
      openInvoices,
      draftJobs,
    },
  });
}
