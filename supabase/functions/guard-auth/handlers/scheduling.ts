import { response, supabaseAdmin } from "../shared.ts";
import { jobTypeFor, serviceLabelFor } from "../domain.ts";
import { branchScope, passwordConfirmationError, scopedBranch } from "../auth.ts";

export async function ensureTechnicianRecord(user: Record<string, unknown>, db = supabaseAdmin) {
  const { data: existing, error: lookupError } = await db.from("technicians").select("technician_id").eq("user_id", user.user_id).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing.technician_id;
  const { data, error } = await db.from("technicians").insert({ user_id: user.user_id, branch: user.branch }).select("technician_id").single();
  if (error) throw error;
  return data.technician_id;
}

export async function listTechnicians(date: string, excludeOrder = "") {
  const { data: users, error } = await supabaseAdmin
    .from("users")
    .select("user_id, first_name, last_name, branch, roles!inner(role_name), technicians(technician_id)")
    .eq("is_active", true)
    .eq("roles.role_name", "Technician")
    .order("first_name");
  if (error) throw error;

  const allTechnicians = [];
  for (const user of users ?? []) {
    const role = Array.isArray(user.roles) ? user.roles[0] : user.roles;
    if (role?.role_name !== "Technician") continue;
    const relation = Array.isArray(user.technicians) ? user.technicians[0] : user.technicians;
    const technicianId = relation?.technician_id ?? await ensureTechnicianRecord(user);
    allTechnicians.push({ id: technicianId, name: [user.first_name, user.last_name].filter(Boolean).join(" "), branch: user.branch, roleName: role.role_name });
  }

  if (!date || !allTechnicians.length) return allTechnicians;
  let bookedQuery = supabaseAdmin
    .from("job_technicians")
    .select("technician_id, jobs!inner(job_number, scheduled_date, status)")
    .eq("jobs.scheduled_date", date)
    .neq("jobs.status", "cancelled")
    .eq("is_active", true)
    .in("technician_id", allTechnicians.map((technician) => technician.id));
  if (excludeOrder) bookedQuery = bookedQuery.neq("jobs.job_number", excludeOrder);
  const { data: booked, error: bookedError } = await bookedQuery;
  if (bookedError) throw bookedError;
  const bookedIds = new Set((booked ?? []).map((assignment: { technician_id: string | number }) => assignment.technician_id));
  return allTechnicians.filter((technician) => !bookedIds.has(technician.id));
}

export async function hasOnlyActiveTechnicianRole(technicianIds: string[]) {
  if (!technicianIds.length) return true;
  const { data: users, error } = await supabaseAdmin
    .from("users")
    .select("technicians!inner(technician_id), roles!inner(role_name)")
    .eq("is_active", true)
    .eq("roles.role_name", "Technician")
    .in("technicians.technician_id", technicianIds);
  if (error) throw error;
  const matchedIds = new Set(
    (users ?? []).flatMap((user: any) => {
      const relations = Array.isArray(user.technicians)
        ? user.technicians
        : [user.technicians];
      return relations.map((technician: any) => technician.technician_id);
    }),
  );
  return technicianIds.every((technicianId) => matchedIds.has(technicianId));
}

export async function listSchedules(branch: string | null = null) {
  let query = supabaseAdmin
    .from("jobs")
    .select("job_id, job_number, job_type, status, branch, scheduled_date, scheduled_time, scheduled_end_time, parts_status, assignment_confirmed_at, site_address, quotation_id, clients(name, address), job_technicians(technician_id, is_active, technicians(users(first_name, last_name)))")
    .neq("status", "cancelled");
  if (branch !== null) query = query.eq("branch", branch);
  const { data: jobs, error } = await query
    .order("scheduled_date")
    .order("scheduled_time");
  if (error) throw error;

  return (jobs ?? []).map((job: any) => {
    const assignments = (Array.isArray(job.job_technicians) ? job.job_technicians : []).filter((assignment: { is_active: boolean }) => assignment.is_active);
    const technicians = assignments.map((assignment: any) => {
      const technician = Array.isArray(assignment.technicians) ? assignment.technicians[0] : assignment.technicians;
      const user = technician && (Array.isArray(technician.users) ? technician.users[0] : technician.users);
      return {
        id: assignment.technician_id,
        name: user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "Unknown technician",
      };
    });
    const client = Array.isArray(job.clients) ? job.clients[0] : job.clients;
    const time = String(job.scheduled_time ?? "").slice(0, 5);
    const date = String(job.scheduled_date);
    return {
      id: job.job_id,
      order: job.job_number,
      status: job.status,
      branch: job.branch,
      date,
      time,
      dayLabel: new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      client: client?.name ?? "Unnamed client",
      service: serviceLabelFor(job.job_type),
      location: job.site_address || client?.address || `${String(job.branch).replace(/^./, (letter) => letter.toUpperCase())} branch`,
      technician: technicians.length ? technicians.map((technician: { name: string }) => technician.name).join(", ") : "Unassigned",
      technicians,
      stock: "Available",
      partsStatus: job.parts_status,
      assignmentConfirmedAt: job.assignment_confirmed_at,
      // A draft is an unconfirmed job whose parts have not been allocated yet.
      // Legacy jobs that predate the confirmation step stay out of this bucket.
      isDraft: !job.assignment_confirmed_at && job.parts_status === "pending",
      siteAddress: job.site_address,
      quotationId: job.quotation_id,
      endTime: String(job.scheduled_end_time ?? "").slice(0, 5),
    };
  });
}

