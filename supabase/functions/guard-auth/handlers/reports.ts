import { response, supabaseAdmin } from "../shared.ts";
import { branchScope } from "../auth.ts";
import { invoiceStatusFor, serviceLabelFor } from "../domain.ts";
import { getCurrentTechnicianId } from "./scheduling.ts";
import {
  ATTACHMENT_BUCKET,
  ATTACHMENT_CONTENT_TYPES,
  ATTACHMENT_PATH_PATTERN,
  MAX_ATTACHMENT_BYTES,
  MAX_REPORT_ATTACHMENTS,
  attachmentExtension,
} from "../config.ts";
// Distinct technicians that have at least one submitted report, for the manager filter.
export async function listReportTechnicians() {
  const { data, error } = await supabaseAdmin
    .from("field_reports")
    .select("technician_id, technicians!inner(technician_id, users(first_name, last_name))")
    .in("review_status", ["submitted", "approved", "returned"]);
  if (error) throw error;

  const byId = new Map<string, string>();
  (data ?? []).forEach((row: any) => {
    if (!row.technician_id || byId.has(row.technician_id)) return;
    const technician = Array.isArray(row.technicians) ? row.technicians[0] : row.technicians;
    const user = technician && (Array.isArray(technician.users) ? technician.users[0] : technician.users);
    byId.set(row.technician_id, user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "Unknown technician");
  });
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function listFieldReports(session: Record<string, unknown>, requestedTechnicianId = "") {
  const isManager = ["Admin", "Service Manager", "Sales Manager"].includes(String(session.role ?? ""));

  // A technician may only ever see their own reports, whatever they ask for.
  // A manager sees everything, optionally narrowed to a single technician.
  const scopedTechnicianId = isManager
    ? String(requestedTechnicianId).trim()
    : String(await getCurrentTechnicianId(session));

  let reportsQuery = supabaseAdmin
    .from("field_reports")
    .select(`
      report_id,
      report_number,
      job_id,
      technician_id,
      work_performed,
      service_date,
      time_arrival,
      site_address,
      client_signoff,
      client_signoff_name,
      submitted_at,
      review_status,
      additional_notes,
      issue_description,
      recommendations,
      filed_by_user_id,
      report_parts_used(quantity, parts(sku, name)),
      report_attachments(file_type, file_url),
      jobs!inner(job_id, job_number, job_type, branch, clients(name, address), job_technicians(technician_id, is_active)),
      technicians!inner(technician_id, user_id, users(first_name, last_name)),
      filed_by:users!field_reports_filed_by_user_id_fkey(first_name, last_name)
    `)
    .in("review_status", ["submitted", "approved", "returned"]);
  // Managers review their own branch; a technician's own report list stays
  // assignment-based so cross-branch jobs can still be reported.
  const managerBranch = isManager ? branchScope(session) : null;
  if (managerBranch !== null) {
    reportsQuery = reportsQuery.eq("jobs.branch", managerBranch);
  }
  if (scopedTechnicianId) {
    reportsQuery = reportsQuery.eq("technician_id", scopedTechnicianId);
  }
  const { data: reports, error } = await reportsQuery.order("submitted_at", { ascending: false });

  if (error) throw error;

  // Billing closes a report out of the review queue. The invoice references one
  // report, but a job can hold several technician reports, so the state is
  // resolved per job: every sibling report on an invoiced job reads as billed.
  const reportedJobIds = new Set((reports ?? []).map((report: any) => report.job_id));
  const invoiceJobIds = Array.from(reportedJobIds).filter(Boolean) as string[];
  const invoiceByJobId = new Map<string, any>();
  if (invoiceJobIds.length) {
    const { data: jobInvoices, error: jobInvoicesError } = await supabaseAdmin
      .from("invoices")
      .select("job_id, invoice_number, status, due_date, total_amount, created_at")
      .in("job_id", invoiceJobIds)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true });
    if (jobInvoicesError) throw jobInvoicesError;
    (jobInvoices ?? []).forEach((invoice: any) => {
      if (!invoiceByJobId.has(invoice.job_id)) invoiceByJobId.set(invoice.job_id, invoice);
    });
  }

  const { data: reservedJobs, error: reservedJobsError } = await supabaseAdmin
    .from("jobs")
    .select("job_id, job_number, job_type, branch, scheduled_date, scheduled_time, parts_confirmed_at, clients(name, address), job_parts!inner(job_part_id, quantity, status, reserved_at, parts(sku, name)), job_technicians(technician_id, is_active, technicians(users(first_name, last_name)))")
    .eq("parts_status", "confirmed")
    .eq("job_parts.status", "reserved")
    .neq("status", "cancelled")
    .order("parts_confirmed_at", { ascending: false });
  if (reservedJobsError) throw reservedJobsError;

  const pendingReportItems = (reservedJobs ?? [])
    .filter((job: any) => !reportedJobIds.has(job.job_id))
    .filter((job: any) => {
      if (!scopedTechnicianId) return true;
      const assignments = Array.isArray(job.job_technicians)
        ? job.job_technicians
        : job.job_technicians
          ? [job.job_technicians]
          : [];
      return assignments.some(
        (assignment: any) => assignment.technician_id === scopedTechnicianId,
      );
    })
    .map((job: any) => {
      const client = Array.isArray(job.clients) ? job.clients[0] : job.clients;
      const assignments = Array.isArray(job.job_technicians)
        ? job.job_technicians
        : job.job_technicians
          ? [job.job_technicians]
          : [];
      const technicianNames = assignments
        .filter((assignment: any) => assignment.is_active)
        .map((assignment: any) => {
          const technician = Array.isArray(assignment.technicians)
            ? assignment.technicians[0]
            : assignment.technicians;
          const user = technician && (Array.isArray(technician.users)
            ? technician.users[0]
            : technician.users);
          return user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "";
        })
        .filter(Boolean);
      const reservedParts = (job.job_parts ?? [])
        .filter((reservation: any) => reservation.status === "reserved")
        .map((reservation: any) => {
          const part = Array.isArray(reservation.parts) ? reservation.parts[0] : reservation.parts;
          return {
            sku: part?.sku ?? "",
            description: part?.name ?? "Reserved part",
            quantity: reservation.quantity,
            note: "Reserved",
          };
        });
      const reservedAt = job.job_parts?.[0]?.reserved_at ?? job.parts_confirmed_at ?? null;
      const displayTime = reservedAt
        ? new Date(reservedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
        : `${job.scheduled_date} ${String(job.scheduled_time ?? "").slice(0, 5)}`;

      return {
        id: `job:${job.job_number || job.job_id}`,
        client: client?.name ?? "Unknown client",
        service: serviceLabelFor(job.job_type),
        technician: technicianNames.join(", ") || "Unassigned",
        time: displayTime,
        status: "Awaiting Report",
        tone: "yellow",
        isPendingReport: true,
        workSummary: "Stock has been reserved. The assigned technician has not submitted a field report yet.",
        parts: reservedParts,
        images: [],
        signature: {
          signer: "Not provided",
          signedAt: "Pending report",
          method: "Awaiting technician report",
        },
        billing: {
          readiness: "Awaiting field report",
          inventory: "Reserved",
          reference: job.job_number || "Not assigned",
        },
        audit: [
          { time: displayTime, action: "Stock reserved for job", actor: "Inventory" },
        ],
        jobId: job.job_id,
        siteAddress: client?.address ?? `${String(job.branch).replace(/^./, (letter: string) => letter.toUpperCase())} branch`,
        issueDescription: "",
        recommendations: "",
        additionalNotes: "",
        submittedAt: null,
        reservedAt,
      };
    });

  // Attachments are stored as object paths and signed on read; legacy base64 rows
  // are passed through untouched so reports filed before the bucket keep rendering.
  const attachmentPaths = Array.from(
    new Set(
      (reports ?? []).flatMap((report: any) =>
        (report.report_attachments ?? [])
          .map((attachment: any) => String(attachment?.file_url ?? ""))
          .filter((url: string) => url && !url.startsWith("data:")),
      ),
    ),
  );
  const signedAttachmentUrls = new Map<string, string>();
  if (attachmentPaths.length) {
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrls(attachmentPaths, 3600);
    if (signError) {
      console.error("Could not sign report attachments:", signError.message);
    } else {
      (signed ?? []).forEach((entry: any) => {
        if (entry?.path && entry?.signedUrl) {
          signedAttachmentUrls.set(entry.path, entry.signedUrl);
        }
      });
    }
  }

  const submittedReportItems = (reports ?? []).map((report: any) => {
    const job = Array.isArray(report.jobs) ? report.jobs[0] : report.jobs;
    const client = job && (Array.isArray(job.clients) ? job.clients[0] : job.clients);
    const technician = Array.isArray(report.technicians) ? report.technicians[0] : report.technicians;
    const user = technician && (Array.isArray(technician.users) ? technician.users[0] : technician.users);
    // A job holds one report per assigned technician; the count lets the review
    // screen show the collection as "2 of 3 reported".
    const jobAssignments = Array.isArray(job?.job_technicians)
      ? job.job_technicians
      : job?.job_technicians
        ? [job.job_technicians]
        : [];
    const jobTechnicianCount = jobAssignments.filter(
      (assignment: any) => assignment.is_active,
    ).length;
    const submittedAt = report.submitted_at ? new Date(report.submitted_at) : new Date();
    // Only set when an Admin filed for the technician; the technician's own
    // submissions leave it NULL and need no extra line on the report.
    const filer = Array.isArray(report.filed_by) ? report.filed_by[0] : report.filed_by;
    const filedBy = filer
      ? [filer.first_name, filer.last_name].filter(Boolean).join(" ")
      : "";
    // Job-level invoice state: an invoiced job is done with the review queue,
    // whatever this particular report's review status says.
    const jobInvoice = job?.job_id ? invoiceByJobId.get(job.job_id) ?? null : null;
    const invoice = jobInvoice
      ? { number: jobInvoice.invoice_number, status: invoiceStatusFor(jobInvoice) }
      : null;
    const status = invoice
      ? invoice.status === "paid"
        ? "Paid"
        : "Billed"
      : report.review_status === "approved"
        ? "Ready for Billing"
        : report.review_status === "returned"
          ? "Needs Review"
          : "Submitted";
    const tone = invoice
      ? invoice.status === "paid"
        ? "green"
        : "blue"
      : report.review_status === "approved"
        ? "green"
        : report.review_status === "returned"
          ? "orange"
          : "green";
    const reportId = String(report.report_number || report.report_id);

    return {
      id: reportId,
      reportUuid: report.report_id,
      reviewStatus: report.review_status,
      technicianId: report.technician_id,
      client: client?.name ?? "Unknown client",
      service: serviceLabelFor(job?.job_type),
      technician: user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "Unknown technician",
      filedBy,
      time: submittedAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      serviceDate: report.service_date ? String(report.service_date) : "",
      arrivalTime: String(report.time_arrival ?? "").slice(0, 5),
      status,
      tone,
      invoice,
      workSummary: report.work_performed || "No work summary provided.",
        parts: (report.report_parts_used ?? []).map((partUse: any) => {
          const part = Array.isArray(partUse.parts) ? partUse.parts[0] : partUse.parts;
          return {
            sku: part?.sku ?? "",
            description: part?.name ?? "",
            quantity: partUse.quantity,
            note: "Used",
          };
        }),
      images: (report.report_attachments ?? []).map((attachment: any) => {
        const stored = String(attachment.file_url ?? "");
        return {
          name: attachment.file_type || "attachment",
          // Legacy data URLs render directly; bucket paths are signed above.
          src: stored.startsWith("data:") ? stored : signedAttachmentUrls.get(stored) ?? "",
          alt: attachment.file_type || "Field report attachment",
        };
      }),
      signature: {
        signer: report.client_signoff_name || "Not provided",
        signedAt: report.submitted_at ? new Date(report.submitted_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Pending sign-off",
        method: report.client_signoff ? "Signed on device" : "Awaiting client sign-off",
      },
      billing: {
        readiness: invoice
          ? `Billed as ${invoice.number}`
          : report.review_status === "approved"
            ? "Ready for billing"
            : report.review_status === "returned"
              ? "Needs revision"
              : "Awaiting review",
        inventory: report.review_status === "approved" ? "Reconciled" : "Pending",
        reference: report.report_number || "Not assigned",
      },
      audit: [
        { time: submittedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }), action: "Report submitted", actor: user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "Unknown technician" },
      ],
      jobId: job?.job_id ?? null,
      jobNumber: job?.job_number ?? "",
      jobTechnicianCount,
      workPerformed: report.work_performed || "",
      clientSignoff: Boolean(report.client_signoff),
      clientSignoffName: report.client_signoff_name || "",
      siteAddress: report.site_address || client?.address || "Not provided",
      issueDescription: report.issue_description || "",
      recommendations: report.recommendations || "",
      additionalNotes: report.additional_notes || "",
      submittedAt: report.submitted_at ?? null,
    };
  });

  return [...pendingReportItems, ...submittedReportItems].sort((left, right) =>
    new Date(right.submittedAt ?? right.reservedAt ?? 0).getTime() -
    new Date(left.submittedAt ?? left.reservedAt ?? 0).getTime(),
  );
}

