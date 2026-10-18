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

// Ambiguous characters (0/O, 1/l/I) are omitted so a temporary password can be
// read aloud or copied by hand without transcription errors.
function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
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

  let payload: any;
  try {
    // Inspect the header before trusting anything inside the token. The signature
    // is always HMAC-SHA256, so an unexpected alg or typ is simply not our token.
    const tokenHeader = JSON.parse(decoder.decode(fromBase64Url(header)));
    if (tokenHeader?.alg !== "HS256") return null;
    if (tokenHeader?.typ && tokenHeader.typ !== "JWT") return null;

    const key = await crypto.subtle.importKey("raw", encoder.encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(signature), encoder.encode(`${header}.${body}`));
    if (!valid) return null;

    payload = JSON.parse(decoder.decode(fromBase64Url(body)));
  } catch {
    // A segment that cannot be decoded is not a valid token; never surface it as
    // a server error.
    return null;
  }
  if (!(payload.exp > Math.floor(Date.now() / 1000))) return null;

  // A valid signature alone is not enough. The account must still be active, and
  // the role is read from the database so that deactivation or a role change
  // takes effect immediately instead of only after the token expires.
  const { data: account, error } = await supabase
    .from("users")
    .select("is_active, roles(role_name)")
    .eq("user_id", payload.sub)
    .maybeSingle();
  if (error) throw error;
  if (!account?.is_active) return null;
  const role = Array.isArray(account.roles) ? account.roles[0]?.role_name : account.roles?.role_name;
  return { ...payload, role: role ?? payload.role };
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
  return { token, user: { id: user.user_id, name: [user.first_name, user.last_name].filter(Boolean).join(" "), email: user.email, branch: user.branch, role: roleName, phone: user.phone ?? "", title: user.title ?? "" } };
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function isSchedulingRole(role: string) {
  return rolePermissions[role]?.some(([module]) => module === "scheduling") ?? false;
}

function isSalesBillingRole(role: string) {
  return rolePermissions[role]?.some(([module]) => module === "sales_billing") ?? false;
}

const schedulingActions = new Set(["list-technicians", "list-schedules", "create-schedule", "get-schedule", "update-schedule", "confirm-job-assignment", "create-job-from-template", "list-clients"]);
const fieldReportActions = new Set(["list-field-report-jobs", "list-field-reports", "submit-field-report", "resubmit-field-report", "create-report-upload", "discard-report-upload"]);
const inventoryActions = new Set(["list-inventory", "create-inventory-item", "adjust-inventory-stock", "update-inventory-item"]);
const jobAllocationActions = new Set(["list-pending-job-requests", "list-job-allocation-stock", "allocate-job-stock", "list-job-allocation-history"]);
// Invoicing and payments belong to the sales_billing module (Billing Staff, Admin).
const billingActions = new Set(["list-invoices", "list-invoice-candidates", "create-invoice", "record-payment"]);
// Actions a signed-in user may perform on their own account, bypassing the module role check.
const selfServiceActions = new Set(["change-password", "update-profile"]);
// The landing dashboard is available to every signed-in user; the payload itself is
// role-aware, so financial figures never reach roles that should not see them.
const universalActions = new Set(["dashboard-summary"]);

// Field-report photos live in a private bucket and reach the browser only through
// short-lived signed URLs minted here with the service role.
const ATTACHMENT_BUCKET = "report-attachments";
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_REPORT_ATTACHMENTS = 5;
const ATTACHMENT_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
// reports/<job_id>/<user_id>/<uuid>.<ext> — a session may only attach uploads it
// made itself, for the job it is reporting on.
const ATTACHMENT_PATH_PATTERN = /^reports\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i;
const attachmentExtension = (contentType: string) =>
  contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";

function jobTypeFor(serviceType: string) {
  if (serviceType === "Installation") return "installation";
  if (serviceType === "Preventive maintenance") return "maintenance";
  if (serviceType === "Inspection") return "inspection";
  return "repair";
}