export async function listPendingJobRequests(branch: string | null = null) {
  const schedules = await listSchedules(branch);
  const { data: stockMovements, error } = await supabaseAdmin
    .from("stock_movements")
    .select("related_job_id")
    .eq("reason", "job_usage")
    .not("related_job_id", "is", null);
  if (error) throw error;
  const allocatedJobIds = new Set(
    (stockMovements ?? []).map((movement: { related_job_id: string }) => movement.related_job_id),
  );

  // Only assignment-confirmed jobs whose parts are still pending belong in the
  // allocation queue. Unconfirmed jobs remain in the scheduling stage.
  return schedules
    .filter((job: any) =>
      job.status === "scheduled" &&
      job.technicians.length > 0 &&
      job.partsStatus === "pending" &&
      Boolean(job.assignmentConfirmedAt) &&
      !allocatedJobIds.has(job.id)
    )
    .map((job: any) => ({
      jobNumber: job.order,
      location: job.location,
      scheduledDate: job.date,
      scheduledTime: job.time || "--:--",
      branch: job.branch,
      technicianName: job.technician,
    }));
}

export async function listJobAllocationHistory(branch: string | null = null) {
  const first = (value: any) => (Array.isArray(value) ? value[0] : value);

  // One row per reservation; the grouping below turns it into one row per job.
  let allocationQuery = supabaseAdmin
    .from("job_parts")
    .select("job_part_id, quantity, status, reserved_at, updated_at, parts!inner(sku, name, unit_of_measure), jobs!inner(job_id, job_number, branch, scheduled_date, status, parts_status, clients(name), job_technicians(is_active, technicians(users(first_name, last_name))))");
  if (branch !== null) allocationQuery = allocationQuery.eq("jobs.branch", branch);
  const { data: allocations, error } = await allocationQuery.order("reserved_at", { ascending: false });
  if (error) throw error;

  // What actually left the warehouse, and which report recorded it.
  const { data: movements, error: movementError } = await supabaseAdmin
    .from("stock_movements")
    .select("movement_id, quantity, related_job_part_id, created_at")
    .eq("reason", "job_usage");
  if (movementError) throw movementError;

  const { data: usageLinks, error: usageError } = await supabaseAdmin
    .from("report_parts_used")
    .select("stock_movement_id, field_reports(report_number)");
  if (usageError) throw usageError;

  const reportByMovement = new Map<string, string>();
  (usageLinks ?? []).forEach((link: any) => {
    const report = first(link.field_reports);
    if (link.stock_movement_id && report?.report_number) {
      reportByMovement.set(link.stock_movement_id, report.report_number);
    }
  });

  const usageByJobPart = new Map<
    string,
    { quantity: number; lastAt: string | null; reports: string[] }
  >();
  (movements ?? []).forEach((movement: any) => {
    if (!movement.related_job_part_id) return;
    const current = usageByJobPart.get(movement.related_job_part_id) ?? {
      quantity: 0,
      lastAt: null,
      reports: [],
    };
    current.quantity += Number(movement.quantity) || 0;
    if (movement.created_at && (!current.lastAt || movement.created_at > current.lastAt)) {
      current.lastAt = movement.created_at;
    }
    const reportNumber = reportByMovement.get(movement.movement_id);
    if (reportNumber && !current.reports.includes(reportNumber)) {
      current.reports.push(reportNumber);
    }
    usageByJobPart.set(movement.related_job_part_id, current);
  });

  const jobsById = new Map<string, any>();

  (allocations ?? []).forEach((allocation: any) => {
    const job = first(allocation.jobs);
    if (!job) return;
    const part = first(allocation.parts);
    const usage = usageByJobPart.get(allocation.job_part_id);

    const reservedQuantity = Number(allocation.quantity) || 0;
    const usedQuantity = usage?.quantity ?? 0;
    const isOpen = allocation.status === "reserved";
    // Released stock is derived: the row keeps its reserved quantity, and the
    // status flip is what returns the remainder to available stock.
    const returnedQuantity = isOpen ? 0 : Math.max(0, reservedQuantity - usedQuantity);

    const entry =
      jobsById.get(job.job_id) ??
      {
        jobId: job.job_id,
        jobNumber: job.job_number,
        clientName: first(job.clients)?.name ?? "Unknown client",
        branch: job.branch,
        scheduledDate: job.scheduled_date ? String(job.scheduled_date) : null,
        jobStatus: job.status,
        partsStatus: job.parts_status,
        technicianNames: (Array.isArray(job.job_technicians) ? job.job_technicians : [])
          .filter((assignment: any) => assignment.is_active)
          .map((assignment: any) => {
            const technician = first(assignment.technicians);
            const user = technician ? first(technician.users) : null;
            return user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "";
          })
          .filter(Boolean),
        lines: [],
        summary: {
          partLines: 0,
          totalReserved: 0,
          totalUsed: 0,
          totalReturned: 0,
          openLines: 0,
        },
        outcome: "In progress",
        lastActivityAt: null as string | null,
      };

    entry.lines.push({
      jobPartId: allocation.job_part_id,
      sku: part?.sku ?? "",
      name: part?.name ?? "Unknown item",
      unitOfMeasure: part?.unit_of_measure ?? "",
      reservedQuantity,
      usedQuantity,
      returnedQuantity,
      status: allocation.status,
      reservedAt: allocation.reserved_at ?? null,
      updatedAt: allocation.updated_at ?? null,
      reportNumbers: usage?.reports ?? [],
    });

    entry.summary.partLines += 1;
    entry.summary.totalReserved += reservedQuantity;
    entry.summary.totalUsed += usedQuantity;
    entry.summary.totalReturned += returnedQuantity;
    if (isOpen) entry.summary.openLines += 1;

    const lastActivity = [allocation.reserved_at, allocation.updated_at, usage?.lastAt]
      .filter(Boolean)
      .sort()
      .pop();
    if (lastActivity && (!entry.lastActivityAt || lastActivity > entry.lastActivityAt)) {
      entry.lastActivityAt = lastActivity;
    }

    jobsById.set(job.job_id, entry);
  });

  return [...jobsById.values()]
    .map((entry: any) => {
      const summary = entry.summary;
      let outcome = "Closed";
      if (summary.openLines > 0) outcome = "In progress";
      else if (summary.totalUsed === 0 && summary.totalReturned > 0) outcome = "Fully returned";
      else if (summary.totalReturned === 0) outcome = "Fully used";
      else outcome = "Partly returned";
      return { ...entry, outcome };
    })
    .sort((left: any, right: any) =>
      String(right.lastActivityAt ?? "").localeCompare(String(left.lastActivityAt ?? "")),
    );
}

