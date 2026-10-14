declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};
declare const btoa: (value: string) => string;
declare const atob: (value: string) => string;

// @ts-ignore - This editor is not running the Deno runtime, so these edge runtime shims are not available here.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore - The npm: specifier resolves correctly in the deployed Supabase Edge runtime.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const rolePermissions: Record<string, Array<[string, string]>> = {
  Admin: [["scheduling", "approve"], ["inventory", "approve"], ["field_reporting", "approve"], ["sales_billing", "approve"], ["admin", "approve"]],
  "Service Manager": [["scheduling", "edit"], ["field_reporting", "edit"]],
  "Sales Manager": [["scheduling", "edit"], ["field_reporting", "edit"]],
  Technician: [["field_reporting", "edit"]],
  "Warehouse Manager": [["inventory", "edit"]],
  "Billing Staff": [["sales_billing", "edit"]],
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const iterations = 120000;

function toBase64Url(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derivePassword(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const saltBuffer = new Uint8Array(salt.length);
  saltBuffer.set(salt);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: saltBuffer, iterations, hash: "SHA-256" }, key, 256);
  return new Uint8Array(bits);
}

async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt);
  return `pbkdf2_sha256$${iterations}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterationText, saltText, hashText] = storedHash.split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterationText || !saltText || !hashText) return false;
  const salt = fromBase64Url(saltText);
  const expected = fromBase64Url(hashText);
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: Number(iterationText), hash: "SHA-256" }, key, expected.length * 8);
  const actual = new Uint8Array(bits);
  return actual.length === expected.length && actual.every((byte, index) => byte === expected[index]);
}

async function signToken(payload: Record<string, unknown>) {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = toBase64Url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey("raw", encoder.encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${header}.${body}`));
  return `${header}.${body}.${toBase64Url(new Uint8Array(signature))}`;
}

async function verifyToken(request: Request) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) return null;
  const key = await crypto.subtle.importKey("raw", encoder.encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(signature), encoder.encode(`${header}.${body}`));
  if (!valid) return null;
  const payload = JSON.parse(decoder.decode(fromBase64Url(body)));
  return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
}

async function ensureRole(roleName: string) {
  const { data: existing, error: selectError } = await supabase.from("roles").select("role_id").eq("role_name", roleName).maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing.role_id;
  const { data, error } = await supabase.from("roles").insert({ role_name: roleName }).select("role_id").single();
  if (error) throw error;
  return data.role_id;
}

async function ensureRoles() {
  const roleIds: Record<string, string> = {};
  for (const roleName of Object.keys(rolePermissions)) {
    roleIds[roleName] = await ensureRole(roleName);
    const { data: existingPermissions, error: permissionError } = await supabase.from("module_permissions").select("module").eq("role_id", roleIds[roleName]);
    if (permissionError) throw permissionError;
    const existingModules = new Set((existingPermissions ?? []).map((permission: { module: string }) => permission.module));
    const missing = rolePermissions[roleName].filter(([module]) => !existingModules.has(module)).map(([module, access_level]) => ({ role_id: roleIds[roleName], module, access_level }));
    if (missing.length) {
      const { error } = await supabase.from("module_permissions").insert(missing);
      if (error) throw error;
    }
  }
  return roleIds;
}

async function userResponse(user: Record<string, unknown>, roleName: string) {
  const token = await signToken({ sub: user.user_id, role: roleName, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 });
  return { token, user: { id: user.user_id, name: [user.first_name, user.last_name].filter(Boolean).join(" "), email: user.email, branch: user.branch, role: roleName } };
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function isSchedulingRole(role: string) {
  return rolePermissions[role]?.some(([module]) => module === "scheduling") ?? false;
}

const schedulingActions = new Set(["list-technicians", "list-schedules", "create-schedule", "get-schedule", "update-schedule"]);
const fieldReportActions = new Set(["list-field-report-jobs", "list-field-reports", "submit-field-report"]);
const inventoryActions = new Set(["list-inventory", "create-inventory-item", "adjust-inventory-stock", "update-inventory-item"]);
const jobAllocationActions = new Set(["list-pending-job-requests", "list-job-allocation-stock", "allocate-job-stock", "list-job-allocation-history"]);

function jobTypeFor(serviceType: string) {
  if (serviceType === "Installation") return "installation";
  if (serviceType === "Preventive maintenance") return "maintenance";
  return "repair";
}

async function ensureTechnicianRecord(user: Record<string, unknown>) {
  const { data: existing, error: lookupError } = await supabase.from("technicians").select("technician_id").eq("user_id", user.user_id).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing.technician_id;
  const { data, error } = await supabase.from("technicians").insert({ user_id: user.user_id, branch: user.branch }).select("technician_id").single();
  if (error) throw error;
  return data.technician_id;
}

function isFieldReportRole(role: string) {
  return rolePermissions[role]?.some(([module]) => module === "field_reporting") ?? false;
}
async function listTechnicians(date: string, excludeOrder = "") {
  const { data: users, error } = await supabase
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
  let bookedQuery = supabase
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

async function hasOnlyActiveTechnicianRole(technicianIds: string[]) {
  if (!technicianIds.length) return true;
  const { data: users, error } = await supabase
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

async function listSchedules() {
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("job_id, job_number, job_type, status, branch, scheduled_date, scheduled_time, clients(name, address), job_technicians(technician_id, is_active, technicians(users(first_name, last_name)))")
    .neq("status", "cancelled")
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
      service: job.job_type === "maintenance" ? "Preventive maintenance" : job.job_type === "installation" ? "Installation" : "Service call",
      location: client?.address ?? `${String(job.branch).replace(/^./, (letter) => letter.toUpperCase())} branch`,
      technician: technicians.length ? technicians.map((technician: { name: string }) => technician.name).join(", ") : "Unassigned",
      technicians,
      stock: "Available",
    };
  });
}

