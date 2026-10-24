import { branchScope } from "../auth.ts";
import { response } from "../shared.ts";

export async function handleListInvoices({ session, db }: { session: any; db: any }) {
  const first = (value: any) => (Array.isArray(value) ? value[0] : value);
  let invoiceQuery = db
    .from("invoices")
    .select(`
      invoice_id, invoice_number, status, issue_date, due_date, total_amount,
      clients(name, company_name),
      jobs!invoices_job_id_fkey!inner(job_number, job_type, branch),
      quotations(quotation_number),
      field_reports!invoices_report_id_fkey(report_number, service_date),
      invoice_line_items(line_item_id, description, quantity, unit_price, line_total),
      payments(payment_id, amount, payment_date, method, created_at)
    `);
  const invoiceBranch = branchScope(session);
  if (invoiceBranch !== null) invoiceQuery = invoiceQuery.eq("jobs.branch", invoiceBranch);
  const { data: invoices, error } = await invoiceQuery.order("created_at", { ascending: false });
  if (error) throw error;

  const today = new Date().toISOString().slice(0, 10);
  return response({
    invoices: (invoices ?? []).map((invoice: any) => {
      const total = Number(invoice.total_amount) || 0;
      const payments = (Array.isArray(invoice.payments) ? invoice.payments : [])
        .map((payment: any) => ({
          id: payment.payment_id,
          amount: Number(payment.amount) || 0,
          date: String(payment.payment_date),
          method: payment.method,
          createdAt: payment.created_at,
        }))
        .sort((left: any, right: any) => (left.date < right.date ? 1 : left.date > right.date ? -1 : 0));
      const paid =
        Math.round(payments.reduce((sum: number, payment: any) => sum + payment.amount, 0) * 100) / 100;
      const balance = Math.round((total - paid) * 100) / 100;
      // "overdue" is derived rather than stored: nothing runs on a schedule to
      // flip the column, so a stale status would otherwise show forever.
      let status = invoice.status;
      if (status !== "cancelled" && balance <= 0) status = "paid";
      else if (status === "pending" && invoice.due_date && String(invoice.due_date) < today) status = "overdue";

      const client = first(invoice.clients);
      const job = first(invoice.jobs);
      const quotation = first(invoice.quotations);
      const report = first(invoice.field_reports);
      return {
        id: invoice.invoice_id,
        invoiceNumber: invoice.invoice_number,
        status,
        storedStatus: invoice.status,
        issueDate: String(invoice.issue_date),
        dueDate: invoice.due_date ? String(invoice.due_date) : null,
        totalAmount: total,
        paidAmount: paid,
        balance,
        clientName: client?.company_name || client?.name || "Client",
        jobNumber: job?.job_number ?? "",
        jobType: job?.job_type ?? "",
        quotationNumber: quotation?.quotation_number ?? "",
        reportNumber: report?.report_number ?? "",
        serviceDate: report?.service_date ? String(report.service_date) : null,
        lines: (Array.isArray(invoice.invoice_line_items) ? invoice.invoice_line_items : []).map(
          (line: any) => ({
            id: line.line_item_id,
            description: line.description,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unit_price),
            lineTotal: Number(line.line_total),
          }),
        ),
        payments,
      };
    }),
  });
}