export async function getCurrentTechnicianId(
  session: Record<string, unknown>,
  db = supabaseAdmin,
) {
  const { data: technician, error } = await db
    .from("technicians")
    .select("technician_id")
    .eq("user_id", session.sub)
    .maybeSingle();

  if (error) throw error;
  if (technician?.technician_id) return technician.technician_id;

  // The signed token carries no branch claim, so read the real branch from the
  // account rather than letting every new technician row default to makati.
  const { data: account, error: accountError } = await db
    .from("users")
    .select("branch")
    .eq("user_id", session.sub)
    .maybeSingle();
  if (accountError) throw accountError;

  const { data: createdTechnician, error: createError } = await db
    .from("technicians")
    .insert({ user_id: session.sub, branch: (account?.branch as string) ?? "makati" })
    .select("technician_id")
    .single();

  if (createError) throw createError;
  return createdTechnician.technician_id;
}
export async function handleListTechnicians({ body }: { body: any }) {
  return response({ technicians: await listTechnicians(String(body.date ?? ""), String(body.excludeOrder ?? "")) });
}

export async function handleListSchedules({ session }: { session: any }) {
  return response({ schedules: await listSchedules(branchScope(session)) });
}

export async function handleGetSchedule({ body, session, db }: { body: any; session: any; db: any }) {
  const schedules = await listSchedules(branchScope(session));
  const job = schedules.find((schedule: { order: string }) => schedule.order === String(body.order ?? ""));
  if (!job) return response({ error: "Scheduled job not found." }, 404);

  // The edit summary shows the quotation's number and who issued it.
  let quotationNumber = "";
  let acceptedByName = "";
  if (job.quotationId) {
    const { data: quotation, error: quotationError } = await db
      .from("quotations")
      .select("quotation_number, accepted_by_name")
      .eq("quotation_id", job.quotationId)
      .maybeSingle();
    if (quotationError) throw quotationError;
    quotationNumber = quotation?.quotation_number ?? "";
    acceptedByName = quotation?.accepted_by_name ?? "";
  }

  return response({ job: { ...job, quotationNumber, acceptedByName } });
}