export async function submitFieldReport(session: Record<string, unknown>, body: Record<string, any>, db = supabaseAdmin) {
  const jobId = body.jobId ? String(body.jobId) : null;
  const workPerformed = String(body.workPerformed ?? "").trim();
  const issueDescription = String(body.issueDescription ?? "").trim();
  const recommendations = String(body.recommendations ?? "").trim();
  const siteAddress = String(body.siteAddress ?? "").trim();
  const serviceDate = String(body.serviceDate ?? "").trim();
  const timeArrival = String(body.arrivalTime ?? "").trim();
  const clientSignoff = Boolean(body.clientSignoff);
  const clientSignoffName = String(body.clientSignoffName ?? "").trim();
  const additionalNotes = String(body.additionalNotes ?? "").trim();
  const partsUsed = Array.isArray(body.partsUsed) ? body.partsUsed : [];
  const attachments = Array.isArray(body.images) ? body.images : [];

  if (!jobId || !workPerformed || !serviceDate) {
    throw new Error("Please complete the required report fields before submitting.");
  }

  // Images must already be uploaded to the bucket by this session, for this job.
  // Data URLs are rejected outright: the whole point of the bucket is to keep
  // blobs out of the database.
  const attachmentPaths = attachments
    .map((attachment: any) => String(attachment?.path ?? "").trim())
    .filter(Boolean);
  if (attachments.length > MAX_REPORT_ATTACHMENTS) {
    throw new Error(`Attach at most ${MAX_REPORT_ATTACHMENTS} images.`);
  }
  if (
    attachmentPaths.length !== attachments.length ||
    attachmentPaths.some(
      (path: string) =>
        !ATTACHMENT_PATH_PATTERN.test(path) ||
        !path.startsWith(`reports/${jobId}/${session.sub}/`),
    )
  ) {
    throw new Error("One or more images were not uploaded correctly. Remove them and try again.");
  }

  // Technicians, and managers who are on the crew, file their own report. An
  // Admin who is not assigned files it on behalf of one of the job's active
  // technicians, which the composite FK and the RPC re-check.
  const isAdmin = String(session.role ?? "") === "Admin";
  const ownTechnicianId = await findCurrentTechnicianId(session);
  const isActiveAssignee = async (technicianId: string) => {
    if (!technicianId) return false;
    const { data, error } = await db
      .from("job_technicians")
      .select("technician_id")
      .eq("job_id", jobId)
      .eq("technician_id", technicianId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  };

  let technicianId: string;
  let filedOnBehalf = false;
  if (isAdmin) {
    const requestedTechnicianId = String(body.technicianId ?? "").trim();
    const chosenTechnicianId = requestedTechnicianId || ownTechnicianId;
    if (!chosenTechnicianId) {
      throw new Error("Choose which technician this report belongs to.");
    }
    if (!(await isActiveAssignee(chosenTechnicianId))) {
      throw new Error(
        requestedTechnicianId
          ? "That technician is not assigned to this job."
          : "Choose which technician this report belongs to.",
      );
    }
    technicianId = chosenTechnicianId;
    // An admin on the crew is simply filing their own report.
    filedOnBehalf = chosenTechnicianId !== ownTechnicianId;
  } else {
    technicianId = await getCurrentTechnicianId(session, db);
  }

  const { data: existingReport, error: existingReportError } = await db
    .from("field_reports")
    .select("report_id")
    .eq("job_id", jobId)
    .eq("technician_id", technicianId)
    .maybeSingle();

  if (existingReportError) throw existingReportError;
  if (existingReport) {
    throw new Error("You have already submitted a field report for this job. Each technician files one report per job.");
  }

  const { data: report, error: reportError } = await db.rpc(
    "gioms_submit_field_report_with_usage",
    {
      p_job_id: jobId,
      p_technician_id: technicianId,
      p_work_performed: workPerformed,
      p_issue_description: issueDescription || null,
      p_recommendations: recommendations || null,
      p_site_address: siteAddress || null,
      p_service_date: serviceDate,
      p_time_arrival: timeArrival || null,
      p_client_signoff: clientSignoff,
      p_client_signoff_name: clientSignoffName || null,
      p_additional_notes: additionalNotes || null,
      p_used_parts: partsUsed.map((part: any) => ({
        jobPartId: String(part?.jobPartId ?? ""),
        quantity: Number(part?.quantity),
      })),
      p_attachments: attachmentPaths.map((path: string) => ({ fileUrl: path })),
    },
  );

  if (reportError) throw new Error(reportError.message);

  // The report belongs to the technician; this records who actually filed it
  // when an Admin acted on their behalf. A failure here must not lose the
  // report — the audit log still attributes the write to the acting admin.
  if (filedOnBehalf) {
    const { error: filerError } = await db
      .from("field_reports")
      .update({ filed_by_user_id: session.sub })
      .eq("report_id", report.reportId);
    if (filerError) {
      console.error("Could not record who filed the field report:", filerError.message);
    }
  }
  return { report: { id: report.reportId, number: report.reportNumber } };
}

// Read-only counterpart to getCurrentTechnicianId: opening the picker must not
// create a technician record for someone who has none.
export async function findCurrentTechnicianId(session: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin
    .from("technicians")
    .select("technician_id")
    .eq("user_id", session.sub)
    .maybeSingle();
  if (error) throw error;
  return (data?.technician_id as string | undefined) ?? "";
}

export async function listFieldReportJobs(session: Record<string, unknown>) {
  const technicianRoles = new Set(["Technician", "Service Manager", "Sales Manager"]);
  const isTechnicianView = technicianRoles.has(String(session.role ?? ""));
  const myTechnicianId = isTechnicianView ? await findCurrentTechnicianId(session) : "";

  // A technician-role user with no technician record is assigned to nothing, so
  // there is no job to report. This matches the previous scoped query.
  if (isTechnicianView && !myTechnicianId) return [];

  let query = supabaseAdmin
    .from("jobs")
    .select("job_id, job_number, job_type, branch, parts_status, scheduled_date, scheduled_time, clients(name, address), job_parts(job_part_id, quantity, status, parts(sku, name)), job_technicians!inner(technician_id, is_active, technicians!inner(technician_id, users(first_name, last_name)))")
    .eq("job_technicians.is_active", true)
    .neq("status", "cancelled")
    .order("scheduled_date")
    .order("scheduled_time");

  if (isTechnicianView && myTechnicianId) {
    query = query.eq("job_technicians.technician_id", myTechnicianId);
  }

  const { data: jobs, error } = await query;
  if (error) throw error;

  // Reports are a per-technician collection: everyone assigned files one, and the
  // job leaves only the filer's picker. The earliest report is the one billing
  // references, and it is also the one that reconciled the job's parts.
  const { data: reports, error: reportsError } = await supabaseAdmin
    .from("field_reports")
    .select("job_id, technician_id, report_number, submitted_at, technicians!inner(users(first_name, last_name))")
    .order("submitted_at");
  if (reportsError) throw reportsError;

  const reportsByJob = new Map<string, any[]>();
  (reports ?? []).forEach((report: any) => {
    if (!report.job_id) return;
    const list = reportsByJob.get(report.job_id) ?? [];
    list.push(report);
    reportsByJob.set(report.job_id, list);
  });

  const { data: stockMovements, error: stockMovementError } = await supabaseAdmin
    .from("stock_movements")
    .select("related_job_id")
    .eq("reason", "job_usage")
    .not("related_job_id", "is", null);
  if (stockMovementError) throw stockMovementError;
  const allocatedJobIds = new Set(
    (stockMovements ?? []).map((movement: { related_job_id: string }) => movement.related_job_id),
  );

  return (jobs ?? [])
    .filter((job: any) => {
      const jobReports = reportsByJob.get(job.job_id) ?? [];
      const activeAssignments = (Array.isArray(job.job_technicians)
        ? job.job_technicians
        : []
      ).filter((assignment: any) => assignment.is_active);
      const reportedTechnicianIds = new Set(
        jobReports.map((report: any) => report.technician_id),
      );

      if (isTechnicianView) {
        // Only this technician's own report removes the job from their picker.
        if (myTechnicianId && reportedTechnicianIds.has(myTechnicianId)) {
          return false;
        }
      } else if (
        activeAssignments.length > 0 &&
        activeAssignments.every((assignment: any) =>
          reportedTechnicianIds.has(assignment.technician_id),
        )
      ) {
        // A manager's picker lists a job only while someone still owes a report.
        return false;
      }

      // A teammate's report keeps the job visible even after the parts have been
      // reconciled, because the collection is not finished until everyone files.
      // Jobs with no quotation part lines are classified not_required at
      // confirmation and still need a report even though nothing was reserved.
      return (
        allocatedJobIds.has(job.job_id) ||
        job.parts_status === "not_required" ||
        job.job_type === "maintenance" ||
        (job.job_parts ?? []).some((part: any) => part.status === "reserved") ||
        jobReports.length > 0
      );
    })
    .map((job: any) => {
      const client = Array.isArray(job.clients) ? job.clients[0] : job.clients;
      const jobReports = reportsByJob.get(job.job_id) ?? [];
      const activeAssignments = (Array.isArray(job.job_technicians)
        ? job.job_technicians
        : []
      ).filter((assignment: any) => assignment.is_active);
      const reportedTechnicianIds = new Set(
        jobReports.map((report: any) => report.technician_id),
      );
      const nameOf = (report: any) => {
        const technician = Array.isArray(report.technicians)
          ? report.technicians[0]
          : report.technicians;
        const user = technician && (Array.isArray(technician.users)
          ? technician.users[0]
          : technician.users);
        return user
          ? [user.first_name, user.last_name].filter(Boolean).join(" ")
          : "Technician";
      };
      const assignedTechnicians = activeAssignments.map((assignment: any) => {
        const technician = Array.isArray(assignment.technicians)
          ? assignment.technicians[0]
          : assignment.technicians;
        const user = technician && (Array.isArray(technician.users)
          ? technician.users[0]
          : technician.users);
        return {
          technicianId: assignment.technician_id,
          name: user
            ? [user.first_name, user.last_name].filter(Boolean).join(" ")
            : "Technician",
          reported: reportedTechnicianIds.has(assignment.technician_id),
        };
      });
      const reservedParts = (job.job_parts ?? [])
        .filter((reservation: any) => reservation.status === "reserved")
        .map((reservation: any) => {
          const part = Array.isArray(reservation.parts) ? reservation.parts[0] : reservation.parts;
          return {
            jobPartId: reservation.job_part_id,
            sku: part?.sku ?? "",
            name: part?.name ?? "Reserved part",
            quantity: reservation.quantity,
          };
        });
      const allParts = job.job_parts ?? [];
      const earliestReport = jobReports[0];
      return {
        jobId: job.job_id,
        jobNumber: job.job_number,
        clientName: client?.name ?? "Unnamed client",
        serviceType: job.job_type,
        serviceLabel: serviceLabelFor(job.job_type),
        siteAddress: client?.address ?? `${String(job.branch).replace(/^./, (letter) => letter.toUpperCase())} branch`,
        technicianName:
          assignedTechnicians.map((technician: any) => technician.name).join(", ") ||
          "Unassigned",
        assignedTechnicians,
        assignedCount: assignedTechnicians.length,
        reportedCount: assignedTechnicians.filter((technician: any) => technician.reported).length,
        // Only meaningful once the first report has reconciled the reservations.
        partsReconciledBy:
          allParts.length > 0 &&
          earliestReport &&
          !allParts.some((part: any) => part.status === "reserved")
            ? {
                name: nameOf(earliestReport),
                reportNumber: earliestReport.report_number ?? "",
              }
            : null,
        serviceDate: String(job.scheduled_date),
        arrivalTime: String(job.scheduled_time ?? "").slice(0, 5),
        reservedParts,
      };
    });
}

export async function handleReviewFieldReport({ body, session, db }: { body: any; session: any; db: any }) {
  const reportId = String(body.reportId ?? "").trim();
  const decision = String(body.decision ?? "").trim();
  if (!reportId || !["approve", "return"].includes(decision)) {
    return response({ error: "A field report and a valid decision are required." }, 400);
  }
  const { data: report, error } = await db
    .from("field_reports")
    .select("report_id, review_status, jobs!field_reports_job_id_fkey!inner(branch)")
    .eq("report_id", reportId)
    .maybeSingle();
  if (error) throw error;
  if (!report) return response({ error: "Field report not found." }, 404);
  const reportJob = Array.isArray(report.jobs) ? report.jobs[0] : report.jobs;
  if (branchScope(session) !== null && String(reportJob?.branch) !== String(session.branch)) {
    return response({ error: "This report belongs to another branch." }, 403);
  }
  if (report.review_status === "draft") {
    return response({ error: "This report has not been submitted for review yet." }, 409);
  }
  const nextStatus = decision === "approve" ? "approved" : "returned";
  const { error: reviewError } = await db
    .from("field_reports")
    .update({ review_status: nextStatus, reviewed_by: session.sub, reviewed_at: new Date().toISOString() })
    .eq("report_id", reportId);
  if (reviewError) throw reviewError;
  return response({
    message: nextStatus === "approved" ? "Report approved for billing." : "Report returned for correction.",
    reviewStatus: nextStatus,
  });
}

export async function handleListFieldReportJobs({ session }: { session: any }) {
  return response({ jobs: await listFieldReportJobs(session) });
}

export async function handleListFieldReports({ body, session }: { body: any; session: any }) {
  const isManager = ["Admin", "Service Manager", "Sales Manager"].includes(String(session.role ?? ""));
  const reports = await listFieldReports(session, String(body.technicianId ?? ""));
  return response({ reports, technicians: isManager ? await listReportTechnicians() : [] });
}

export async function handleResubmitFieldReport({ body, session, db }: { body: any; session: any; db: any }) {
  const reportId = String(body.reportId ?? "").trim();
  if (!reportId) return response({ error: "Choose a field report to edit." }, 400);

  // Only the technician who filed the report may correct it; managers return
  // reports for correction but do not rewrite them.
  const technicianId = await findCurrentTechnicianId(session);
  if (!technicianId) {
    return response({ error: "Only the technician who filed this report can edit it." }, 403);
  }

  const { data: report, error } = await db
    .from("field_reports")
    .select("report_id, technician_id, review_status")
    .eq("report_id", reportId)
    .maybeSingle();
  if (error) throw error;
  if (!report) return response({ error: "Field report not found." }, 404);
  if (report.technician_id !== technicianId) {
    return response({ error: "Only the technician who filed this report can edit it." }, 403);
  }
  if (report.review_status !== "returned") {
    return response({ error: "Only a report returned for correction can be edited." }, 409);
  }

  const workPerformed = String(body.workPerformed ?? "").trim();
  const serviceDate = String(body.serviceDate ?? "").trim();
  if (!workPerformed || !serviceDate) {
    return response({ error: "Describe the work performed and give the service date." }, 400);
  }

  // Parts and stock movements are deliberately untouched: the first report on
  // this job already reconciled the reservations, and consuming them twice
  // would corrupt stock.
  const { error: updateError } = await db
    .from("field_reports")
    .update({
      work_performed: workPerformed,
      issue_description: String(body.issueDescription ?? "").trim() || null,
      recommendations: String(body.recommendations ?? "").trim() || null,
      additional_notes: String(body.additionalNotes ?? "").trim() || null,
      site_address: String(body.siteAddress ?? "").trim() || null,
      service_date: serviceDate,
      time_arrival: String(body.arrivalTime ?? "").trim() || null,
      client_signoff: Boolean(body.clientSignoff),
      client_signoff_name: String(body.clientSignoffName ?? "").trim() || null,
      review_status: "submitted",
      reviewed_by: null,
      reviewed_at: null,
      submitted_at: new Date().toISOString(),
    })
    .eq("report_id", reportId);
  if (updateError) throw updateError;

  return response({
    message: "Report resubmitted for review.",
    reviewStatus: "submitted",
  });
}

export async function handleCreateReportUpload({ body, session, db }: { body: any; session: any; db: any }) {
  const jobId = String(body.jobId ?? "").trim();
  const contentType = String(body.contentType ?? "").trim().toLowerCase();
  const size = Number(body.size);
  if (!jobId) return response({ error: "Choose a job before attaching an image." }, 400);
  if (!ATTACHMENT_CONTENT_TYPES.has(contentType)) {
    return response({ error: "Attach a JPEG, PNG, or WebP image." }, 400);
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_ATTACHMENT_BYTES) {
    return response({ error: "Each image must be 10 MB or smaller." }, 400);
  }

  const technicianId = await findCurrentTechnicianId(session);
  const isAdmin = String(session.role ?? "") === "Admin";
  if (!technicianId && !isAdmin) {
    return response({ error: "Only an assigned technician can attach images." }, 403);
  }
  // An Admin may stage photos for a report they are filing on behalf of an
  // assignee. The object still lives under the uploader's own user id, so the
  // submit-time path check and discard ownership keep working unchanged.
  if (!isAdmin) {
    const { data: assignment, error: assignmentError } = await db
      .from("job_technicians")
      .select("job_id")
      .eq("job_id", jobId)
      .eq("technician_id", technicianId)
      .eq("is_active", true)
      .maybeSingle();
    if (assignmentError) throw assignmentError;
    if (!assignment) return response({ error: "You are not assigned to this job." }, 403);
  }

  const path = `reports/${jobId}/${session.sub}/${crypto.randomUUID()}.${attachmentExtension(contentType)}`;
  const { data: signed, error: signError } = await db.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUploadUrl(path);
  if (signError) throw signError;
  if (!signed?.token) return response({ error: "Could not prepare the upload." }, 502);

  return response({ path, token: signed.token, signedUrl: signed.signedUrl ?? "" });
}

export async function handleDiscardReportUpload({ body, session, db }: { body: any; session: any; db: any }) {
  const path = String(body.path ?? "").trim();
  if (!ATTACHMENT_PATH_PATTERN.test(path) || !path.includes(`/${String(session.sub)}/`)) {
    return response({ error: "That upload does not belong to you." }, 403);
  }
  const { data: attached, error: attachedError } = await db
    .from("report_attachments")
    .select("attachment_id")
    .eq("file_url", path)
    .limit(1);
  if (attachedError) throw attachedError;
  if (attached?.length) {
    return response({ error: "That image is already part of a report." }, 409);
  }
  const { error: removeError } = await db.storage.from(ATTACHMENT_BUCKET).remove([path]);
  if (removeError) throw removeError;
  return response({ message: "Upload discarded." });
}

export async function handleMigrateReportAttachments({ db }: { db: any }) {
  // One-off: move legacy base64 rows into the bucket so the column stores paths.
  const { data: legacy, error: legacyError } = await db
    .from("report_attachments")
    .select("attachment_id, file_url, report_id, field_reports!inner(job_id, technician_id)")
    .like("file_url", "data:%")
    .limit(10);
  if (legacyError) throw legacyError;

  let migrated = 0;
  let failed = 0;

  for (const row of legacy ?? []) {
    const record = row as any;
    try {
      const match = /^data:(image\/[a-z+]+);base64,(.*)$/is.exec(String(record.file_url));
      if (!match) {
        failed += 1;
        continue;
      }
      const contentType = match[1].toLowerCase();
      const report = Array.isArray(record.field_reports)
        ? record.field_reports[0]
        : record.field_reports;
      const { data: technician, error: technicianError } = await db
        .from("technicians")
        .select("user_id")
        .eq("technician_id", report?.technician_id ?? "")
        .maybeSingle();
      if (technicianError) throw technicianError;

      const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
      const owner = technician?.user_id ?? "00000000-0000-0000-0000-000000000000";
      const path = `reports/${report?.job_id}/${owner}/${crypto.randomUUID()}.${attachmentExtension(contentType)}`;
      const { error: uploadError } = await db.storage
        .from(ATTACHMENT_BUCKET)
        .upload(path, bytes, { contentType, upsert: false });
      if (uploadError) throw uploadError;

      const { error: updateError } = await db
        .from("report_attachments")
        .update({ file_url: path })
        .eq("attachment_id", record.attachment_id);
      if (updateError) throw updateError;
      migrated += 1;
    } catch (error) {
      console.error("Attachment migration failed for", record.attachment_id, error);
      failed += 1;
    }
  }

  const { count: remaining, error: remainingError } = await db
    .from("report_attachments")
    .select("attachment_id", { count: "exact", head: true })
    .like("file_url", "data:%");
  if (remainingError) throw remainingError;

  return response({ migrated, failed, remaining: remaining ?? 0 });
}

export async function handleSubmitFieldReport({ body, session, db }: { body: any; session: any; db: any }) {
  try {
    const result = await submitFieldReport(session, body || {}, db);
    return response(result, 201);
  } catch (error) {
    console.error("Field report submission failed:", error);
    return response({
      error: error instanceof Error ? error.message : "Unable to submit the field report.",
    }, 400);
  }
}