// Single source of truth for presenting job_type. Previously this ternary was
// duplicated at every call site, so a new job type could be added to the enum
// and the write path while the read paths silently reported "Service call".
function serviceLabelFor(jobType: unknown) {
  if (jobType === "installation") return "Installation";
  if (jobType === "maintenance") return "Preventive maintenance";
  if (jobType === "inspection") return "Inspection";
  return "Service call";
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
    .select("job_id, job_number, job_type, status, branch, scheduled_date, scheduled_time, scheduled_end_time, parts_status, assignment_confirmed_at, site_address, quotation_id, clients(name, address), job_technicians(technician_id, is_active, technicians(users(first_name, last_name)))")
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
      service: serviceLabelFor(job.job_type),
      location: client?.address ?? `${String(job.branch).replace(/^./, (letter) => letter.toUpperCase())} branch`,
      technician: technicians.length ? technicians.map((technician: { name: string }) => technician.name).join(", ") : "Unassigned",
      technicians,
      stock: "Available",
      partsStatus: job.parts_status,
      assignmentConfirmedAt: job.assignment_confirmed_at,
      siteAddress: job.site_address,
      quotationId: job.quotation_id,
      endTime: String(job.scheduled_end_time ?? "").slice(0, 5),
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

// Templates are the standard priced packages that Billing Staff maintain. The
// client-facing total is the sum of the priced lines; part lines carry unit_price 0
// and exist only to tell the warehouse what to allocate.
async function listJobTemplates(session: Record<string, unknown>) {
  // Markup is commercially sensitive: only sales_billing roles receive it, so a
  // Service Manager never sees the percentage behind the price.
  const includeMarkup = isSalesBillingRole(String(session.role ?? ""));

  const { data, error } = await supabase
    .from("job_templates")
    .select("template_id, name, job_type, branch, description, is_active, markup_percent, created_at, job_template_items(item_id, line_type, part_id, description, quantity, unit_price, line_total)")
    .order("name");
  if (error) throw error;

  return (data ?? []).map((template: any) => {
    const items = (Array.isArray(template.job_template_items) ? template.job_template_items : [])
      .slice()
      .sort((left: any, right: any) => String(left.item_id).localeCompare(String(right.item_id)));
    const factor = 1 + Number(template.markup_percent || 0) / 100;

    // Base prices are only exposed to sales_billing roles; everyone else sees the
    // quoted price alone. Rounding is per line so `total` matches the quotation
    // that gioms_create_job_from_template will generate.
    const mappedItems: any[] = items.map((item: any) => {
      const quantity = Number(item.quantity);
      const baseUnit = Number(item.unit_price);
      const clientUnit = Math.round(baseUnit * factor * 100) / 100;
      return {
        id: item.item_id,
        lineType: item.line_type,
        partId: item.part_id ?? "",
        description: item.description,
        quantity,
        unitPriceClient: clientUnit,
        lineTotalClient: Math.round(quantity * clientUnit * 100) / 100,
        ...(includeMarkup
          ? {
              unitPriceBase: baseUnit,
              lineTotalBase: Math.round(quantity * baseUnit * 100) / 100,
            }
          : {}),
      };
    });

    return {
      id: template.template_id,
      name: template.name,
      jobType: template.job_type,
      branch: template.branch ?? "",
      description: template.description ?? "",
      isActive: template.is_active,
      createdAt: template.created_at,
      items: mappedItems,
      total: mappedItems.reduce((sum: number, item: any) => sum + item.lineTotalClient, 0),
      ...(includeMarkup
        ? {
            markupPercent: Number(template.markup_percent),
            subtotal: mappedItems.reduce(
              (sum: number, item: any) => sum + (item.lineTotalBase ?? 0),
              0,
            ),
          }
        : {}),
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

  // The signed token carries no branch claim, so read the real branch from the
  // account rather than letting every new technician row default to makati.
  const { data: account, error: accountError } = await supabase
    .from("users")
    .select("branch")
    .eq("user_id", session.sub)
    .maybeSingle();
  if (accountError) throw accountError;

  const { data: createdTechnician, error: createError } = await supabase
    .from("technicians")
    .insert({ user_id: session.sub, branch: (account?.branch as string) ?? "makati" })
    .select("technician_id")
    .single();

  if (createError) throw createError;
  return createdTechnician.technician_id;
}

// Read-only counterpart to getCurrentTechnicianId: opening the picker must not
// create a technician record for someone who has none.
async function findCurrentTechnicianId(session: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("technicians")
    .select("technician_id")
    .eq("user_id", session.sub)
    .maybeSingle();
  if (error) throw error;
  return (data?.technician_id as string | undefined) ?? "";
}

async function listFieldReportJobs(session: Record<string, unknown>) {
  const technicianRoles = new Set(["Technician", "Service Manager", "Sales Manager"]);
  const isTechnicianView = technicianRoles.has(String(session.role ?? ""));
  const myTechnicianId = isTechnicianView ? await findCurrentTechnicianId(session) : "";

  // A technician-role user with no technician record is assigned to nothing, so
  // there is no job to report. This matches the previous scoped query.
  if (isTechnicianView && !myTechnicianId) return [];

  let query = supabase
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
  const { data: reports, error: reportsError } = await supabase
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
      return (
        allocatedJobIds.has(job.job_id) ||
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

// Distinct technicians that have at least one submitted report, for the manager filter.
async function listReportTechnicians() {
  const { data, error } = await supabase
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

async function listFieldReports(session: Record<string, unknown>, requestedTechnicianId = "") {
  const isManager = ["Admin", "Service Manager", "Sales Manager"].includes(String(session.role ?? ""));

  // A technician may only ever see their own reports, whatever they ask for.
  // A manager sees everything, optionally narrowed to a single technician.
  const scopedTechnicianId = isManager
    ? String(requestedTechnicianId).trim()
    : String(await getCurrentTechnicianId(session));

  let reportsQuery = supabase
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
      report_parts_used(quantity, parts(sku, name)),
      report_attachments(file_type, file_url),
      jobs!inner(job_id, job_number, job_type, clients(name, address), job_technicians(technician_id, is_active)),
      technicians!inner(technician_id, user_id, users(first_name, last_name))
    `)
    .in("review_status", ["submitted", "approved", "returned"]);
  if (scopedTechnicianId) {
    reportsQuery = reportsQuery.eq("technician_id", scopedTechnicianId);
  }
  const { data: reports, error } = await reportsQuery.order("submitted_at", { ascending: false });

  if (error) throw error;

  const reportedJobIds = new Set((reports ?? []).map((report: any) => report.job_id));
  const { data: reservedJobs, error: reservedJobsError } = await supabase
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
    const { data: signed, error: signError } = await supabase.storage
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
    const status = report.review_status === "approved" ? "Ready for Billing" : report.review_status === "returned" ? "Needs Review" : "Submitted";
    const tone = report.review_status === "approved" ? "green" : report.review_status === "returned" ? "orange" : "green";
    const reportId = String(report.report_number || report.report_id);

    return {
      id: reportId,
      reportUuid: report.report_id,
      reviewStatus: report.review_status,
      technicianId: report.technician_id,
      client: client?.name ?? "Unknown client",
      service: serviceLabelFor(job?.job_type),
      technician: user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "Unknown technician",
      time: submittedAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      serviceDate: report.service_date ? String(report.service_date) : "",
      arrivalTime: String(report.time_arrival ?? "").slice(0, 5),
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
        readiness: report.review_status === "approved" ? "Ready for billing" : report.review_status === "returned" ? "Needs revision" : "Awaiting review",
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

  const technicianId = await getCurrentTechnicianId(session);
  const { data: existingReport, error: existingReportError } = await supabase
    .from("field_reports")
    .select("report_id")
    .eq("job_id", jobId)
    .eq("technician_id", technicianId)
    .maybeSingle();

  if (existingReportError) throw existingReportError;
  if (existingReport) {
    throw new Error("You have already submitted a field report for this job. Each technician files one report per job.");
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
      p_attachments: attachmentPaths.map((path: string) => ({ fileUrl: path })),
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
      let { data: user, error } = await supabase.from("users").select("user_id, first_name, last_name, email, password_hash, branch, phone, title, is_active, roles(role_name)").eq("email", email).maybeSingle();
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

    if (action === "request-password-reset") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!email) return response({ error: "An email address is required." }, 400);
      const { data: user, error } = await supabase
        .from("users")
        .select("user_id, email")
        .eq("email", email)
        .maybeSingle();
      if (error) throw error;
      // Answer identically whether or not the address exists, so this endpoint
      // cannot be used to discover which emails have accounts.
      if (user) {
        const { error: insertError } = await supabase
          .from("password_reset_requests")
          .insert({ user_id: user.user_id, email: user.email });
        // 23505 means a pending request already exists for this user; that is fine.
        if (insertError && insertError.code !== "23505") throw insertError;
      }
      return response({ message: "If that email address has an account, a reset request is waiting for an administrator." });
    }

    const session = await verifyToken(request);
    if (!session) return response({ error: "You must be signed in to perform this action." }, 401);
    const canManageSchedule = schedulingActions.has(action) && isSchedulingRole(session.role);
    const canLoadFieldReports = fieldReportActions.has(action) && isFieldReportRole(session.role);
    const canManageInventory = inventoryActions.has(action) && ["Admin", "Warehouse Manager"].includes(session.role);
    const canAllocateJobStock = jobAllocationActions.has(action) && (isSchedulingRole(session.role) || ["Admin", "Warehouse Manager"].includes(session.role));
    // Reviewing a field report is a manager decision: explicitly exclude Technicians,
    // who otherwise pass the field-report role check.
    const canReviewReports = action === "review-field-report" && ["Admin", "Service Manager", "Sales Manager"].includes(session.role);
    // Anyone who schedules needs to read templates; only sales_billing roles maintain them.
    const canReadTemplates = action === "list-job-templates" && (isSchedulingRole(session.role) || isSalesBillingRole(session.role));
    const canManageTemplates = action === "save-job-template" && isSalesBillingRole(session.role);
    // Billing Staff need the parts catalog to build templates; inventory roles keep it too.
    const canReadParts = action === "list-parts" && (isSalesBillingRole(session.role) || ["Admin", "Warehouse Manager"].includes(session.role));
    const canManageBilling = billingActions.has(action) && isSalesBillingRole(session.role);
    // Moving legacy base64 images into the bucket is a one-off administrative job.
    const canMigrateAttachments = action === "migrate-report-attachments" && session.role === "Admin";
    const allowed = [
      selfServiceActions.has(action),
      universalActions.has(action),
      canManageSchedule,
      canLoadFieldReports,
      canManageInventory,
      canAllocateJobStock,
      canReviewReports,
      canReadTemplates,
      canManageTemplates,
      canReadParts,
      canManageBilling,
      canMigrateAttachments,
      session.role === "Admin",
    ].some(Boolean);
    if (!allowed) return response({ error: "Administrator access is required." }, 403);

    if (action === "dashboard-summary") {
      const first = (value: any) => (Array.isArray(value) ? value[0] : value);
      const role = String(session.role ?? "");
      const technicianRoles = new Set(["Technician", "Service Manager", "Sales Manager"]);
      const isTechnicianView = technicianRoles.has(role);
      const myTechnicianId = isTechnicianView ? await findCurrentTechnicianId(session) : "";
      const today = new Date().toISOString().slice(0, 10);

      const { data: jobRows, error: jobsError } = await supabase
        .from("jobs")
        .select("job_id, job_number, job_type, branch, status, parts_status, scheduled_date, scheduled_time, clients(name, address), job_technicians(technician_id, is_active, technicians(users(first_name, last_name)))")
        .neq("status", "cancelled")
        .gte("scheduled_date", today)
        .order("scheduled_date")
        .order("scheduled_time")
        .limit(60);
      if (jobsError) throw jobsError;

      const activeAssignments = (job: any) =>
        (Array.isArray(job.job_technicians) ? job.job_technicians : []).filter(
          (assignment: any) => assignment.is_active,
        );
      // A technician only ever sees their own work; everyone else sees the board.
      const scopedJobs =
        isTechnicianView && myTechnicianId
          ? (jobRows ?? []).filter((job: any) =>
              activeAssignments(job).some(
                (assignment: any) => assignment.technician_id === myTechnicianId,
              ),
            )
          : (jobRows ?? []);

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
          technicianName: names.join(", ") || "Unassigned",
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

      const pendingRequests = await listPendingJobRequests();

      const { count: reportsAwaitingReview, error: reportCountError } = await supabase
        .from("field_reports")
        .select("report_id", { count: "exact", head: true })
        .eq("review_status", "submitted");
      if (reportCountError) throw reportCountError;

      const { data: stockRows, error: stockError } = await supabase
        .from("stock")
        .select("quantity_on_hand, parts!inner(reorder_threshold)");
      if (stockError) throw stockError;
      const lowStock = (stockRows ?? []).filter((row: any) => {
        const threshold = Number(first(row.parts)?.reorder_threshold ?? 0);
        return Number(row.quantity_on_hand) <= threshold;
      }).length;

      // Financial figures are limited to Admin, Service Manager and Billing Staff.
      let openInvoices: { count: number; amount: number } | null = null;
      if (["Admin", "Service Manager", "Billing Staff"].includes(role)) {
        const { data: invoiceRows, error: invoiceError } = await supabase
          .from("invoices")
          .select("invoice_id, total_amount, status, payments(amount)")
          .neq("status", "cancelled");
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

      return response({
        jobs,
        counts: {
          todayJobs: scopedJobs.filter((job: any) => String(job.scheduled_date) === today).length,
          upcomingJobs: scopedJobs.length,
          pendingAllocation: pendingRequests.length,
          reportsAwaitingReview: reportsAwaitingReview ?? 0,
          lowStock,
          openInvoices,
        },
      });
    }

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

    if (action === "update-profile") {
      const firstName = String(body.firstName ?? "").trim();
      const lastName = String(body.lastName ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const phone = String(body.phone ?? "").trim();
      const title = String(body.title ?? "").trim();
      if (!firstName || !lastName || !email) {
        return response({ error: "First name, last name, and email are required." }, 400);
      }
      const { data: updated, error } = await supabase
        .from("users")
        .update({
          first_name: firstName,
          last_name: lastName,
          email,
          phone: phone || null,
          title: title || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", session.sub)
        .select("user_id, first_name, last_name, email, branch, phone, title, roles(role_name)")
        .single();
      if (error) {
        if (error.code === "23505") return response({ error: "That email address is already in use by another account." }, 409);
        throw error;
      }
      const role = Array.isArray(updated.roles) ? updated.roles[0]?.role_name : updated.roles?.role_name;
      return response({
        profile: {
          id: updated.user_id,
          name: [updated.first_name, updated.last_name].filter(Boolean).join(" "),
          email: updated.email,
          branch: updated.branch,
          phone: updated.phone ?? "",
          title: updated.title ?? "",
          role: role ?? session.role,
        },
      });
    }

    if (action === "list-job-templates") {
      return response({ templates: await listJobTemplates(session) });
    }

    if (action === "save-job-template") {
      const items = Array.isArray(body.items) ? body.items : [];
      const { data: savedTemplateId, error } = await supabase.rpc("gioms_save_job_template", {
        p_template_id: body.templateId ? String(body.templateId) : null,
        p_name: String(body.name ?? ""),
        p_job_type: body.jobType ? String(body.jobType) : null,
        p_branch: body.branch ? String(body.branch) : null,
        p_description: String(body.description ?? ""),
        p_is_active: body.isActive === undefined ? true : Boolean(body.isActive),
        p_markup_percent: Number(body.markupPercent ?? 0),
        p_items: items.map((item: any) => ({
          lineType: String(item?.lineType ?? ""),
          partId: item?.partId ? String(item.partId) : null,
          description: String(item?.description ?? ""),
          quantity: Number(item?.quantity ?? 0),
          unitPrice: Number(item?.unitPrice ?? 0),
        })),
        p_actor: session.sub,
      });
      if (error) return response({ error: error.message }, 400);
      return response({ templateId: savedTemplateId, message: "Template saved." }, body.templateId ? 200 : 201);
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

    if (action === "list-password-reset-requests") {
      const { data, error } = await supabase
        .from("password_reset_requests")
        .select("request_id, email, status, requested_at, expires_at, users!password_reset_requests_user_id_fkey(first_name, last_name)")
        .eq("status", "pending")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      const now = Date.now();
      return response({
        requests: (data ?? []).map((request: any) => {
          const account = Array.isArray(request.users) ? request.users[0] : request.users;
          return {
            id: request.request_id,
            email: request.email,
            name: account ? [account.first_name, account.last_name].filter(Boolean).join(" ") : "Unknown user",
            requestedAt: request.requested_at,
            expiresAt: request.expires_at,
            expired: new Date(request.expires_at).getTime() <= now,
          };
        }),
      });
    }

    if (action === "resolve-password-reset") {
      const requestId = String(body.requestId ?? "").trim();
      const decision = String(body.decision ?? "").trim();
      if (!requestId || !["approve", "cancel"].includes(decision)) {
        return response({ error: "A reset request and a valid decision are required." }, 400);
      }
      const { data: resetRequest, error } = await supabase
        .from("password_reset_requests")
        .select("request_id, user_id, status, expires_at")
        .eq("request_id", requestId)
        .maybeSingle();
      if (error) throw error;
      if (!resetRequest) return response({ error: "Reset request not found." }, 404);
      if (resetRequest.status !== "pending") return response({ error: "This request has already been handled." }, 409);

      const handledAt = new Date().toISOString();
      if (decision === "cancel") {
        const { error: cancelError } = await supabase
          .from("password_reset_requests")
          .update({ status: "cancelled", handled_by: session.sub, handled_at: handledAt })
          .eq("request_id", requestId);
        if (cancelError) throw cancelError;
        return response({ message: "Reset request cancelled." });
      }

      if (new Date(resetRequest.expires_at).getTime() <= Date.now()) {
        return response({ error: "This reset request has expired. Ask the user to submit a new one." }, 409);
      }

      // A one-time temporary password is returned here, once, for the administrator
      // to hand to the user out of band. The user is expected to change it afterwards.
      const temporaryPassword = generateTemporaryPassword();
      const { error: passwordError } = await supabase
        .from("users")
        .update({ password_hash: await hashPassword(temporaryPassword), updated_at: handledAt })
        .eq("user_id", resetRequest.user_id);
      if (passwordError) throw passwordError;
      const { error: approveError } = await supabase
        .from("password_reset_requests")
        .update({ status: "approved", handled_by: session.sub, handled_at: handledAt })
        .eq("request_id", requestId);
      if (approveError) throw approveError;
      return response({ message: "Temporary password issued.", temporaryPassword });
    }

    if (action === "list-parts") {
      const { data, error } = await supabase
        .from("parts")
        .select("part_id, sku, name, category, unit_of_measure, unit_cost, reorder_threshold")
        .order("sku");
      if (error) throw error;
      return response({
        parts: (data ?? []).map((part: any) => ({
          id: part.part_id,
          sku: part.sku,
          name: part.name,
          category: part.category ?? "",
          unitOfMeasure: part.unit_of_measure,
          unitCost: Number(part.unit_cost),
          reorderThreshold: part.reorder_threshold,
        })),
      });
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
        .select("job_id, job_number, quotation_id, branch, scheduled_date, scheduled_time, status, parts_status, clients(name, address), job_technicians(is_active, technicians(users(first_name, last_name)))")
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
      // The quotation is what the client was sold, so its part lines are the
      // warehouse's starting point. Aggregated by part in case one part appears
      // on more than one quoted line.
      const quotedByPart = new Map<string, { partId: string; description: string; quantity: number }>();
      let quotationNumber = "";
      if (job.quotation_id) {
        const { data: quotation, error: quotationError } = await supabase
          .from("quotations")
          .select("quotation_number")
          .eq("quotation_id", job.quotation_id)
          .maybeSingle();
        if (quotationError) throw quotationError;
        quotationNumber = quotation?.quotation_number ?? "";

        const { data: quotedLines, error: quotedError } = await supabase
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
        quotationNumber,
        quotedParts: Array.from(quotedByPart.values()),
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
        .select("part_id, branch, quantity_on_hand, quantity_reserved")
        .eq("stock_id", stockId)
        .maybeSingle();
      if (stockLookupError) throw stockLookupError;
      if (!stock) return response({ error: "This inventory item no longer exists." }, 404);
      if (direction === "out") {
        if (quantity > stock.quantity_on_hand) {
          return response({ error: "The quantity removed cannot exceed current stock." }, 400);
        }
        const reserved = Number(stock.quantity_reserved) || 0;
        const available = stock.quantity_on_hand - reserved;
        if (quantity > available) {
          return response({ error: `Only ${available} of ${stock.quantity_on_hand} units are available; ${reserved} are reserved for jobs.` }, 400);
        }
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

    if (action === "review-field-report") {
      const reportId = String(body.reportId ?? "").trim();
      const decision = String(body.decision ?? "").trim();
      if (!reportId || !["approve", "return"].includes(decision)) {
        return response({ error: "A field report and a valid decision are required." }, 400);
      }
      const { data: report, error } = await supabase
        .from("field_reports")
        .select("report_id, review_status")
        .eq("report_id", reportId)
        .maybeSingle();
      if (error) throw error;
      if (!report) return response({ error: "Field report not found." }, 404);
      if (report.review_status === "draft") {
        return response({ error: "This report has not been submitted for review yet." }, 409);
      }
      const nextStatus = decision === "approve" ? "approved" : "returned";
      const { error: reviewError } = await supabase
        .from("field_reports")
        .update({ review_status: nextStatus, reviewed_by: session.sub, reviewed_at: new Date().toISOString() })
        .eq("report_id", reportId);
      if (reviewError) throw reviewError;
      return response({
        message: nextStatus === "approved" ? "Report approved for billing." : "Report returned for correction.",
        reviewStatus: nextStatus,
      });
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
      const isManager = ["Admin", "Service Manager", "Sales Manager"].includes(String(session.role ?? ""));
      const reports = await listFieldReports(session, String(body.technicianId ?? ""));
      return response({ reports, technicians: isManager ? await listReportTechnicians() : [] });
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

    if (action === "resubmit-field-report") {
      const reportId = String(body.reportId ?? "").trim();
      if (!reportId) return response({ error: "Choose a field report to edit." }, 400);

      // Only the technician who filed the report may correct it; managers return
      // reports for correction but do not rewrite them.
      const technicianId = await findCurrentTechnicianId(session);
      if (!technicianId) {
        return response({ error: "Only the technician who filed this report can edit it." }, 403);
      }

      const { data: report, error } = await supabase
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
      const { error: updateError } = await supabase
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

    if (action === "create-report-upload") {
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
      if (!technicianId) {
        return response({ error: "Only an assigned technician can attach images." }, 403);
      }
      const { data: assignment, error: assignmentError } = await supabase
        .from("job_technicians")
        .select("job_id")
        .eq("job_id", jobId)
        .eq("technician_id", technicianId)
        .eq("is_active", true)
        .maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignment) return response({ error: "You are not assigned to this job." }, 403);

      const path = `reports/${jobId}/${session.sub}/${crypto.randomUUID()}.${attachmentExtension(contentType)}`;
      const { data: signed, error: signError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .createSignedUploadUrl(path);
      if (signError) throw signError;
      if (!signed?.token) return response({ error: "Could not prepare the upload." }, 502);

      return response({ path, token: signed.token, signedUrl: signed.signedUrl ?? "" });
    }

    if (action === "discard-report-upload") {
      const path = String(body.path ?? "").trim();
      if (!ATTACHMENT_PATH_PATTERN.test(path) || !path.includes(`/${String(session.sub)}/`)) {
        return response({ error: "That upload does not belong to you." }, 403);
      }
      const { data: attached, error: attachedError } = await supabase
        .from("report_attachments")
        .select("attachment_id")
        .eq("file_url", path)
        .limit(1);
      if (attachedError) throw attachedError;
      if (attached?.length) {
        return response({ error: "That image is already part of a report." }, 409);
      }
      const { error: removeError } = await supabase.storage.from(ATTACHMENT_BUCKET).remove([path]);
      if (removeError) throw removeError;
      return response({ message: "Upload discarded." });
    }

    if (action === "migrate-report-attachments") {
      // One-off: move legacy base64 rows into the bucket so the column stores paths.
      const { data: legacy, error: legacyError } = await supabase
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
          const { data: technician, error: technicianError } = await supabase
            .from("technicians")
            .select("user_id")
            .eq("technician_id", report?.technician_id ?? "")
            .maybeSingle();
          if (technicianError) throw technicianError;

          const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
          const owner = technician?.user_id ?? "00000000-0000-0000-0000-000000000000";
          const path = `reports/${report?.job_id}/${owner}/${crypto.randomUUID()}.${attachmentExtension(contentType)}`;
          const { error: uploadError } = await supabase.storage
            .from(ATTACHMENT_BUCKET)
            .upload(path, bytes, { contentType, upsert: false });
          if (uploadError) throw uploadError;

          const { error: updateError } = await supabase
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

      const { count: remaining, error: remainingError } = await supabase
        .from("report_attachments")
        .select("attachment_id", { count: "exact", head: true })
        .like("file_url", "data:%");
      if (remainingError) throw remainingError;

      return response({ migrated, failed, remaining: remaining ?? 0 });
    }
    

    if (action === "list-invoices") {
      const first = (value: any) => (Array.isArray(value) ? value[0] : value);
      const { data: invoices, error } = await supabase
        .from("invoices")
        .select(`
          invoice_id, invoice_number, status, issue_date, due_date, total_amount,
          clients(name, company_name),
          jobs!invoices_job_id_fkey(job_number, job_type, branch),
          quotations(quotation_number),
          field_reports!invoices_report_id_fkey(report_number, service_date),
          invoice_line_items(line_item_id, description, quantity, unit_price, line_total),
          payments(payment_id, amount, payment_date, method, created_at)
        `)
        .order("created_at", { ascending: false });
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

    if (action === "list-invoice-candidates") {
      const first = (value: any) => (Array.isArray(value) ? value[0] : value);
      const { data: reports, error } = await supabase
        .from("field_reports")
        .select(`
          report_id, report_number, service_date, submitted_at, reviewed_at,
          technicians!inner(users(first_name, last_name)),
          jobs!field_reports_job_id_fkey(job_id, job_number, job_type, branch, site_address, client_id, quotation_id, clients(name, company_name))
        `)
        .eq("review_status", "approved")
        .order("submitted_at", { ascending: false });
      if (error) throw error;

      const { data: invoiced, error: invoicedError } = await supabase
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
        const { data: lines, error: linesError } = await supabase
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

    if (action === "create-invoice") {
      const reportId = String(body.reportId ?? "").trim();
      const dueDate = body.dueDate ? String(body.dueDate) : null;
      const extras = Array.isArray(body.extras) ? body.extras : [];
      if (!reportId) return response({ error: "Choose an approved field report to invoice." }, 400);
      if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        return response({ error: "The due date is not a valid date." }, 400);
      }
      if (extras.length > 25) return response({ error: "Add at most 25 extra lines." }, 400);

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

      const { data: invoice, error } = await supabase.rpc("gioms_create_invoice_from_report", {
        p_report_id: reportId,
        p_due_date: dueDate,
        p_extra_lines: extraLines,
      });
      if (error) return response({ error: error.message }, 409);
      return response(invoice, 201);
    }

    if (action === "record-payment") {
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

      const { data: payment, error } = await supabase.rpc("gioms_record_invoice_payment", {
        p_invoice_id: invoiceId,
        p_amount: amount,
        p_method: method,
        p_paid_on: paidOn,
        p_actor: String(session.sub),
      });
      if (error) return response({ error: error.message }, 409);
      return response(payment);
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

    if (action === "confirm-job-assignment") {
      const jobNumber = String(body.jobNumber ?? "").trim();
      if (!jobNumber) return response({ error: "A work order number is required." }, 400);
      const { data: job, error } = await supabase
        .from("jobs")
        .select("job_id, status, parts_status, assignment_confirmed_at")
        .eq("job_number", jobNumber)
        .maybeSingle();
      if (error) throw error;
      if (!job) return response({ error: "Scheduled job not found." }, 404);
      if (job.status === "cancelled") return response({ error: "Cancelled jobs cannot be confirmed." }, 409);
      if (job.parts_status !== "pending") return response({ error: "This job's stock has already been allocated." }, 409);
      if (job.assignment_confirmed_at) return response({ message: "Assignment already confirmed.", confirmedAt: job.assignment_confirmed_at });
      const confirmedAt = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("jobs")
        .update({ assignment_confirmed_at: confirmedAt })
        .eq("job_id", job.job_id);
      if (updateError) throw updateError;
      return response({ message: "Assignment confirmed.", confirmedAt });
    }

    if (action === "list-clients") {
      const search = String(body.search ?? "").trim().replace(/[(),%]/g, " ").trim();
      let clientQuery = supabase
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

    if (action === "create-job-from-template") {
      const technicianIds = Array.isArray(body.technicianIds)
        ? [...new Set<string>(body.technicianIds.map(String).filter(Boolean))]
        : [];
      const { data: created, error: createError } = await supabase.rpc("gioms_create_job_from_template", {
        p_client_id: body.clientId ? String(body.clientId) : null,
        p_first_name: String(body.firstName ?? ""),
        p_last_name: String(body.lastName ?? ""),
        p_client_type: String(body.clientType ?? ""),
        p_company_name: String(body.companyName ?? ""),
        p_email: String(body.email ?? ""),
        p_phone: String(body.phone ?? ""),
        p_site_address: String(body.siteAddress ?? ""),
        p_template_id: body.templateId ? String(body.templateId) : null,
        p_accepted_by_name: String(body.acceptedByName ?? ""),
        p_date: body.date ? String(body.date) : null,
        p_start_time: body.startTime ? String(body.startTime) : null,
        p_end_time: body.endTime ? String(body.endTime) : null,
        p_branch: body.branch ? String(body.branch) : null,
        p_technician_ids: technicianIds.length ? technicianIds : null,
        p_actor: session.sub,
      });
      if (createError) return response({ error: createError.message }, 400);
      return response({ job: created }, 201);
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