export async function handleListClients({ body, db }: { body: any; db: any }) {
  const search = String(body.search ?? "").trim().replace(/[(),%]/g, " ").trim();
  let clientQuery = db
    .from("clients")
    .select("client_id, name, first_name, last_name, company_name, client_type, phone, email, address, branch_served")
    .order("name")
    .limit(50);
  if (search) {
    clientQuery = clientQuery.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
  }
  const { data: clients, error: clientError } = await clientQuery;
  if (clientError) throw clientError;
  return response({
    clients: (clients ?? []).map((client: any) => ({
      id: client.client_id,
      name: client.name || [client.first_name, client.last_name].filter(Boolean).join(" ") || "Unnamed client",
      clientType: client.client_type,
      companyName: client.company_name ?? "",
      firstName: client.first_name ?? "",
      lastName: client.last_name ?? "",
      phone: client.phone ?? "",
      email: client.email ?? "",
      address: client.address ?? "",
      branch: client.branch_served,
    })),
  });
}

export async function handleUpdateSchedule({ body, session, db }: { body: any; session: any; db: any }) {
  const order = String(body.order ?? "");
  const serviceType = String(body.serviceType ?? "");
  const date = String(body.date ?? "");
  const startTime = String(body.startTime ?? "");
  const endTime = String(body.endTime ?? "");
  const branch = scopedBranch(session, body.branch);
  const technicianIds: string[] = Array.isArray(body.technicianIds) ? [...new Set<string>(body.technicianIds.map(String).filter(Boolean))] : [];
  if (!order || !date || !startTime || !endTime || !["makati", "cebu"].includes(branch) || new Date(`${date}T${endTime}`) <= new Date(`${date}T${startTime}`)) return response({ error: "Please provide a valid date, branch, and time range." }, 400);
  if (!(await hasOnlyActiveTechnicianRole(technicianIds))) return response({ error: "Only active users with the Technician role can be assigned." }, 400);
  if (technicianIds.length) {
    const { data: booked, error: bookedError } = await db.from("job_technicians").select("technician_id, jobs!inner(job_number, scheduled_date, status)").eq("jobs.scheduled_date", date).neq("jobs.status", "cancelled").eq("is_active", true).neq("jobs.job_number", order).in("technician_id", technicianIds);
    if (bookedError) throw bookedError;
    if ((booked ?? []).length) return response({ error: "One or more selected technicians already have a job on that date." }, 409);
  }
  const { data: job, error: lookupError } = await db.from("jobs").select("job_id, job_number, branch, quotation_id, assignment_confirmed_at").eq("job_number", order).single();
  if (lookupError) throw lookupError;
  // A non-admin works only inside their own branch, including on records
  // created before the branch rule existed.
  if (branchScope(session) !== null && String(job.branch) !== String(session.branch)) {
    return response({ error: "This job belongs to another branch." }, 403);
  }
  // A confirmed job is final: its accepted quotation and held slots must not
  // drift. Corrections belong to the draft phase.
  if (job.assignment_confirmed_at) {
    return response({ error: "This job is confirmed and can no longer be edited." }, 409);
  }
  const siteAddress = String(body.siteAddress ?? "").trim();
  if (!siteAddress) return response({ error: "A site address is required." }, 400);
  // The quotation guard compares the job's branch and service type with the
  // quotation, so a draft's quotation has to move with it.
  if (job.quotation_id) {
    const { error: quoteError } = await db.from("quotations").update({ branch, job_type: jobTypeFor(serviceType), site_address: siteAddress }).eq("quotation_id", job.quotation_id);
    if (quoteError) throw quoteError;
  }
  const { error: updateError } = await db.from("jobs").update({ job_type: jobTypeFor(serviceType), scheduled_date: date, scheduled_time: startTime, scheduled_end_date: date, scheduled_end_time: endTime, branch, site_address: siteAddress, updated_at: new Date().toISOString() }).eq("job_id", job.job_id);
  if (updateError) throw updateError;
  if (Array.isArray(body.technicianIds)) {
    const { data: existingAssignments, error: assignmentsError } = await db.from("job_technicians").select("technician_id, is_active").eq("job_id", job.job_id);
    if (assignmentsError) throw assignmentsError;
    const existingById = new Map<string, boolean>((existingAssignments ?? []).map((assignment: { technician_id: string; is_active: boolean }) => [assignment.technician_id, assignment.is_active] as const));
    const selectedIds = new Set(technicianIds);
    const toInsert = technicianIds.filter((technicianId) => !existingById.has(technicianId));
    const toActivate = technicianIds.filter((technicianId) => existingById.has(technicianId) && !existingById.get(technicianId));
    const toDeactivate = [...existingById.entries()].filter(([technicianId, isActive]) => isActive && !selectedIds.has(technicianId)).map(([technicianId]) => technicianId);
    if (toInsert.length) {
      const { error } = await db.from("job_technicians").insert(toInsert.map((technicianId) => ({ job_id: job.job_id, technician_id: technicianId, is_active: true })));
      if (error) throw error;
    }
    if (toActivate.length) {
      const { error } = await db.from("job_technicians").update({ is_active: true }).eq("job_id", job.job_id).in("technician_id", toActivate);
      if (error) throw error;
    }
    if (toDeactivate.length) {
      const { error } = await db.from("job_technicians").update({ is_active: false }).eq("job_id", job.job_id).in("technician_id", toDeactivate);
      if (error) throw error;
    }
  }
  return response({ message: "Schedule updated." });
}