async function listPendingJobRequests() {
  const schedules = await listSchedules();
  const { data: stockMovements, error } = await supabase
    .from("stock_movements")
    .select("related_job_id")
    .eq("reason", "job_usage")
    .not("related_job_id", "is", null);
  if (error) throw error;
  const allocatedJobIds = new Set(
    (stockMovements ?? []).map((movement: { related_job_id: string }) => movement.related_job_id),
  );
  const { data: confirmedJobs, error: confirmedJobsError } = await supabase
    .from("jobs")
    .select("job_id")
    .neq("parts_status", "pending");
  if (confirmedJobsError) throw confirmedJobsError;
  const confirmedJobIds = new Set(
    (confirmedJobs ?? []).map((job: { job_id: string }) => job.job_id),
  );

  return schedules
    .filter((job: any) =>
      job.status === "scheduled" &&
      job.technicians.length > 0 &&
      !allocatedJobIds.has(job.id) &&
      !confirmedJobIds.has(job.id)
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

async function listJobAllocationHistory() {
  const { data: allocations, error } = await supabase
    .from("job_parts")
    .select("job_part_id, quantity, status, reserved_at, parts!inner(sku, name), jobs!inner(job_number, job_technicians(is_active, technicians(users(first_name, last_name))))")
    .order("reserved_at", { ascending: false });
  if (error) throw error;

  return (allocations ?? []).map((allocation: any) => {
    const job = Array.isArray(allocation.jobs) ? allocation.jobs[0] : allocation.jobs;
    const part = Array.isArray(allocation.parts) ? allocation.parts[0] : allocation.parts;
    const assignments = Array.isArray(job?.job_technicians)
      ? job.job_technicians
      : job?.job_technicians
        ? [job.job_technicians]
        : [];
    const technicianNames = assignments
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

    return {
      id: allocation.job_part_id,
      date: allocation.reserved_at,
      job: job?.job_number ?? "Unknown job",
      item: part?.name ?? "Unknown item",
      code: part?.sku ?? "",
      quantity: allocation.quantity,
      status: allocation.status,
      technician: technicianNames.join(", ") || "Unassigned",
    };
  });
}

async function getCurrentTechnicianId(session: Record<string, unknown>) {
  const { data: technician, error } = await supabase
    .from("technicians")
    .select("technician_id")
    .eq("user_id", session.sub)
    .maybeSingle();

  if (error) throw error;
  if (technician?.technician_id) return technician.technician_id;

  const { data: createdTechnician, error: createError } = await supabase
    .from("technicians")
    .insert({ user_id: session.sub, branch: (session.branch as string) ?? "makati" })
    .select("technician_id")
    .single();

  if (createError) throw createError;
  return createdTechnician.technician_id;
}

async function listFieldReportJobs(session: Record<string, unknown>) {
  let query = supabase
    .from("jobs")
    .select("job_id, job_number, job_type, branch, scheduled_date, scheduled_time, clients(name, address), job_parts(job_part_id, quantity, status, parts(sku, name)), job_technicians!inner(technician_id, is_active, technicians!inner(user_id, users(first_name, last_name)))")
    .eq("job_technicians.is_active", true)
    .neq("status", "cancelled")
    .order("scheduled_date")
    .order("scheduled_time");

  const technicianRoles = new Set(["Technician", "Service Manager", "Sales Manager"]);
  if (technicianRoles.has(String(session.role ?? ""))) {
    query = query.eq("job_technicians.technicians.user_id", session.sub);
  }

  const { data: jobs, error } = await query;
  if (error) throw error;

  const reportedJobIds = new Set<string>();
  const technicianId = await getCurrentTechnicianId(session);
  const { data: submittedReports, error: submittedReportError } = await supabase
    .from("field_reports")
    .select("job_id")
    .eq("technician_id", technicianId);

  if (submittedReportError) throw submittedReportError;
  (submittedReports ?? []).forEach((report: { job_id: string }) => {
    if (report.job_id) reportedJobIds.add(report.job_id);
  });

  const { data: stockMovements, error: stockMovementError } = await supabase
    .from("stock_movements")
    .select("related_job_id")
    .eq("reason", "job_usage")
    .not("related_job_id", "is", null);
  if (stockMovementError) throw stockMovementError;
  const allocatedJobIds = new Set(
    (stockMovements ?? []).map((movement: { related_job_id: string }) => movement.related_job_id),
  );

  return (jobs ?? [])
    .filter((job: any) =>
      (allocatedJobIds.has(job.job_id) ||
        job.job_type === "maintenance" ||
        (job.job_parts ?? []).some((part: any) => part.status === "reserved")) &&
      !reportedJobIds.has(job.job_id)
    )
    .map((job: any) => {
      const client = Array.isArray(job.clients) ? job.clients[0] : job.clients;
      const assignment = Array.isArray(job.job_technicians) ? job.job_technicians[0] : job.job_technicians;
      const technician = assignment && (Array.isArray(assignment.technicians) ? assignment.technicians[0] : assignment.technicians);
      const user = technician && (Array.isArray(technician.users) ? technician.users[0] : technician.users);
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
      return {
        jobId: job.job_id,
        jobNumber: job.job_number,
        clientName: client?.name ?? "Unnamed client",
        serviceType: job.job_type,
        serviceLabel: job.job_type === "maintenance" ? "Preventive maintenance" : job.job_type === "installation" ? "Installation" : "Service call",
        siteAddress: client?.address ?? `${String(job.branch).replace(/^./, (letter) => letter.toUpperCase())} branch`,
        technicianName: user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "Unassigned",
        serviceDate: String(job.scheduled_date),
        arrivalTime: String(job.scheduled_time ?? "").slice(0, 5),
        reservedParts,
      };
    });
}

async function listFieldReports(session: Record<string, unknown>) {
  const { data: reports, error } = await supabase
    .from("field_reports")
    .select(`
      report_id,
      report_number,
      job_id,
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
      report_parts_used(quantity, parts(sku, name)),
      jobs!inner(job_id, job_number, job_type, clients(name, address)),
      technicians!inner(technician_id, user_id, users(first_name, last_name))
    `)
    .in("review_status", ["submitted", "approved", "returned"])
    .order("submitted_at", { ascending: false });

  if (error) throw error;

  const reportedJobIds = new Set((reports ?? []).map((report: any) => report.job_id));
  const { data: reservedJobs, error: reservedJobsError } = await supabase
    .from("jobs")
    .select("job_id, job_number, job_type, branch, scheduled_date, scheduled_time, parts_confirmed_at, clients(name, address), job_parts!inner(job_part_id, quantity, status, reserved_at, parts(sku, name)), job_technicians(is_active, technicians(users(first_name, last_name)))")
    .eq("parts_status", "confirmed")
    .eq("job_parts.status", "reserved")
    .neq("status", "cancelled")
    .order("parts_confirmed_at", { ascending: false });
  if (reservedJobsError) throw reservedJobsError;

  const pendingReportItems = (reservedJobs ?? [])
    .filter((job: any) => !reportedJobIds.has(job.job_id))
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
        service: job.job_type === "maintenance" ? "Preventive maintenance" : job.job_type === "installation" ? "Installation" : "Service call",
        technician: technicianNames.join(", ") || "Unassigned",
        time: displayTime,
        status: "Awaiting Report",
        tone: "gray",
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

  const submittedReportItems = (reports ?? []).map((report: any) => {
    const job = Array.isArray(report.jobs) ? report.jobs[0] : report.jobs;
    const client = job && (Array.isArray(job.clients) ? job.clients[0] : job.clients);
    const technician = Array.isArray(report.technicians) ? report.technicians[0] : report.technicians;
    const user = technician && (Array.isArray(technician.users) ? technician.users[0] : technician.users);
    const submittedAt = report.submitted_at ? new Date(report.submitted_at) : new Date();
    const status = report.review_status === "approved" ? "Ready for Billing" : report.review_status === "returned" ? "Needs Review" : "Submitted";
    const tone = report.review_status === "approved" ? "green" : report.review_status === "returned" ? "orange" : "gray";
    const reportId = String(report.report_number || report.report_id);

    return {
      id: reportId,
      client: client?.name ?? "Unknown client",
      service: job?.job_type === "maintenance" ? "Preventive maintenance" : job?.job_type === "installation" ? "Installation" : "Service call",
      technician: user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "Unknown technician",
      time: submittedAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      status,
      tone,
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
      images: [],
      signature: {
        signer: report.client_signoff_name || "Not provided",
        signedAt: report.submitted_at ? new Date(report.submitted_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Pending sign-off",
        method: report.client_signoff ? "Signed on device" : "Awaiting client sign-off",
      },
      billing: {
        readiness: report.review_status === "approved" ? "Ready for billing" : report.review_status === "returned" ? "Needs revision" : "Awaiting review",
        inventory: report.review_status === "approved" ? "Reconciled" : "Pending",
        reference: report.report_number || "Not assigned",
      },
      audit: [
        { time: submittedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }), action: "Report submitted", actor: user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "Unknown technician" },
      ],
      jobId: job?.job_id ?? null,
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

async function submitFieldReport(session: Record<string, unknown>, body: Record<string, any>) {
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

  const technicianId = await getCurrentTechnicianId(session);
  const { data: existingReport, error: existingReportError } = await supabase
    .from("field_reports")
    .select("report_id")
    .eq("job_id", jobId)
    .eq("technician_id", technicianId)
    .maybeSingle();

  if (existingReportError) throw existingReportError;
  if (existingReport) {
    throw new Error("A field report has already been submitted for this job. Please submit a new report only when a new job is assigned.");
  }

  const { data: report, error: reportError } = await supabase.rpc(
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
      p_attachments: attachments.map((attachment: any) => ({
        fileUrl: String(attachment?.fileUrl ?? attachment?.url ?? attachment?.dataUrl ?? "").trim(),
      })),
    },
  );

  if (reportError) throw new Error(reportError.message);
  return { report: { id: report.reportId, number: report.reportNumber } };
}


Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);

  try {
    const body = await request.json();
    const action = body.action;

    if (action === "login") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      if (!email || !password) return response({ error: "Email and password are required." }, 400);
      await ensureRoles();
      let { data: user, error } = await supabase.from("users").select("user_id, first_name, last_name, email, password_hash, branch, is_active, roles(role_name)").eq("email", email).maybeSingle();
      if (error) throw error;
      if (!user && email === "admin@gmail.com" && password === "admin123") {
        const roleId = await ensureRole("Admin");
        const passwordHash = await hashPassword(password);
        const created = await supabase.from("users").insert({ first_name: "Website", last_name: "Admin", email, password_hash: passwordHash, role_id: roleId, branch: "makati" }).select("user_id, first_name, last_name, email, password_hash, branch, is_active").single();
        if (created.error) throw created.error;
        user = { ...created.data, roles: { role_name: "Admin" } };
      }
      if (!user || !user.is_active || !(await verifyPassword(password, user.password_hash))) return response({ error: "Invalid email or password." }, 401);
      return response(await userResponse(user, user.roles?.role_name ?? ""));
    }

    const session = await verifyToken(request);
    if (!session) return response({ error: "You must be signed in to perform this action." }, 401);
    const canManageSchedule = schedulingActions.has(action) && isSchedulingRole(session.role);
    const canLoadFieldReports = fieldReportActions.has(action) && isFieldReportRole(session.role);
    const canManageInventory = inventoryActions.has(action) && ["Admin", "Warehouse Manager"].includes(session.role);
    const canAllocateJobStock = jobAllocationActions.has(action) && (isSchedulingRole(session.role) || ["Admin", "Warehouse Manager"].includes(session.role));
    if (action !== "change-password" && !canManageSchedule && !canLoadFieldReports && !canManageInventory && !canAllocateJobStock && session.role !== "Admin") return response({ error: "Administrator access is required." }, 403);

    if (action === "change-password") {
      const currentPassword = String(body.currentPassword ?? "");
      const newPassword = String(body.newPassword ?? "");
      if (newPassword.length < 8) return response({ error: "The new password must be at least 8 characters." }, 400);
      const { data: user, error } = await supabase.from("users").select("password_hash").eq("user_id", session.sub).maybeSingle();
      if (error) throw error;
      if (!user || !(await verifyPassword(currentPassword, user.password_hash))) return response({ error: "Your current password is incorrect." }, 401);
      const { error: updateError } = await supabase.from("users").update({ password_hash: await hashPassword(newPassword), updated_at: new Date().toISOString() }).eq("user_id", session.sub);
      if (updateError) throw updateError;
      return response({ message: "Password updated successfully." });
    }

    if (action === "create-account") {
      const firstName = String(body.firstName ?? "").trim();
      const lastName = String(body.lastName ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const role = String(body.role ?? "");
      const branch = String(body.branch ?? "").trim().toLowerCase();
      if (!firstName || !lastName || !email || password.length < 8 || !rolePermissions[role] || !["makati", "cebu"].includes(branch)) return response({ error: "Please provide valid account details." }, 400);
      const roleIds = await ensureRoles();
      const { data: existingUser, error: existingUserError } = await supabase.from("users").select("user_id, is_active").eq("email", email).maybeSingle();
      if (existingUserError) throw existingUserError;
      if (existingUser?.is_active) return response({ error: "An account with this email address already exists." }, 409);
      if (existingUser) {
        const { data: reactivatedUser, error: reactivateError } = await supabase
          .from("users")
          .update({ first_name: firstName, last_name: lastName, password_hash: await hashPassword(password), role_id: roleIds[role], branch, is_active: true, updated_at: new Date().toISOString() })
          .eq("user_id", existingUser.user_id)
          .select("user_id, first_name, last_name, email, branch, is_active, created_at, roles(role_name)")
          .single();
        if (reactivateError) throw reactivateError;
        if (role === "Technician") await ensureTechnicianRecord(reactivatedUser);
        return response({ account: { id: reactivatedUser.user_id, name: `${reactivatedUser.first_name} ${reactivatedUser.last_name}`, email: reactivatedUser.email, branch: reactivatedUser.branch, role: reactivatedUser.roles?.role_name, status: "Active", createdAt: new Date(reactivatedUser.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) } }, 200);
      }
      const { data, error } = await supabase.from("users").insert({ first_name: firstName, last_name: lastName, email, password_hash: await hashPassword(password), role_id: roleIds[role], branch }).select("user_id, first_name, last_name, email, branch, is_active, created_at, roles(role_name)").single();
      if (error) {
        if (error.code === "23505") return response({ error: "An account with this email address already exists." }, 409);
        throw error;
      }
      if (role === "Technician") await ensureTechnicianRecord(data);
      return response({ account: { id: data.user_id, name: `${data.first_name} ${data.last_name}`, email: data.email, branch: data.branch, role: data.roles?.role_name, status: data.is_active ? "Active" : "Inactive", createdAt: new Date(data.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) } }, 201);
    }

    if (action === "list-users") {
      const { data, error } = await supabase.from("users").select("user_id, first_name, last_name, email, branch, is_active, created_at, roles(role_name)").eq("is_active", true).order("created_at", { ascending: false });
      if (error) throw error;
      return response({ accounts: (data ?? []).map((user: any) => ({ id: user.user_id, name: [user.first_name, user.last_name].filter(Boolean).join(" "), email: user.email, branch: user.branch, role: user.roles?.role_name, status: user.is_active ? "Active" : "Inactive", createdAt: new Date(user.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) })) });
    }

    if (action === "delete-user") {
      const userId = String(body.userId ?? "");
      if (!userId) return response({ error: "A user id is required." }, 400);
      if (userId === session.sub) return response({ error: "You cannot remove your own account." }, 400);
      const { error } = await supabase.from("users").update({ is_active: false, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("is_active", true);
      if (error) throw error;
      return response({ message: "User removed from the active directory." });
    }

    if (action === "list-inventory") {
      const { data, error } = await supabase
        .from("stock")
        .select("stock_id, part_id, branch, quantity_on_hand, quantity_reserved, parts!inner(part_id, sku, name, category, unit_of_measure, reorder_threshold, unit_cost, address, notes)")
        .order("branch")
        .order("stock_id");
      if (error) throw error;
      return response({ items: data ?? [] });
    }

    if (action === "list-pending-job-requests") {
      return response({ jobs: await listPendingJobRequests() });
    }

    if (action === "list-job-allocation-history") {
      return response({ allocations: await listJobAllocationHistory() });
    }

    if (action === "list-job-allocation-stock") {
      const jobNumber = String(body.jobNumber ?? "").trim();
      if (!jobNumber) return response({ error: "A work order number is required." }, 400);
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .select("job_id, job_number, branch, scheduled_date, scheduled_time, status, parts_status, clients(name, address), job_technicians(is_active, technicians(users(first_name, last_name)))")
        .eq("job_number", jobNumber)
        .maybeSingle();
      if (jobError) throw jobError;
      if (!job) return response({ error: "Scheduled job not found." }, 404);
      if (job.status === "cancelled") return response({ error: "Cancelled jobs cannot receive stock." }, 409);

      const { data: existingMovements, error: existingMovementsError } = await supabase
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
      const { data: items, error: inventoryError } = await supabase
        .from("stock")
        .select("stock_id, part_id, branch, quantity_on_hand, quantity_reserved, parts!inner(part_id, sku, name, category, unit_of_measure, reorder_threshold, unit_cost, address, notes)")
        .eq("branch", job.branch)
        .order("stock_id");
      if (inventoryError) throw inventoryError;
      return response({
        job: {
          jobId: job.job_id,
          jobNumber: job.job_number,
          branch: job.branch,
          scheduledDate: String(job.scheduled_date),
          scheduledTime: String(job.scheduled_time ?? "").slice(0, 5),
          location: client?.address ?? `${String(job.branch).replace(/^./, (letter) => letter.toUpperCase())} branch`,
          technicianName: technicianNames.length ? technicianNames.join(", ") : "Unassigned",
        },
        items: items ?? [],
      });
    }

    if (action === "allocate-job-stock") {
      const jobNumber = String(body.jobNumber ?? "").trim();
      const requestedItems = Array.isArray(body.items) ? body.items : [];
      const allocations = requestedItems.map((item: any) => ({
        stockId: String(item?.stockId ?? ""),
        quantity: Number(item?.quantity),
      }));
      if (!jobNumber || !allocations.length || allocations.length > 50 || allocations.some((item: any) => !item.stockId || !Number.isInteger(item.quantity) || item.quantity <= 0) || new Set(allocations.map((item: any) => item.stockId)).size !== allocations.length) {
        return response({ error: "Select valid stock items and quantities for this job." }, 400);
      }

      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .select("job_id, branch, status, parts_status")
        .eq("job_number", jobNumber)
        .maybeSingle();
      if (jobError) throw jobError;
      if (!job) return response({ error: "Scheduled job not found." }, 404);
      if (job.status === "cancelled") return response({ error: "Cancelled jobs cannot receive stock." }, 409);
      if (job.parts_status !== "pending") return response({ error: "Stock has already been reserved for this job." }, 409);

      const { data: existingMovements, error: existingMovementsError } = await supabase
        .from("stock_movements")
        .select("movement_id")
        .eq("related_job_id", job.job_id)
        .eq("reason", "job_usage")
        .limit(1);
      if (existingMovementsError) throw existingMovementsError;
      if (existingMovements?.length) return response({ error: "Stock has already been allocated to this job." }, 409);

      const { data: stockRows, error: stockError } = await supabase
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

      const { data: reservation, error: reservationError } = await supabase.rpc(
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

    if (["create-inventory-item", "update-inventory-item"].includes(action)) {
      const item = body.item && typeof body.item === "object" ? body.item : {};
      const name = String(item.name ?? "").trim();
      const sku = String(item.sku ?? "").trim();
      const category = String(item.category ?? "").trim();
      const unitOfMeasure = String(item.unitOfMeasure ?? "").trim();
      const branch = String(item.branch ?? "").trim().toLowerCase();
      const address = String(item.address ?? "").trim();
      const notes = String(item.notes ?? "").trim();
      const quantity = Number(item.quantity);
      const reorderThreshold = Number(item.reorderThreshold);
      const unitCost = Number(item.unitCost);
      if (!name || !sku || !category || !unitOfMeasure || !address || !["makati", "cebu"].includes(branch) || !Number.isInteger(quantity) || quantity < 0 || !Number.isInteger(reorderThreshold) || reorderThreshold < 0 || !Number.isFinite(unitCost) || unitCost < 0) {
        return response({ error: "Please provide valid item details, branch, stock level, and unit price." }, 400);
      }

      const partValues = {
        sku,
        name,
        category,
        unit_of_measure: unitOfMeasure,
        reorder_threshold: reorderThreshold,
        unit_cost: unitCost,
        address,
        notes: notes || null,
      };

      if (action === "create-inventory-item") {
        const { data: part, error: partError } = await supabase
          .from("parts")
          .insert(partValues)
          .select("part_id")
          .single();
        if (partError) {
          if (partError.code === "23505") return response({ error: "An item with this code already exists." }, 409);
          throw partError;
        }

        const { error: stockError } = await supabase
          .from("stock")
          .insert({ part_id: part.part_id, branch, quantity_on_hand: 0 });
        if (stockError) {
          await supabase.from("parts").delete().eq("part_id", part.part_id);
          throw stockError;
        }

        if (quantity > 0) {
          const { error: movementError } = await supabase.from("stock_movements").insert({
            part_id: part.part_id,
            branch,
            direction: "in",
            quantity,
            reason: "restock",
            performed_by: session.sub,
          });
          if (movementError) {
            await supabase.from("stock").delete().eq("part_id", part.part_id);
            await supabase.from("parts").delete().eq("part_id", part.part_id);
            throw movementError;
          }
        }
        return response({ message: "Inventory item created." }, 201);
      }

      const stockId = String(body.stockId ?? "");
      const partId = String(body.partId ?? "");
      const { data: stock, error: stockLookupError } = await supabase
        .from("stock")
        .select("stock_id, part_id, branch")
        .eq("stock_id", stockId)
        .eq("part_id", partId)
        .maybeSingle();
      if (stockLookupError) throw stockLookupError;
      if (!stock) return response({ error: "This inventory item no longer exists." }, 404);

      if (stock.branch !== branch) {
        const { data: existingStock, error: duplicateBranchError } = await supabase
          .from("stock")
          .select("stock_id")
          .eq("part_id", partId)
          .eq("branch", branch)
          .maybeSingle();
        if (duplicateBranchError) throw duplicateBranchError;
        if (existingStock) return response({ error: "This item already has a stock record for that branch." }, 409);
      }

      const { error: partUpdateError } = await supabase.from("parts").update(partValues).eq("part_id", partId);
      if (partUpdateError) {
        if (partUpdateError.code === "23505") return response({ error: "An item with this code already exists." }, 409);
        throw partUpdateError;
      }
      if (stock.branch !== branch) {
        const { error: branchUpdateError } = await supabase.from("stock").update({ branch }).eq("stock_id", stockId);
        if (branchUpdateError) throw branchUpdateError;
      }
      return response({ message: "Inventory item updated." });
    }

    if (action === "adjust-inventory-stock") {
      const stockId = String(body.stockId ?? "");
      const direction = String(body.direction ?? "");
      const quantity = Number(body.quantity);
      if (!stockId || !["in", "out"].includes(direction) || !Number.isInteger(quantity) || quantity <= 0) {
        return response({ error: "Enter a valid stock quantity and direction." }, 400);
      }

      const { data: stock, error: stockLookupError } = await supabase
        .from("stock")
        .select("part_id, branch, quantity_on_hand")
        .eq("stock_id", stockId)
        .maybeSingle();
      if (stockLookupError) throw stockLookupError;
      if (!stock) return response({ error: "This inventory item no longer exists." }, 404);
      if (direction === "out" && quantity > stock.quantity_on_hand) {
        return response({ error: "The quantity removed cannot exceed current stock." }, 400);
      }

      const { error: movementError } = await supabase.from("stock_movements").insert({
        part_id: stock.part_id,
        branch: stock.branch,
        direction,
        quantity,
        reason: "adjustment",
        performed_by: session.sub,
      });
      if (movementError) throw movementError;
      return response({ message: "Stock quantity updated." });
    }

    if (action === "list-technicians") {
      return response({ technicians: await listTechnicians(String(body.date ?? ""), String(body.excludeOrder ?? "")) });
    }

    if (action === "list-schedules") {
      return response({ schedules: await listSchedules() });
    }

    if (action === "list-field-report-jobs") {
      return response({ jobs: await listFieldReportJobs(session) });
    }

    if (action === "list-field-reports") {
      return response({ reports: await listFieldReports(session) });
    }

    if (action === "submit-field-report") {
      try {
        const result = await submitFieldReport(session, body || {});
        return response(result, 201);
      } catch (error) {
        console.error("Field report submission failed:", error);
        return response({
          error: error instanceof Error ? error.message : "Unable to submit the field report.",
        }, 400);
      }
    }
    

    if (action === "get-schedule") {
      const schedules = await listSchedules();
      const job = schedules.find((schedule: { order: string }) => schedule.order === String(body.order ?? ""));
      return job ? response({ job }) : response({ error: "Scheduled job not found." }, 404);
    }

    if (action === "update-schedule") {
      const order = String(body.order ?? "");
      const serviceType = String(body.serviceType ?? "");
      const date = String(body.date ?? "");
      const startTime = String(body.startTime ?? "");
      const endTime = String(body.endTime ?? "");
      const branch = String(body.branch ?? "").trim().toLowerCase();
      const technicianIds: string[] = Array.isArray(body.technicianIds) ? [...new Set<string>(body.technicianIds.map(String).filter(Boolean))] : [];
      if (!order || !date || !startTime || !endTime || !["makati", "cebu"].includes(branch) || new Date(`${date}T${endTime}`) <= new Date(`${date}T${startTime}`)) return response({ error: "Please provide a valid date, branch, and time range." }, 400);
      if (!(await hasOnlyActiveTechnicianRole(technicianIds))) return response({ error: "Only active users with the Technician role can be assigned." }, 400);
      if (technicianIds.length) {
        const { data: booked, error: bookedError } = await supabase.from("job_technicians").select("technician_id, jobs!inner(job_number, scheduled_date, status)").eq("jobs.scheduled_date", date).neq("jobs.status", "cancelled").eq("is_active", true).neq("jobs.job_number", order).in("technician_id", technicianIds);
        if (bookedError) throw bookedError;
        if ((booked ?? []).length) return response({ error: "One or more selected technicians already have a job on that date." }, 409);
      }
      const { data: job, error: lookupError } = await supabase.from("jobs").select("job_id").eq("job_number", order).single();
      if (lookupError) throw lookupError;
      const { error: updateError } = await supabase.from("jobs").update({ job_type: jobTypeFor(serviceType), scheduled_date: date, scheduled_time: startTime, scheduled_end_date: date, scheduled_end_time: endTime, branch, updated_at: new Date().toISOString() }).eq("job_id", job.job_id);
      if (updateError) throw updateError;
      if (Array.isArray(body.technicianIds)) {
        const { data: existingAssignments, error: assignmentsError } = await supabase.from("job_technicians").select("technician_id, is_active").eq("job_id", job.job_id);
        if (assignmentsError) throw assignmentsError;
        const existingById = new Map<string, boolean>((existingAssignments ?? []).map((assignment: { technician_id: string; is_active: boolean }) => [assignment.technician_id, assignment.is_active] as const));
        const selectedIds = new Set(technicianIds);
        const toInsert = technicianIds.filter((technicianId) => !existingById.has(technicianId));
        const toActivate = technicianIds.filter((technicianId) => existingById.has(technicianId) && !existingById.get(technicianId));
        const toDeactivate = [...existingById.entries()].filter(([technicianId, isActive]) => isActive && !selectedIds.has(technicianId)).map(([technicianId]) => technicianId);
        if (toInsert.length) {
          const { error } = await supabase.from("job_technicians").insert(toInsert.map((technicianId) => ({ job_id: job.job_id, technician_id: technicianId, is_active: true })));
          if (error) throw error;
        }
        if (toActivate.length) {
          const { error } = await supabase.from("job_technicians").update({ is_active: true }).eq("job_id", job.job_id).in("technician_id", toActivate);
          if (error) throw error;
        }
        if (toDeactivate.length) {
          const { error } = await supabase.from("job_technicians").update({ is_active: false }).eq("job_id", job.job_id).in("technician_id", toDeactivate);
          if (error) throw error;
        }
      }
      return response({ message: "Schedule updated." });
    }

    if (action === "create-schedule") {
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
      const branch = String(body.branch ?? "").trim().toLowerCase();
      const technicianIds: string[] = Array.isArray(body.technicianIds) ? [...new Set<string>(body.technicianIds.map(String).filter(Boolean))] : [];
      if (!firstName || !lastName || !address || !contactEmail || !phoneNumber || !date || !startTime || !endTime || !["makati", "cebu"].includes(branch) || new Date(`${date}T${endTime}`) <= new Date(`${date}T${startTime}`)) return response({ error: "Please provide all required job details and a valid time range." }, 400);
      if (!(await hasOnlyActiveTechnicianRole(technicianIds))) return response({ error: "Only active users with the Technician role can be assigned." }, 400);

      if (technicianIds.length) {
        const { data: booked, error: bookedError } = await supabase.from("job_technicians").select("technician_id, jobs!inner(scheduled_date, status)").eq("jobs.scheduled_date", date).neq("jobs.status", "cancelled").eq("is_active", true).in("technician_id", technicianIds);
        if (bookedError) throw bookedError;
        if ((booked ?? []).length) return response({ error: "One or more selected technicians already have a job on that date." }, 409);
      }

      const { data: client, error: clientError } = await supabase.from("clients").insert({ first_name: firstName, last_name: lastName, company_name: clientType === "company" ? companyName : null, name: clientType === "company" ? companyName : `${firstName} ${lastName}`, client_type: clientType, contact_channel: "website", branch_served: branch, phone: phoneNumber, email: contactEmail, address }).select("client_id").single();
      if (clientError) throw clientError;
      const { data: job, error: jobError } = await supabase.from("jobs").insert({ client_id: client.client_id, job_type: jobTypeFor(serviceType), status: "scheduled", branch, scheduled_date: date, scheduled_time: startTime, scheduled_end_date: date, scheduled_end_time: endTime, created_by: session.sub }).select("job_id, job_number").single();
      if (jobError) throw jobError;
      if (technicianIds.length) {
        const { error: assignmentError } = await supabase.from("job_technicians").insert(technicianIds.map((technicianId) => ({ job_id: job.job_id, technician_id: technicianId, is_active: true })));
        if (assignmentError) throw assignmentError;
      }
      return response({ job: { id: job.job_id, order: job.job_number } }, 201);
    }

    return response({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error(error);
    return response({ error: "Unable to complete the request." }, 500);
  }
});