export async function handleListInvoiceCandidates({ session, db }: { session: any; db: any }) {
  const first = (value: any) => (Array.isArray(value) ? value[0] : value);
  let reportQuery = db
    .from("field_reports")
    .select(`
      report_id, report_number, service_date, submitted_at, reviewed_at,
      technicians!inner(users(first_name, last_name)),
      jobs!field_reports_job_id_fkey!inner(job_id, job_number, job_type, branch, site_address, client_id, quotation_id, clients(name, company_name))
    `)
    .eq("review_status", "approved");
  const candidateBranch = branchScope(session);
  if (candidateBranch !== null) reportQuery = reportQuery.eq("jobs.branch", candidateBranch);
  const { data: reports, error } = await reportQuery.order("submitted_at", { ascending: false });
  if (error) throw error;

  const { data: invoiced, error: invoicedError } = await db
    .from("invoices")
    .select("job_id")
    .neq("status", "cancelled");
  if (invoicedError) throw invoicedError;
  const invoicedJobs = new Set((invoiced ?? []).map((row: any) => row.job_id));

  const technicianNameOf = (report: any) => {
    const technician = first(report.technicians);
    const user = technician ? first(technician.users) : null;
    return user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "Technician";
  };

  // Billing references exactly one report per job: the earliest approved.
  // Approving a second technician's report must not add a second candidate.
  const jobReports = new Map<string, any[]>();
  (reports ?? []).forEach((report: any) => {
    const job = first(report.jobs);
    if (!job) return;
    const entries = jobReports.get(job.job_id) ?? [];
    entries.push({ report, job });
    jobReports.set(job.job_id, entries);
  });

  const quotationIds = Array.from(
    new Set(
      [...jobReports.values()]
        .map((entries) => entries[0]?.job?.quotation_id)
        .filter(Boolean),
    ),
  );
  let quoteLines: any[] = [];
  if (quotationIds.length) {
    const { data: lines, error: linesError } = await db
      .from("quotation_line_items")
      .select("quotation_id, line_type, description, quantity, unit_price, line_total")
      .in("quotation_id", quotationIds)
      .order("line_item_id");
    if (linesError) throw linesError;
    quoteLines = lines ?? [];
  }

  const candidates = [...jobReports.entries()]
    .filter(([jobId]) => !invoicedJobs.has(jobId))
    .map(([, entries]) => {
      const ordered = entries.slice().sort((left, right) => {
        const leftKey = left.report.reviewed_at ?? left.report.submitted_at ?? "";
        const rightKey = right.report.reviewed_at ?? right.report.submitted_at ?? "";
        if (leftKey < rightKey) return -1;
        if (leftKey > rightKey) return 1;
        return String(left.report.report_id).localeCompare(String(right.report.report_id));
      });
      const primary = ordered[0];
      const job = primary.job;
      const client = first(job.clients);
      const lines = quoteLines.filter((line: any) => line.quotation_id === job.quotation_id);
      return {
        reportId: primary.report.report_id,
        reportNumber: primary.report.report_number,
        serviceDate: String(primary.report.service_date),
        submittedAt: primary.report.submitted_at,
        reviewedAt: primary.report.reviewed_at,
        reportCount: ordered.length,
        reports: ordered.map((entry: any) => ({
          reportId: entry.report.report_id,
          reportNumber: entry.report.report_number,
          technicianName: technicianNameOf(entry.report),
          reviewedAt: entry.report.reviewed_at,
        })),
        jobId: job.job_id,
        jobNumber: job.job_number,
        jobType: job.job_type,
        branch: job.branch,
        siteAddress: job.site_address ?? "",
        quotationId: job.quotation_id ?? "",
        clientName: client?.company_name || client?.name || "Client",
        lines: lines.map((line: any) => ({
          lineType: line.line_type,
          description: line.description,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unit_price),
          lineTotal: Number(line.line_total),
        })),
        quotedTotal:
          Math.round(
            lines.reduce((sum: number, line: any) => sum + Number(line.line_total || 0), 0) * 100,
          ) / 100,
      };
    });

  return response({ candidates });
}
export async function handleCreateInvoice({ body, session, db }: { body: any; session: any; db: any }) {
  const reportId = String(body.reportId ?? "").trim();
  const dueDate = body.dueDate ? String(body.dueDate) : null;
  const extras = Array.isArray(body.extras) ? body.extras : [];
  if (!reportId) return response({ error: "Choose an approved field report to invoice." }, 400);
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return response({ error: "The due date is not a valid date." }, 400);
  }
  if (extras.length > 25) return response({ error: "Add at most 25 extra lines." }, 400);

  const { data: reportRow, error: reportLookupError } = await db
    .from("field_reports")
    .select("report_id, jobs!field_reports_job_id_fkey!inner(branch)")
    .eq("report_id", reportId)
    .maybeSingle();
  if (reportLookupError) throw reportLookupError;
  if (!reportRow) return response({ error: "Field report not found." }, 404);
  const invoiceJob = Array.isArray(reportRow.jobs) ? reportRow.jobs[0] : reportRow.jobs;
  if (branchScope(session) !== null && String(invoiceJob?.branch) !== String(session.branch)) {
    return response({ error: "This report belongs to another branch." }, 403);
  }

  // jsonb_to_recordset in the RPC expects exactly these keys.
  const extraLines = extras.map((extra: any) => ({
    description: String(extra?.description ?? "").trim(),
    quantity: Number(extra?.quantity),
    unit_price: Number(extra?.unitPrice),
  }));
  if (extraLines.some((line: any) => !line.description)) {
    return response({ error: "Every extra line needs a description." }, 400);
  }
  if (extraLines.some((line: any) => !Number.isFinite(line.quantity) || line.quantity <= 0)) {
    return response({ error: "Extra line quantities must be greater than zero." }, 400);
  }
  if (extraLines.some((line: any) => !Number.isFinite(line.unit_price) || line.unit_price < 0)) {
    return response({ error: "Extra line prices cannot be negative." }, 400);
  }

  const { data: invoice, error } = await db.rpc("gioms_create_invoice_from_report", {
    p_report_id: reportId,
    p_due_date: dueDate,
    p_extra_lines: extraLines,
  });
  if (error) return response({ error: error.message }, 409);
  return response(invoice, 201);
}

export async function handleRecordPayment({ body, session, db }: { body: any; session: any; db: any }) {
  const invoiceId = String(body.invoiceId ?? "").trim();
  const amount = Number(body.amount);
  const method = String(body.method ?? "").trim();
  const paidOn = body.paymentDate ? String(body.paymentDate) : null;
  if (!invoiceId) return response({ error: "Choose an invoice." }, 400);
  if (!Number.isFinite(amount) || amount <= 0) {
    return response({ error: "Enter a payment greater than zero." }, 400);
  }
  if (!["cash", "check", "bank_transfer", "online"].includes(method)) {
    return response({ error: "Choose a valid payment method." }, 400);
  }
  if (paidOn && !/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) {
    return response({ error: "The payment date is not a valid date." }, 400);
  }

  const { data: invoiceRow, error: invoiceLookupError } = await db
    .from("invoices")
    .select("invoice_id, jobs!invoices_job_id_fkey!inner(branch)")
    .eq("invoice_id", invoiceId)
    .maybeSingle();
  if (invoiceLookupError) throw invoiceLookupError;
  if (!invoiceRow) return response({ error: "Invoice not found." }, 404);
  const paymentJob = Array.isArray(invoiceRow.jobs) ? invoiceRow.jobs[0] : invoiceRow.jobs;
  if (branchScope(session) !== null && String(paymentJob?.branch) !== String(session.branch)) {
    return response({ error: "This invoice belongs to another branch." }, 403);
  }

  const { data: payment, error } = await db.rpc("gioms_record_invoice_payment", {
    p_invoice_id: invoiceId,
    p_amount: amount,
    p_method: method,
    p_paid_on: paidOn,
    p_actor: String(session.sub),
  });
  if (error) return response({ error: error.message }, 409);
  return response(payment);
}