export async function handleConfirmJobAssignment({ body, session, db }: { body: any; session: any; db: any }) {
  const jobNumber = String(body.jobNumber ?? "").trim();
  if (!jobNumber) return response({ error: "A work order number is required." }, 400);

  const { data: confirmation, error } = await db.rpc("gioms_confirm_job_assignment", {
    p_job_number: jobNumber,
    p_actor: String(session.sub),
  });
  if (error) return response({ error: error.message }, 409);

  return response({
    message: confirmation?.alreadyConfirmed
      ? "Assignment already confirmed."
      : "Assignment confirmed.",
    jobNumber: confirmation?.jobNumber ?? jobNumber,
    confirmedAt: confirmation?.confirmedAt ?? null,
    quotationNumber: confirmation?.quotationNumber ?? "",
  });
}

export async function handleCreateJobFromTemplate({ body, session, db }: { body: any; session: any; db: any }) {
  const technicianIds = Array.isArray(body.technicianIds)
    ? [...new Set<string>(body.technicianIds.map(String).filter(Boolean))]
    : [];

  // The representative is always the signed-in account, never a value the
  // browser supplies. The token carries no name, so read it from the user row.
  const { data: actor, error: actorError } = await db
    .from("users")
    .select("first_name, last_name")
    .eq("user_id", session.sub)
    .maybeSingle();
  if (actorError) throw actorError;
  const acceptedByName = [actor?.first_name, actor?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (!acceptedByName) {
    return response({ error: "Your account has no name on record. Update your profile before creating a quote." }, 409);
  }

  const { data: created, error: createError } = await db.rpc("gioms_create_job_from_template", {
    p_client_id: body.clientId ? String(body.clientId) : null,
    p_first_name: String(body.firstName ?? ""),
    p_last_name: String(body.lastName ?? ""),
    p_client_type: String(body.clientType ?? ""),
    p_company_name: String(body.companyName ?? ""),
    p_email: String(body.email ?? ""),
    p_phone: String(body.phone ?? ""),
    p_site_address: String(body.siteAddress ?? ""),
    p_template_id: body.templateId ? String(body.templateId) : null,
    p_accepted_by_name: acceptedByName,
    p_date: body.date ? String(body.date) : null,
    p_start_time: body.startTime ? String(body.startTime) : null,
    p_end_time: body.endTime ? String(body.endTime) : null,
    p_branch: scopedBranch(session, body.branch),
    p_technician_ids: technicianIds.length ? technicianIds : null,
    p_actor: session.sub,
  });
  if (createError) return response({ error: createError.message }, 400);
  return response({ job: created }, 201);
}

export async function handleCreateSchedule({ body, session, db }: { body: any; session: any; db: any }) {
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const clientType = String(body.clientType ?? "Individual").toLowerCase();
  const companyName = String(body.companyName ?? "").trim();
  const address = String(body.address ?? "").trim();
  const contactEmail = String(body.contactEmail ?? "").trim().toLowerCase();
  const phoneNumber = String(body.phoneNumber ?? "").trim();
  const serviceType = String(body.serviceType ?? "");
  const date = String(body.date ?? "");
  const startTime = String(body.startTime ?? "");
  const endTime = String(body.endTime ?? "");
  const branch = scopedBranch(session, body.branch);
  const technicianIds: string[] = Array.isArray(body.technicianIds) ? [...new Set<string>(body.technicianIds.map(String).filter(Boolean))] : [];
  if (!firstName || !lastName || !address || !contactEmail || !phoneNumber || !date || !startTime || !endTime || !["makati", "cebu"].includes(branch) || new Date(`${date}T${endTime}`) <= new Date(`${date}T${startTime}`)) return response({ error: "Please provide all required job details and a valid time range." }, 400);
  if (!(await hasOnlyActiveTechnicianRole(technicianIds))) return response({ error: "Only active users with the Technician role can be assigned." }, 400);

  if (technicianIds.length) {
    const { data: booked, error: bookedError } = await db.from("job_technicians").select("technician_id, jobs!inner(scheduled_date, status)").eq("jobs.scheduled_date", date).neq("jobs.status", "cancelled").eq("is_active", true).in("technician_id", technicianIds);
    if (bookedError) throw bookedError;
    if ((booked ?? []).length) return response({ error: "One or more selected technicians already have a job on that date." }, 409);
  }

  const { data: client, error: clientError } = await db.from("clients").insert({ first_name: firstName, last_name: lastName, company_name: clientType === "company" ? companyName : null, name: clientType === "company" ? companyName : `${firstName} ${lastName}`, client_type: clientType, contact_channel: "website", branch_served: branch, phone: phoneNumber, email: contactEmail, address }).select("client_id").single();
  if (clientError) throw clientError;
  const { data: job, error: jobError } = await db.from("jobs").insert({ client_id: client.client_id, job_type: jobTypeFor(serviceType), status: "scheduled", branch, scheduled_date: date, scheduled_time: startTime, scheduled_end_date: date, scheduled_end_time: endTime, created_by: session.sub }).select("job_id, job_number").single();
  if (jobError) throw jobError;
  if (technicianIds.length) {
    const { error: assignmentError } = await db.from("job_technicians").insert(technicianIds.map((technicianId) => ({ job_id: job.job_id, technician_id: technicianId, is_active: true })));
    if (assignmentError) throw assignmentError;
  }
  return response({ job: { id: job.job_id, order: job.job_number } }, 201);
}

export async function handleDeleteJob({ body, session, db }: { body: any; session: any; db: any }) {
  const jobNumber = String(body.jobNumber ?? "").trim();
  if (!jobNumber) return response({ error: "Choose a draft to remove." }, 400);
  const passwordError = await passwordConfirmationError(session, String(body.password ?? ""));
  if (passwordError) return response({ error: passwordError }, 401);

  const { data: job, error } = await db
    .from("jobs")
    .select("job_id, job_number, branch, quotation_id, status, parts_status, assignment_confirmed_at")
    .eq("job_number", jobNumber)
    .maybeSingle();
  if (error) throw error;
  if (!job) return response({ error: "Job not found." }, 404);
  if (branchScope(session) !== null && String(job.branch) !== String(session.branch)) {
    return response({ error: "This job belongs to another branch." }, 403);
  }
  if (job.status === "cancelled") return response({ error: "This job is already cancelled." }, 409);
  if (job.assignment_confirmed_at || job.parts_status !== "pending") {
    return response({ error: "Only a draft job can be deleted. Confirm or cancel it instead." }, 409);
  }

  const [{ count: reports }, { count: invoices }, { count: movements }, { count: reservations }] =
    await Promise.all([
      db.from("field_reports").select("job_id", { count: "exact", head: true }).eq("job_id", job.job_id),
      db.from("invoices").select("job_id", { count: "exact", head: true }).eq("job_id", job.job_id),
      db.from("stock_movements").select("related_job_id", { count: "exact", head: true }).eq("related_job_id", job.job_id),
      db.from("job_parts").select("job_id", { count: "exact", head: true }).eq("job_id", job.job_id),
    ]);
  const blockers = [
    reports ? String(reports) + " report" + (reports === 1 ? "" : "s") : "",
    invoices ? String(invoices) + " invoice" + (invoices === 1 ? "" : "s") : "",
    movements ? String(movements) + " stock movement" + (movements === 1 ? "" : "s") : "",
    reservations ? String(reservations) + " stock reservation" + (reservations === 1 ? "" : "s") : "",
  ].filter(Boolean);
  if (blockers.length) {
    return response({ error: "This job has " + blockers.join(", ") + " and cannot be deleted." }, 409);
  }

  // The job points at its quotation, so the job has to go first; quotation
  // lines cascade.
  const { error: deleteError } = await db.from("jobs").delete().eq("job_id", job.job_id);
  if (deleteError) throw deleteError;
  if (job.quotation_id) {
    // The quotation-line guard reads its parent, so the lines must be removed
    // while the quotation still exists; then the quotation itself can go.
    const { error: lineError } = await db
      .from("quotation_line_items")
      .delete()
      .eq("quotation_id", job.quotation_id);
    if (lineError) throw lineError;
    const { error: quoteError } = await db
      .from("quotations")
      .delete()
      .eq("quotation_id", job.quotation_id);
    if (quoteError) throw quoteError;
  }
  return response({ message: job.job_number + " was deleted." });
}

export async function handleListPendingJobRequests({ session }: { session: any }) {
  return response({ jobs: await listPendingJobRequests(branchScope(session)) });
}

export async function handleListJobAllocationHistory({ session }: { session: any }) {
  return response({ allocations: await listJobAllocationHistory(branchScope(session)) });
}

export async function handleListJobAllocationStock({ body, session, db }: { body: any; session: any; db: any }) {
  const jobNumber = String(body.jobNumber ?? "").trim();
  if (!jobNumber) return response({ error: "A work order number is required." }, 400);
  const { data: job, error: jobError } = await db
    .from("jobs")
    .select("job_id, job_number, quotation_id, branch, scheduled_date, scheduled_time, status, parts_status, clients(name, address), job_technicians(is_active, technicians(users(first_name, last_name)))")
    .eq("job_number", jobNumber)
    .maybeSingle();
  if (jobError) throw jobError;
  if (!job) return response({ error: "Scheduled job not found." }, 404);
  if (branchScope(session) !== null && String(job.branch) !== String(session.branch)) {
    return response({ error: "This job belongs to another branch." }, 403);
  }
  if (job.status === "cancelled") return response({ error: "Cancelled jobs cannot receive stock." }, 409);

  const { data: existingMovements, error: existingMovementsError } = await db
    .from("stock_movements")
    .select("movement_id")
    .eq("related_job_id", job.job_id)
    .eq("reason", "job_usage")
    .limit(1);
  if (existingMovementsError) throw existingMovementsError;
  if (existingMovements?.length || job.parts_status !== "pending") {
    return response({
      job: { jobId: job.job_id, jobNumber: job.job_number, allocated: true },
      items: [],
    });
  }

  const client = Array.isArray(job.clients) ? job.clients[0] : job.clients;
  const assignments = (Array.isArray(job.job_technicians) ? job.job_technicians : [job.job_technicians]).filter((assignment: any) => assignment?.is_active);
  const technicianNames = assignments.map((assignment: any) => {
    const technician = Array.isArray(assignment.technicians) ? assignment.technicians[0] : assignment.technicians;
    const user = technician && (Array.isArray(technician.users) ? technician.users[0] : technician.users);
    return user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "Unknown technician";
  });
  // The quotation is what the client was sold, so its part lines are the
  // warehouse's starting point. Aggregated by part in case one part appears
  // on more than one quoted line.
  const quotedByPart = new Map<string, { partId: string; description: string; quantity: number }>();
  let quotationNumber = "";
  if (job.quotation_id) {
    const { data: quotation, error: quotationError } = await db
      .from("quotations")
      .select("quotation_number")
      .eq("quotation_id", job.quotation_id)
      .maybeSingle();
    if (quotationError) throw quotationError;
    quotationNumber = quotation?.quotation_number ?? "";

    const { data: quotedLines, error: quotedError } = await db
      .from("quotation_line_items")
      .select("part_id, description, quantity")
      .eq("quotation_id", job.quotation_id)
      .eq("line_type", "parts");
    if (quotedError) throw quotedError;
    (quotedLines ?? []).forEach((line: any) => {
      if (!line.part_id) return;
      const quantity = Number(line.quantity) || 0;
      const existing = quotedByPart.get(line.part_id);
      if (existing) {
        existing.quantity = Math.round((existing.quantity + quantity) * 100) / 100;
      } else {
        quotedByPart.set(line.part_id, {
          partId: line.part_id,
          description: line.description ?? "",
          quantity,
        });
      }
    });
  }

  const { data: items, error: inventoryError } = await db
    .from("stock")
    .select("stock_id, part_id, branch, quantity_on_hand, quantity_reserved, parts!inner(part_id, sku, name, category, unit_of_measure, reorder_threshold, unit_cost, address, notes)")
    .eq("branch", job.branch)
    .eq("parts.is_active", true)
    .order("stock_id");
  if (inventoryError) throw inventoryError;
  return response({
    job: {
      jobId: job.job_id,
      jobNumber: job.job_number,
      branch: job.branch,
      scheduledDate: String(job.scheduled_date),
      scheduledTime: String(job.scheduled_time ?? "").slice(0, 5),
      location: job.site_address || client?.address || `${String(job.branch).replace(/^./, (letter) => letter.toUpperCase())} branch`,
      technicianName: technicianNames.length ? technicianNames.join(", ") : "Unassigned",
    },
    items: items ?? [],
    quotationNumber,
    quotedParts: Array.from(quotedByPart.values()),
  });
}

export async function handleAllocateJobStock({ body, session, db }: { body: any; session: any; db: any }) {
  const jobNumber = String(body.jobNumber ?? "").trim();
  const requestedItems = Array.isArray(body.items) ? body.items : [];
  const allocations = requestedItems.map((item: any) => ({
    stockId: String(item?.stockId ?? ""),
    quantity: Number(item?.quantity),
  }));
  if (!jobNumber || !allocations.length || allocations.length > 50 || allocations.some((item: any) => !item.stockId || !Number.isInteger(item.quantity) || item.quantity <= 0) || new Set(allocations.map((item: any) => item.stockId)).size !== allocations.length) {
    return response({ error: "Select valid stock items and quantities for this job." }, 400);
  }

  const { data: job, error: jobError } = await db
    .from("jobs")
    .select("job_id, branch, status, parts_status")
    .eq("job_number", jobNumber)
    .maybeSingle();
  if (jobError) throw jobError;
  if (!job) return response({ error: "Scheduled job not found." }, 404);
  if (job.status === "cancelled") return response({ error: "Cancelled jobs cannot receive stock." }, 409);
  if (job.parts_status !== "pending") return response({ error: "Stock has already been reserved for this job." }, 409);

  const { data: existingMovements, error: existingMovementsError } = await db
    .from("stock_movements")
    .select("movement_id")
    .eq("related_job_id", job.job_id)
    .eq("reason", "job_usage")
    .limit(1);
  if (existingMovementsError) throw existingMovementsError;
  if (existingMovements?.length) return response({ error: "Stock has already been allocated to this job." }, 409);

  const { data: stockRows, error: stockError } = await db
    .from("stock")
    .select("stock_id, part_id, branch, quantity_on_hand, quantity_reserved")
    .in("stock_id", allocations.map((item: any) => item.stockId));
  if (stockError) throw stockError;
  if ((stockRows ?? []).length !== allocations.length || stockRows.some((stock: any) => stock.branch !== job.branch)) {
    return response({ error: "One or more selected items are unavailable at the job's branch." }, 409);
  }
  const stockById = new Map<string, { part_id: string; quantity_on_hand: number; quantity_reserved: number }>();
  (stockRows ?? []).forEach((stock: any) => stockById.set(stock.stock_id, stock));
  for (const item of allocations) {
    const stock = stockById.get(item.stockId);
    if (!stock) return response({ error: "One or more selected items are unavailable at the job's branch." }, 409);
    if (item.quantity > stock.quantity_on_hand - stock.quantity_reserved) {
      return response({ error: "An issue quantity exceeds the available stock." }, 400);
    }
  }

  const { data: reservation, error: reservationError } = await db.rpc(
    "gioms_reserve_job_stock",
    {
      p_job_number: jobNumber,
      p_items: allocations.map((item: any) => ({
        stockId: item.stockId,
        quantity: item.quantity,
      })),
      p_reserved_by: String(session.sub ?? ""),
    },
  );
  if (reservationError) {
    return response({ error: reservationError.message }, 409);
  }
  return response(reservation ?? { message: "Stock reserved for the job." });
}
