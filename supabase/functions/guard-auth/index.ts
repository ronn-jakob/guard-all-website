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

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// Audit triggers resolve the actor from the x-guard-actor header. A request that
// has not authenticated (login, password-reset request) keeps the plain admin
// client, so no actor is recorded for work that has no session.
function createRequestClient(actorId: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { "x-guard-actor": actorId } },
    },
  );
}

const rolePermissions: Record<string, Array<[string, string]>> = {
  Admin: [["scheduling", "approve"], ["inventory", "approve"], ["field_reporting", "approve"], ["sales_billing", "approve"], ["admin", "approve"]],
  "Service Manager": [["scheduling", "edit"], ["field_reporting", "edit"]],
  "Sales Manager": [["scheduling", "edit"], ["field_reporting", "edit"]],
  Technician: [["field_reporting", "edit"]],
  "Warehouse Manager": [["inventory", "edit"]],
  "Billing Staff": [["sales_billing", "edit"]],
};

// The job title shown on a profile is the role, mapped to a readable label. It is
// never typed by the user.
const roleTitles: Record<string, string> = {
  Admin: "Administrator",
  "Service Manager": "Service Manager",
  "Sales Manager": "Service Manager",
  Technician: "Field Technician",
  "Warehouse Manager": "Warehouse Manager",
  "Billing Staff": "Billing Staff",
};
const roleTitleFor = (role: string) => roleTitles[role] ?? role;

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
  const { data: account, error } = await supabaseAdmin
    .from("users")
    .select("is_active, branch, roles(role_name)")
    .eq("user_id", payload.sub)
    .maybeSingle();
  if (error) throw error;
  if (!account?.is_active) return null;
  const role = Array.isArray(account.roles) ? account.roles[0]?.role_name : account.roles?.role_name;
  return { ...payload, role: role ?? payload.role, branch: account.branch ?? null };
}

// Admins work across branches and may choose; every other role is pinned to the
// branch on their account, whatever the request says.
function scopedBranch(session: Record<string, any>, requested: unknown) {
  if (String(session.role ?? "") === "Admin") {
    const branch = String(requested ?? "").trim().toLowerCase();
    return ["makati", "cebu"].includes(branch) ? branch : "";
  }
  return String(session.branch ?? "");
}

// Read scope: null means "no restriction" (Admin). A non-admin with no branch
// gets an empty string, which matches nothing — fail closed.
function branchScope(session: Record<string, any>) {
  return String(session.role ?? "") === "Admin" ? null : String(session.branch ?? "");
}

// Destructive actions re-verify the signed-in user's password. The modal is only
// the UX; this is the actual gate.
async function passwordConfirmationError(session: Record<string, unknown>, password: string) {
  if (!password) return "Enter your password to confirm.";
  const { data: account, error } = await supabaseAdmin
    .from("users")
    .select("password_hash, is_active")
    .eq("user_id", session.sub)
    .maybeSingle();
  if (error) throw error;
  if (!account?.is_active) return "Your account is not active.";
  if (!(await verifyPassword(password, account.password_hash))) {
    return "That password is not correct.";
  }
  return null;
}

async function ensureRole(roleName: string) {
  const { data: existing, error: selectError } = await supabaseAdmin.from("roles").select("role_id").eq("role_name", roleName).maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing.role_id;
  const { data, error } = await supabaseAdmin.from("roles").insert({ role_name: roleName }).select("role_id").single();
  if (error) throw error;
  return data.role_id;
}

async function ensureRoles() {
  const roleIds: Record<string, string> = {};
  for (const roleName of Object.keys(rolePermissions)) {
    roleIds[roleName] = await ensureRole(roleName);
    const { data: existingPermissions, error: permissionError } = await supabaseAdmin.from("module_permissions").select("module").eq("role_id", roleIds[roleName]);
    if (permissionError) throw permissionError;
    const existingModules = new Set((existingPermissions ?? []).map((permission: { module: string }) => permission.module));
    const missing = rolePermissions[roleName].filter(([module]) => !existingModules.has(module)).map(([module, access_level]) => ({ role_id: roleIds[roleName], module, access_level }));
    if (missing.length) {
      const { error } = await supabaseAdmin.from("module_permissions").insert(missing);
      if (error) throw error;
    }
  }
  return roleIds;
}

async function userResponse(user: Record<string, unknown>, roleName: string) {
  const token = await signToken({ sub: user.user_id, role: roleName, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 });
  const photoUrl = await signProfilePhoto(user.photo_path, supabaseAdmin);
  return { token, user: { id: user.user_id, name: [user.first_name, user.last_name].filter(Boolean).join(" "), email: user.email, branch: user.branch, role: roleName, phone: user.phone ?? "", title: roleTitleFor(roleName), photoUrl } };
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

const schedulingActions = new Set(["list-technicians", "list-schedules", "create-schedule", "get-schedule", "update-schedule", "confirm-job-assignment", "create-job-from-template", "list-clients", "delete-job"]);
const fieldReportActions = new Set(["list-field-report-jobs", "list-field-reports", "submit-field-report", "resubmit-field-report", "create-report-upload", "discard-report-upload"]);
const inventoryActions = new Set(["list-inventory", "create-inventory-item", "adjust-inventory-stock", "update-inventory-item", "delete-inventory-part", "restore-inventory-part", "list-part-categories", "save-part-category"]);
const jobAllocationActions = new Set(["list-pending-job-requests", "list-job-allocation-stock", "allocate-job-stock", "list-job-allocation-history"]);
// Invoicing and payments belong to the sales_billing module (Billing Staff, Admin).
const billingActions = new Set(["list-invoices", "list-invoice-candidates", "create-invoice", "record-payment", "delete-job-template"]);
// Actions a signed-in user may perform on their own account, bypassing the module role check.
const selfServiceActions = new Set(["change-password", "update-profile", "get-profile", "create-profile-photo-upload", "update-profile-photo", "remove-profile-photo"]);
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

// Profile photos follow the same private-bucket model as report attachments.
const PROFILE_PHOTO_BUCKET = "profile-photos";
const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_TTL_SECONDS = 8 * 60 * 60; // matches the token lifetime
const PROFILE_PHOTO_PATH_PATTERN = /^avatars\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i;

async function signProfilePhoto(path: unknown, db: any) {
  const value = String(path ?? "").trim();
  if (!value) return "";
  const { data, error } = await db.storage
    .from(PROFILE_PHOTO_BUCKET)
    .createSignedUrl(value, PROFILE_PHOTO_TTL_SECONDS);
  if (error) {
    console.error("Could not sign profile photo:", error.message);
    return "";
  }
  return data?.signedUrl ?? "";
}

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

async function ensureTechnicianRecord(user: Record<string, unknown>, db = supabaseAdmin) {
  const { data: existing, error: lookupError } = await db.from("technicians").select("technician_id").eq("user_id", user.user_id).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing.technician_id;
  const { data, error } = await db.from("technicians").insert({ user_id: user.user_id, branch: user.branch }).select("technician_id").single();
  if (error) throw error;
  return data.technician_id;
}

// Item codes are PREFIX-NNN. The next number is the highest suffix already in
// use for that prefix — archived parts included, because their SKU stays unique.
function nextSkuFor(existingSkus: unknown[], prefix: string) {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`, "i");
  let highest = 0;
  for (const value of existingSkus) {
    const match = pattern.exec(String(value ?? ""));
    if (!match) continue;
    highest = Math.max(highest, Number(match[1]));
  }
  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
}

function isFieldReportRole(role: string) {
  return rolePermissions[role]?.some(([module]) => module === "field_reporting") ?? false;
}
async function listTechnicians(date: string, excludeOrder = "") {
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

async function hasOnlyActiveTechnicianRole(technicianIds: string[]) {
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

async function listSchedules(branch: string | null = null) {
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

async function listPendingJobRequests(branch: string | null = null) {
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

async function listJobAllocationHistory(branch: string | null = null) {
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

// Templates are the standard priced packages that Billing Staff maintain. The
// client-facing total is the sum of the priced lines; part lines carry unit_price 0
// and exist only to tell the warehouse what to allocate.
async function listJobTemplates(session: Record<string, unknown>) {
  // Markup is commercially sensitive: only sales_billing roles receive it, so a
  // Service Manager never sees the percentage behind the price.
  const includeMarkup = isSalesBillingRole(String(session.role ?? ""));
  const templateBranch = branchScope(session);

  let templateQuery = supabaseAdmin
    .from("job_templates")
    .select("template_id, name, job_type, branch, description, is_active, markup_percent, created_at, job_template_items(item_id, line_type, part_id, description, quantity, unit_price, line_total)");
  // Non-admins see their branch plus the shared All-branches templates.
  if (templateBranch !== null) {
    templateQuery = templateQuery.or(`branch.eq.${templateBranch},branch.is.null`);
  }
  const { data, error } = await templateQuery.order("name");
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

async function getCurrentTechnicianId(
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

// Read-only counterpart to getCurrentTechnicianId: opening the picker must not
// create a technician record for someone who has none.
async function findCurrentTechnicianId(session: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin
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

async function listFieldReports(session: Record<string, unknown>, requestedTechnicianId = "") {
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
      report_parts_used(quantity, parts(sku, name)),
      report_attachments(file_type, file_url),
      jobs!inner(job_id, job_number, job_type, branch, clients(name, address), job_technicians(technician_id, is_active)),
      technicians!inner(technician_id, user_id, users(first_name, last_name))
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

  const reportedJobIds = new Set((reports ?? []).map((report: any) => report.job_id));
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

async function submitFieldReport(session: Record<string, unknown>, body: Record<string, any>, db = supabaseAdmin) {
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

  const technicianId = await getCurrentTechnicianId(session, db);
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
  return { report: { id: report.reportId, number: report.reportNumber } };
}


Deno.serve(async (request: Request) => {
  // Pre-auth work runs as the plain admin client; once a session is verified the
  // binding is swapped for a client tagged with the actor, so every write in this
  // request is attributed by the audit triggers.
  let db = supabaseAdmin;
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
      let { data: user, error } = await db.from("users").select("user_id, first_name, last_name, email, password_hash, branch, phone, title, photo_path, is_active, roles(role_name)").eq("email", email).maybeSingle();
      if (error) throw error;
      if (!user && email === "admin@gmail.com" && password === "admin123") {
        const roleId = await ensureRole("Admin");
        const passwordHash = await hashPassword(password);
        const created = await db.from("users").insert({ first_name: "Website", last_name: "Admin", email, password_hash: passwordHash, role_id: roleId, branch: "makati" }).select("user_id, first_name, last_name, email, password_hash, branch, is_active").single();
        if (created.error) throw created.error;
        user = { ...created.data, roles: { role_name: "Admin" } };
      }
      if (!user || !user.is_active || !(await verifyPassword(password, user.password_hash))) return response({ error: "Invalid email or password." }, 401);
      return response(await userResponse(user, user.roles?.role_name ?? ""));
    }

    if (action === "request-password-reset") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!email) return response({ error: "An email address is required." }, 400);
      const { data: user, error } = await db
        .from("users")
        .select("user_id, email")
        .eq("email", email)
        .maybeSingle();
      if (error) throw error;
      // Answer identically whether or not the address exists, so this endpoint
      // cannot be used to discover which emails have accounts.
      if (user) {
        const { error: insertError } = await db
          .from("password_reset_requests")
          .insert({ user_id: user.user_id, email: user.email });
        // 23505 means a pending request already exists for this user; that is fine.
        if (insertError && insertError.code !== "23505") throw insertError;
      }
      return response({ message: "If that email address has an account, a reset request is waiting for an administrator." });
    }

    const session = await verifyToken(request);
    if (!session) return response({ error: "You must be signed in to perform this action." }, 401);
    db = createRequestClient(String(session.sub));
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

    if (action === "change-password") {
      const currentPassword = String(body.currentPassword ?? "");
      const newPassword = String(body.newPassword ?? "");
      if (newPassword.length < 8) return response({ error: "The new password must be at least 8 characters." }, 400);
      const { data: user, error } = await db.from("users").select("password_hash").eq("user_id", session.sub).maybeSingle();
      if (error) throw error;
      if (!user || !(await verifyPassword(currentPassword, user.password_hash))) return response({ error: "Your current password is incorrect." }, 401);
      const { error: updateError } = await db.from("users").update({ password_hash: await hashPassword(newPassword), updated_at: new Date().toISOString() }).eq("user_id", session.sub);
      if (updateError) throw updateError;
      return response({ message: "Password updated successfully." });
    }

    if (action === "update-profile") {
      const firstName = String(body.firstName ?? "").trim();
      const lastName = String(body.lastName ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const phone = String(body.phone ?? "").trim();
      // Derived from the role, never accepted from the client.
      const title = roleTitleFor(String(session.role ?? ""));
      if (!firstName || !lastName || !email) {
        return response({ error: "First name, last name, and email are required." }, 400);
      }

      // Changing the address someone signs in with is sensitive: a stolen session
      // must not be able to redirect the account. Name and phone stay frictionless.
      const { data: current, error: currentError } = await db
        .from("users")
        .select("email")
        .eq("user_id", session.sub)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) return response({ error: "Your account could not be found." }, 404);
      if (email !== String(current.email ?? "").toLowerCase()) {
        const passwordError = await passwordConfirmationError(session, String(body.currentPassword ?? ""));
        if (passwordError) return response({ error: passwordError }, 401);
      }

      const { data: updated, error } = await db
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
        .select("user_id, first_name, last_name, email, branch, phone, title, photo_path, roles(role_name)")
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
          photoUrl: await signProfilePhoto(updated.photo_path, db),
        },
      });
    }

    if (action === "get-profile") {
      const { data: account, error: accountError } = await db
        .from("users")
        .select("user_id, first_name, last_name, email, branch, phone, title, photo_path, roles(role_name)")
        .eq("user_id", session.sub)
        .maybeSingle();
      if (accountError) throw accountError;
      if (!account) return response({ error: "Your account could not be found." }, 404);
      const role = Array.isArray(account.roles) ? account.roles[0]?.role_name : account.roles?.role_name;
      return response({
        profile: {
          id: account.user_id,
          name: [account.first_name, account.last_name].filter(Boolean).join(" "),
          firstName: account.first_name,
          lastName: account.last_name,
          email: account.email,
          branch: account.branch,
          phone: account.phone ?? "",
          title: roleTitleFor(role ?? session.role),
          role: role ?? session.role,
          photoUrl: await signProfilePhoto(account.photo_path, db),
        },
      });
    }

    if (action === "create-profile-photo-upload") {
      const contentType = String(body.contentType ?? "").trim().toLowerCase();
      const size = Number(body.size);
      if (!ATTACHMENT_CONTENT_TYPES.has(contentType)) {
        return response({ error: "Choose a JPEG, PNG, or WebP image." }, 400);
      }
      if (!Number.isFinite(size) || size <= 0 || size > MAX_PROFILE_PHOTO_BYTES) {
        return response({ error: "The photo must be 5 MB or smaller." }, 400);
      }
      const path = `avatars/${session.sub}/${crypto.randomUUID()}.${attachmentExtension(contentType)}`;
      const { data: signed, error: signError } = await db.storage
        .from(PROFILE_PHOTO_BUCKET)
        .createSignedUploadUrl(path);
      if (signError) throw signError;
      if (!signed?.token) return response({ error: "Could not prepare the upload." }, 502);
      return response({ path, token: signed.token });
    }

    if (action === "update-profile-photo") {
      const path = String(body.path ?? "").trim();
      if (!PROFILE_PHOTO_PATH_PATTERN.test(path) || !path.startsWith(`avatars/${session.sub}/`)) {
        return response({ error: "That photo does not belong to you." }, 403);
      }
      const { data: current, error: currentError } = await db
        .from("users")
        .select("photo_path")
        .eq("user_id", session.sub)
        .maybeSingle();
      if (currentError) throw currentError;

      const { error: updateError } = await db
        .from("users")
        .update({ photo_path: path, updated_at: new Date().toISOString() })
        .eq("user_id", session.sub);
      if (updateError) throw updateError;

      // Best effort: an orphaned object is harmless in a private bucket.
      if (current?.photo_path && current.photo_path !== path) {
        await db.storage.from(PROFILE_PHOTO_BUCKET).remove([current.photo_path]);
      }
      return response({ photoPath: path, photoUrl: await signProfilePhoto(path, db) });
    }

    if (action === "remove-profile-photo") {
      const { data: current, error: currentError } = await db
        .from("users")
        .select("photo_path")
        .eq("user_id", session.sub)
        .maybeSingle();
      if (currentError) throw currentError;

      const { error: updateError } = await db
        .from("users")
        .update({ photo_path: null, updated_at: new Date().toISOString() })
        .eq("user_id", session.sub);
      if (updateError) throw updateError;

      if (current?.photo_path) {
        await db.storage.from(PROFILE_PHOTO_BUCKET).remove([current.photo_path]);
      }
      return response({ photoPath: "", photoUrl: "" });
    }

    if (action === "list-job-templates") {
      return response({ templates: await listJobTemplates(session) });
    }

    if (action === "save-job-template") {
      const items = Array.isArray(body.items) ? body.items : [];
      // Admins may scope a template to one branch or to All branches; everyone
      // else writes only for their own branch. Editing a shared All-branches
      // template keeps it shared instead of silently claiming it.
      let templateBranch: string | null = null;
      if (String(session.role ?? "") === "Admin") {
        templateBranch = body.branch ? String(body.branch) : null;
      } else {
        const ownBranch = String(session.branch ?? "");
        if (body.templateId) {
          const { data: existingTemplate, error: templateLookupError } = await db
            .from("job_templates")
            .select("branch")
            .eq("template_id", String(body.templateId))
            .maybeSingle();
          if (templateLookupError) throw templateLookupError;
          if (!existingTemplate) return response({ error: "Template not found." }, 404);
          if (existingTemplate.branch && existingTemplate.branch !== ownBranch) {
            return response({ error: "This template belongs to another branch." }, 403);
          }
          templateBranch = existingTemplate.branch ? ownBranch : null;
        } else {
          templateBranch = ownBranch || null;
        }
      }

      const { data: savedTemplateId, error } = await db.rpc("gioms_save_job_template", {
        p_template_id: body.templateId ? String(body.templateId) : null,
        p_name: String(body.name ?? ""),
        p_job_type: body.jobType ? String(body.jobType) : null,
        p_branch: templateBranch,
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
      const { data: existingUser, error: existingUserError } = await db.from("users").select("user_id, is_active").eq("email", email).maybeSingle();
      if (existingUserError) throw existingUserError;
      if (existingUser?.is_active) return response({ error: "An account with this email address already exists." }, 409);
      if (existingUser) {
        const { data: reactivatedUser, error: reactivateError } = await db
          .from("users")
          .update({ first_name: firstName, last_name: lastName, password_hash: await hashPassword(password), role_id: roleIds[role], branch, is_active: true, updated_at: new Date().toISOString() })
          .eq("user_id", existingUser.user_id)
          .select("user_id, first_name, last_name, email, branch, is_active, created_at, roles(role_name)")
          .single();
        if (reactivateError) throw reactivateError;
        if (role === "Technician") await ensureTechnicianRecord(reactivatedUser, db);
        return response({ account: { id: reactivatedUser.user_id, name: `${reactivatedUser.first_name} ${reactivatedUser.last_name}`, email: reactivatedUser.email, branch: reactivatedUser.branch, role: reactivatedUser.roles?.role_name, status: "Active", createdAt: new Date(reactivatedUser.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) } }, 200);
      }
      const { data, error } = await db.from("users").insert({ first_name: firstName, last_name: lastName, email, password_hash: await hashPassword(password), role_id: roleIds[role], branch }).select("user_id, first_name, last_name, email, branch, is_active, created_at, roles(role_name)").single();
      if (error) {
        if (error.code === "23505") return response({ error: "An account with this email address already exists." }, 409);
        throw error;
      }
      if (role === "Technician") await ensureTechnicianRecord(data, db);
      return response({ account: { id: data.user_id, name: `${data.first_name} ${data.last_name}`, email: data.email, branch: data.branch, role: data.roles?.role_name, status: data.is_active ? "Active" : "Inactive", createdAt: new Date(data.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) } }, 201);
    }

    if (action === "list-users") {
      const { data, error } = await db.from("users").select("user_id, first_name, last_name, email, branch, is_active, created_at, roles(role_name)").eq("is_active", true).order("created_at", { ascending: false });
      if (error) throw error;
      return response({ accounts: (data ?? []).map((user: any) => ({ id: user.user_id, name: [user.first_name, user.last_name].filter(Boolean).join(" "), email: user.email, branch: user.branch, role: user.roles?.role_name, status: user.is_active ? "Active" : "Inactive", createdAt: new Date(user.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) })) });
    }

    if (action === "delete-user") {
      const userId = String(body.userId ?? "");
      if (!userId) return response({ error: "A user id is required." }, 400);
      if (userId === session.sub) return response({ error: "You cannot remove your own account." }, 400);
      const passwordError = await passwordConfirmationError(session, String(body.password ?? ""));
      if (passwordError) return response({ error: passwordError }, 401);
      const { error } = await db.from("users").update({ is_active: false, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("is_active", true);
      if (error) throw error;
      return response({ message: "User removed from the active directory." });
    }

    if (action === "list-password-reset-requests") {
      const { data, error } = await db
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
      const { data: resetRequest, error } = await db
        .from("password_reset_requests")
        .select("request_id, user_id, status, expires_at")
        .eq("request_id", requestId)
        .maybeSingle();
      if (error) throw error;
      if (!resetRequest) return response({ error: "Reset request not found." }, 404);
      if (resetRequest.status !== "pending") return response({ error: "This request has already been handled." }, 409);

      const handledAt = new Date().toISOString();
      if (decision === "cancel") {
        const { error: cancelError } = await db
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
      const { error: passwordError } = await db
        .from("users")
        .update({ password_hash: await hashPassword(temporaryPassword), updated_at: handledAt })
        .eq("user_id", resetRequest.user_id);
      if (passwordError) throw passwordError;
      const { error: approveError } = await db
        .from("password_reset_requests")
        .update({ status: "approved", handled_by: session.sub, handled_at: handledAt })
        .eq("request_id", requestId);
      if (approveError) throw approveError;
      return response({ message: "Temporary password issued.", temporaryPassword });
    }

    if (action === "list-parts") {
      const { data, error } = await db
        .from("parts")
        .select("part_id, sku, name, category, unit_of_measure, unit_cost, reorder_threshold")
        .eq("is_active", true)
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
      // Archived parts are hidden from the working catalogue but can be listed.
      const archivedOnly = String(body.status ?? "active").toLowerCase() === "archived";
      let inventoryQuery = db
        .from("stock")
        .select("stock_id, part_id, branch, quantity_on_hand, quantity_reserved, parts!inner(part_id, sku, name, category, category_id, unit_of_measure, reorder_threshold, unit_cost, address, notes, is_active)")
        .eq("parts.is_active", !archivedOnly);
      const inventoryBranch = branchScope(session);
      if (inventoryBranch !== null) inventoryQuery = inventoryQuery.eq("branch", inventoryBranch);
      const { data, error } = await inventoryQuery
        .order("branch")
        .order("stock_id");
      if (error) throw error;
      return response({ items: data ?? [] });
    }

    if (action === "list-pending-job-requests") {
      return response({ jobs: await listPendingJobRequests(branchScope(session)) });
    }

    if (action === "list-job-allocation-history") {
      return response({ allocations: await listJobAllocationHistory(branchScope(session)) });
    }

    if (action === "list-job-allocation-stock") {
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

    if (action === "list-part-categories") {
      const { data: categories, error } = await db
        .from("part_categories")
        .select("category_id, name, code_prefix, is_active")
        .order("name");
      if (error) throw error;

      const { data: partRows, error: partsError } = await db
        .from("parts")
        .select("sku, category_id");
      if (partsError) throw partsError;

      const skus = (partRows ?? []).map((row: any) => row.sku);
      const counts = new Map<string, number>();
      for (const row of partRows ?? []) {
        if (!row.category_id) continue;
        counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
      }

      return response({
        categories: (categories ?? []).map((category: any) => ({
          id: category.category_id,
          name: category.name,
          prefix: category.code_prefix,
          active: category.is_active,
          partCount: counts.get(category.category_id) ?? 0,
          nextSku: nextSkuFor(skus, category.code_prefix),
        })),
      });
    }

    if (action === "save-part-category") {
      const categoryId = String(body.categoryId ?? "").trim();
      const name = String(body.name ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
      const prefix = String(body.prefix ?? "").trim().toUpperCase();
      const isActive = body.isActive === undefined ? true : Boolean(body.isActive);
      if (!name) return response({ error: "A category name is required." }, 400);
      if (!/^[A-Z0-9]{2,6}$/.test(prefix)) {
        return response({ error: "The code prefix must be 2–6 letters or digits." }, 400);
      }

      // Case-insensitive uniqueness is what the indexes enforce; checking first
      // lets the UI name the field that collided instead of showing a raw 23505.
      const { data: existingRows, error: existingError } = await db
        .from("part_categories")
        .select("category_id, name, code_prefix");
      if (existingError) throw existingError;
      const others = (existingRows ?? []).filter((row: any) => row.category_id !== categoryId);
      if (others.some((row: any) => String(row.name).toLowerCase() === name.toLowerCase())) {
        return response({ error: "A category with that name already exists." }, 409);
      }
      if (others.some((row: any) => String(row.code_prefix).toUpperCase() === prefix)) {
        return response({ error: "Another category already uses that code prefix." }, 409);
      }

      if (categoryId) {
        const { data: current, error: currentError } = await db
          .from("part_categories")
          .select("category_id, name")
          .eq("category_id", categoryId)
          .maybeSingle();
        if (currentError) throw currentError;
        if (!current) return response({ error: "That category no longer exists." }, 404);

        const { error: updateError } = await db
          .from("part_categories")
          .update({ name, code_prefix: prefix, is_active: isActive })
          .eq("category_id", categoryId);
        if (updateError) throw updateError;

        // parts.category is the display text every read path uses, so a rename
        // has to follow. Existing SKUs are deliberately left alone.
        if (current.name !== name) {
          const { error: syncError } = await db
            .from("parts")
            .update({ category: name })
            .eq("category_id", categoryId);
          if (syncError) throw syncError;
        }
        return response({ category: { id: categoryId, name, prefix, active: isActive } });
      }

      const { data: created, error: createError } = await db
        .from("part_categories")
        .insert({ name, code_prefix: prefix, is_active: isActive, created_by: session.sub })
        .select("category_id, name, code_prefix, is_active")
        .single();
      if (createError) {
        if (createError.code === "23505") {
          return response({ error: "A category with that name or prefix already exists." }, 409);
        }
        throw createError;
      }
      return response({
        category: {
          id: created.category_id,
          name: created.name,
          prefix: created.code_prefix,
          active: created.is_active,
        },
      }, 201);
    }

    if (["create-inventory-item", "update-inventory-item"].includes(action)) {
      const item = body.item && typeof body.item === "object" ? body.item : {};
      const name = String(item.name ?? "").trim();
      const requestedSku = String(item.sku ?? "").trim();
      const categoryId = String(item.categoryId ?? "").trim();
      const unitOfMeasure = String(item.unitOfMeasure ?? "").trim();
      const branch = scopedBranch(session, item.branch);
      const address = String(item.address ?? "").trim();
      const notes = String(item.notes ?? "").trim();
      const quantity = Number(item.quantity);
      const reorderThreshold = Number(item.reorderThreshold);
      const unitCost = Number(item.unitCost);

      // A managed category decides the label and the code prefix; the text value
      // on the request is only a fallback for callers that predate the table.
      let categoryName = String(item.category ?? "").trim();
      let categoryRecord: any = null;
      if (categoryId) {
        const { data: categoryRow, error: categoryError } = await db
          .from("part_categories")
          .select("category_id, name, code_prefix, is_active")
          .eq("category_id", categoryId)
          .maybeSingle();
        if (categoryError) throw categoryError;
        if (!categoryRow) return response({ error: "That category no longer exists." }, 400);
        if (action === "create-inventory-item" && !categoryRow.is_active) {
          return response({ error: "That category is inactive. Choose another one." }, 400);
        }
        categoryRecord = categoryRow;
        categoryName = categoryRow.name;
      }

      // An empty code on a create means "generate it from the category".
      const isGeneratedSku = action === "create-inventory-item" && !requestedSku && Boolean(categoryRecord);
      let sku = requestedSku;
      if (isGeneratedSku) {
        const { data: skuRows, error: skuError } = await db.from("parts").select("sku");
        if (skuError) throw skuError;
        sku = nextSkuFor((skuRows ?? []).map((row: any) => row.sku), categoryRecord.code_prefix);
      }

      if (!name || !sku || !categoryName || !unitOfMeasure || !address || !["makati", "cebu"].includes(branch) || !Number.isInteger(quantity) || quantity < 0 || !Number.isInteger(reorderThreshold) || reorderThreshold < 0 || !Number.isFinite(unitCost) || unitCost < 0) {
        return response({ error: "Please provide valid item details, branch, stock level, and unit price." }, 400);
      }

      const partValues = {
        sku,
        name,
        category: categoryName,
        unit_of_measure: unitOfMeasure,
        reorder_threshold: reorderThreshold,
        unit_cost: unitCost,
        address,
        notes: notes || null,
      };
      // On an update without a categoryId, leave the existing link untouched
      // instead of nulling it.
      if (categoryId) partValues.category_id = categoryId;

      if (action === "create-inventory-item") {
        let part: any = null;
        let partError: any = null;
        // A generated code can lose a race with a simultaneous create. Recompute
        // from the live table and retry instead of failing the whole request.
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const inserted = await db
            .from("parts")
            .insert(partValues)
            .select("part_id")
            .single();
          part = inserted.data;
          partError = inserted.error;
          if (!partError) break;
          if (partError.code !== "23505" || !isGeneratedSku) break;
          const { data: skuRows, error: skuError } = await db.from("parts").select("sku");
          if (skuError) throw skuError;
          const regenerated = nextSkuFor(
            (skuRows ?? []).map((row: any) => row.sku),
            categoryRecord.code_prefix,
          );
          if (regenerated === partValues.sku) break;
          partValues.sku = regenerated;
        }
        if (partError) {
          if (partError.code !== "23505") throw partError;

          // Reuse an archived part with the same SKU rather than blocking the code
          // forever. Opening stock still has to be booked as a movement.
          const { data: archivedPart, error: archivedError } = await db
            .from("parts")
            .select("part_id, is_active")
            .eq("sku", partValues.sku)
            .maybeSingle();
          if (archivedError) throw archivedError;
          if (!archivedPart || archivedPart.is_active) {
            return response({ error: "An item with this code already exists." }, 409);
          }

          const { error: reactivateError } = await db
            .from("parts")
            .update({ ...partValues, is_active: true })
            .eq("part_id", archivedPart.part_id);
          if (reactivateError) throw reactivateError;

          const { data: stockRow, error: stockLookupError } = await db
            .from("stock")
            .select("stock_id")
            .eq("part_id", archivedPart.part_id)
            .eq("branch", branch)
            .maybeSingle();
          if (stockLookupError) throw stockLookupError;
          if (!stockRow) {
            const { error: stockInsertError } = await db
              .from("stock")
              .insert({ part_id: archivedPart.part_id, branch, quantity_on_hand: 0 });
            if (stockInsertError) throw stockInsertError;
          }
          if (quantity > 0) {
            const { error: movementError } = await db.from("stock_movements").insert({
              part_id: archivedPart.part_id,
              branch,
              direction: "in",
              quantity,
              reason: "restock",
              performed_by: session.sub,
            });
            if (movementError) throw movementError;
          }
          return response({ message: "Inventory item restored from the archive.", restored: true }, 200);
        }

        const { error: stockError } = await db
          .from("stock")
          .insert({ part_id: part.part_id, branch, quantity_on_hand: 0 });
        if (stockError) {
          await db.from("parts").delete().eq("part_id", part.part_id);
          throw stockError;
        }

        if (quantity > 0) {
          const { error: movementError } = await db.from("stock_movements").insert({
            part_id: part.part_id,
            branch,
            direction: "in",
            quantity,
            reason: "restock",
            performed_by: session.sub,
          });
          if (movementError) {
            await db.from("stock").delete().eq("part_id", part.part_id);
            await db.from("parts").delete().eq("part_id", part.part_id);
            throw movementError;
          }
        }
        return response({ message: "Inventory item created." }, 201);
      }

      const stockId = String(body.stockId ?? "");
      const partId = String(body.partId ?? "");
      const { data: stock, error: stockLookupError } = await db
        .from("stock")
        .select("stock_id, part_id, branch")
        .eq("stock_id", stockId)
        .eq("part_id", partId)
        .maybeSingle();
      if (stockLookupError) throw stockLookupError;
      if (!stock) return response({ error: "This inventory item no longer exists." }, 404);
      if (branchScope(session) !== null && String(stock.branch) !== String(session.branch)) {
        return response({ error: "This stock row belongs to another branch." }, 403);
      }

      if (stock.branch !== branch) {
        const { data: existingStock, error: duplicateBranchError } = await db
          .from("stock")
          .select("stock_id")
          .eq("part_id", partId)
          .eq("branch", branch)
          .maybeSingle();
        if (duplicateBranchError) throw duplicateBranchError;
        if (existingStock) return response({ error: "This item already has a stock record for that branch." }, 409);
      }

      const { error: partUpdateError } = await db.from("parts").update(partValues).eq("part_id", partId);
      if (partUpdateError) {
        if (partUpdateError.code === "23505") return response({ error: "An item with this code already exists." }, 409);
        throw partUpdateError;
      }
      if (stock.branch !== branch) {
        const { error: branchUpdateError } = await db.from("stock").update({ branch }).eq("stock_id", stockId);
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

      const { data: stock, error: stockLookupError } = await db
        .from("stock")
        .select("part_id, branch, quantity_on_hand, quantity_reserved")
        .eq("stock_id", stockId)
        .maybeSingle();
      if (stockLookupError) throw stockLookupError;
      if (!stock) return response({ error: "This inventory item no longer exists." }, 404);
      if (branchScope(session) !== null && String(stock.branch) !== String(session.branch)) {
        return response({ error: "This stock row belongs to another branch." }, 403);
      }
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

      const { error: movementError } = await db.from("stock_movements").insert({
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

    if (action === "list-technicians") {
      return response({ technicians: await listTechnicians(String(body.date ?? ""), String(body.excludeOrder ?? "")) });
    }

    if (action === "list-schedules") {
      return response({ schedules: await listSchedules(branchScope(session)) });
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
        const result = await submitFieldReport(session, body || {}, db);
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
      const { data: assignment, error: assignmentError } = await db
        .from("job_technicians")
        .select("job_id")
        .eq("job_id", jobId)
        .eq("technician_id", technicianId)
        .eq("is_active", true)
        .maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignment) return response({ error: "You are not assigned to this job." }, 403);

      const path = `reports/${jobId}/${session.sub}/${crypto.randomUUID()}.${attachmentExtension(contentType)}`;
      const { data: signed, error: signError } = await db.storage
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

    if (action === "migrate-report-attachments") {
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
    

    if (action === "list-audit-log") {
      const first = (value: any) => (Array.isArray(value) ? value[0] : value);
      const limit = Math.min(Math.max(Number(body.limit) || 30, 1), 100);
      const offset = Math.max(Number(body.offset) || 0, 0);
      const table = String(body.table ?? "").trim();
      // Read as auditAction: `action` is the RPC name in the request body.
      const actionFilter = String(body.auditAction ?? "").trim();
      const actorId = String(body.actorId ?? "").trim();
      const recordId = String(body.recordId ?? "").trim();
      const from = String(body.from ?? "").trim();
      const to = String(body.to ?? "").trim();
      // Commas and parentheses would break the PostgREST filter grammar, so only
      // word characters, spaces, dashes, dots, and colons reach the query.
      const search = String(body.search ?? "").replace(/[^a-z0-9 _.:-]/gi, "").trim().slice(0, 60);

      // Filters are applied per query so the page and the two stat counts always
      // agree, without duplicating the condition list. The helper takes a query
      // that has already called .select(); .from() alone has no filter methods.
      const applyFilters = (query: any) => {
        let next = query;
        if (table) next = next.eq("table_name", table);
        if (actionFilter && ["insert", "update", "delete"].includes(actionFilter)) {
          next = next.eq("action", actionFilter);
        }
        if (actorId) next = next.eq("changed_by", actorId);
        if (recordId) next = next.eq("record_id", recordId);
        if (/^\d{4}-\d{2}-\d{2}$/.test(from)) next = next.gte("changed_at", `${from}T00:00:00Z`);
        if (/^\d{4}-\d{2}-\d{2}$/.test(to)) next = next.lte("changed_at", `${to}T23:59:59.999Z`);
        if (search) {
          next = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search)
            ? next.eq("record_id", search)
            : next.ilike("table_name", `%${search}%`);
        }
        return next;
      };

      const query = applyFilters(
        db
          .from("audit_log")
          .select(
            `audit_id, table_name, record_id, record_key, action, changed_at, old_values, new_values,
             users!audit_log_changed_by_fkey(user_id, first_name, last_name, email, roles(role_name))`,
            { count: "exact" },
          ),
      )
        .order("changed_at", { ascending: false })
        .order("audit_id", { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: entries, error, count } = await query;
      if (error) throw error;

      // Resolve a human reference (work order, invoice number, client name) for
      // the rows on this page in one query per table, instead of the UI showing
      // raw UUIDs.
      const labelSources: Record<string, { column: string; columns: string; label: (row: any) => string }> = {
        jobs: { column: "job_id", columns: "job_id, job_number", label: (row: any) => row.job_number ?? "" },
        invoices: { column: "invoice_id", columns: "invoice_id, invoice_number", label: (row: any) => row.invoice_number ?? "" },
        field_reports: { column: "report_id", columns: "report_id, report_number", label: (row: any) => row.report_number ?? "" },
        quotations: { column: "quotation_id", columns: "quotation_id, quotation_number", label: (row: any) => row.quotation_number ?? "" },
        clients: { column: "client_id", columns: "client_id, name", label: (row: any) => row.name ?? "" },
        parts: { column: "part_id", columns: "part_id, sku", label: (row: any) => row.sku ?? "" },
        users: { column: "user_id", columns: "user_id, first_name, last_name", label: (row: any) => [row.first_name, row.last_name].filter(Boolean).join(" ") },
        job_templates: { column: "template_id", columns: "template_id, name", label: (row: any) => row.name ?? "" },
      };
      const idsByTable = new Map<string, Set<string>>();
      for (const entry of entries ?? []) {
        const source = labelSources[entry.table_name];
        if (!source || !entry.record_id) continue;
        if (!idsByTable.has(entry.table_name)) idsByTable.set(entry.table_name, new Set());
        idsByTable.get(entry.table_name)!.add(String(entry.record_id));
      }
      const recordLabels = new Map<string, string>();
      await Promise.all(
        [...idsByTable.entries()].map(async ([tableName, ids]) => {
          const source = labelSources[tableName];
          const { data: rows, error: labelError } = await db
            .from(tableName)
            .select(source.columns)
            .in(source.column, [...ids]);
          if (labelError) return; // A missing label is cosmetic; never fail the log.
          for (const row of rows ?? []) {
            recordLabels.set(`${tableName}:${row[source.column]}`, source.label(row));
          }
        }),
      );

      // A value longer than this is almost always an embedded document or a
      // legacy data URL; the diff shows a marker instead of shipping the blob.
      const MAX_VALUE_LENGTH = 400;
      const readableValue = (value: any) => {
        if (value === null || value === undefined) return null;
        if (typeof value === "string") {
          return value.length > MAX_VALUE_LENGTH
            ? `${value.slice(0, MAX_VALUE_LENGTH)}…`
            : value;
        }
        if (typeof value === "number" || typeof value === "boolean") return value;
        const text = JSON.stringify(value);
        return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text;
      };
      // Timestamps are bookkeeping, not edits; a row update that only touches
      // updated_at would otherwise look like a change in the diff.
      const diff = (before: any, after: any) => {
        const oldRow = before && typeof before === "object" ? before : {};
        const newRow = after && typeof after === "object" ? after : {};
        const fields = new Set([...Object.keys(oldRow), ...Object.keys(newRow)]);
        const changed = [];
        for (const field of fields) {
          if (field === "updated_at" || field === "created_at") continue;
          const previous = oldRow[field] ?? null;
          const next = newRow[field] ?? null;
          if (JSON.stringify(previous) === JSON.stringify(next)) continue;
          changed.push({ field, before: readableValue(previous), after: readableValue(next) });
          if (changed.length >= 30) break;
        }
        return changed;
      };

      const mapped = (entries ?? []).map((entry: any) => {
        const actor = first(entry.users);
        const actorRole = actor && (Array.isArray(actor.roles) ? actor.roles[0]?.role_name : actor.roles?.role_name);
        return {
          id: entry.audit_id,
          table: entry.table_name,
          action: entry.action,
          recordId: entry.record_id,
          recordKey: entry.record_key ?? null,
          recordLabel: recordLabels.get(`${entry.table_name}:${entry.record_id}`) ?? "",
          changedAt: entry.changed_at,
          actor: actor
            ? {
                id: actor.user_id ?? null,
                name: [actor.first_name, actor.last_name].filter(Boolean).join(" ") || actor.email,
                role: actorRole ?? "",
                email: actor.email,
              }
            : null,
          changes: diff(entry.old_values, entry.new_values),
        };
      });

      // The filter list is static per session; only load it with the first page.
      let actors: Array<{ id: string; name: string; role: string; active: boolean }> = [];
      let stats: { today: number; week: number } | null = null;
      if (offset === 0) {
        const { data: userRows, error: usersError } = await db
          .from("users")
          .select("user_id, first_name, last_name, is_active, roles(role_name)")
          .order("first_name");
        if (usersError) throw usersError;
        actors = (userRows ?? []).map((user: any) => ({
          id: user.user_id,
          name: [user.first_name, user.last_name].filter(Boolean).join(" "),
          role: (Array.isArray(user.roles) ? user.roles[0]?.role_name : user.roles?.role_name) ?? "",
          active: user.is_active,
        }));

        // Activity pulse, scoped to the same filters as the list.
        const now = Date.now();
        const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
        const [todayResult, weekResult] = await Promise.all([
          applyFilters(db.from("audit_log").select("audit_id", { count: "exact", head: true })).gte("changed_at", dayAgo),
          applyFilters(db.from("audit_log").select("audit_id", { count: "exact", head: true })).gte("changed_at", weekAgo),
        ]);
        stats = { today: todayResult.count ?? 0, week: weekResult.count ?? 0 };
      }

      return response({ entries: mapped, total: count ?? mapped.length, limit, offset, actors, stats });
    }

    if (action === "list-invoices") {
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

    if (action === "list-invoice-candidates") {
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

    if (action === "create-invoice") {
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

    if (action === "get-schedule") {
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

    if (action === "update-schedule") {
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

    if (action === "confirm-job-assignment") {
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

    if (action === "list-clients") {
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

    if (action === "create-job-from-template") {
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

    if (action === "delete-job-template") {
      const templateId = String(body.templateId ?? "").trim();
      if (!templateId) return response({ error: "Choose a template to remove." }, 400);
      const passwordError = await passwordConfirmationError(session, String(body.password ?? ""));
      if (passwordError) return response({ error: passwordError }, 401);

      const { data: template, error } = await db
        .from("job_templates")
        .select("template_id, name, branch")
        .eq("template_id", templateId)
        .maybeSingle();
      if (error) throw error;
      if (!template) return response({ error: "Template not found." }, 404);
      if (branchScope(session) !== null && String(template.branch ?? "") !== String(session.branch)) {
        return response({ error: "This template belongs to another branch." }, 403);
      }

      // A template referenced by a quotation cannot be deleted; archive it so the
      // quotes keep their record and the picker stops offering it.
      const { count, error: usageError } = await db
        .from("quotations")
        .select("quotation_id", { count: "exact", head: true })
        .eq("template_id", templateId);
      if (usageError) throw usageError;

      if ((count ?? 0) > 0) {
        const { error: archiveError } = await db
          .from("job_templates")
          .update({ is_active: false })
          .eq("template_id", templateId);
        if (archiveError) throw archiveError;
        return response({
          action: "archived",
          usedOnQuotations: count,
          message:
            '"' +
            template.name +
            '" is used on ' +
            count +
            " quotation" +
            (count === 1 ? "" : "s") +
            ", so it was archived instead of deleted.",
        });
      }

      const { error: deleteError } = await db
        .from("job_templates")
        .delete()
        .eq("template_id", templateId);
      if (deleteError) throw deleteError;
      return response({
        action: "deleted",
        usedOnQuotations: 0,
        message: '"' + template.name + '" was deleted.',
      });
    }

    if (action === "delete-job") {
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

    if (action === "delete-inventory-part") {
      const partId = String(body.partId ?? "").trim();
      if (!partId) return response({ error: "Choose a part to remove." }, 400);
      const passwordError = await passwordConfirmationError(session, String(body.password ?? ""));
      if (passwordError) return response({ error: passwordError }, 401);

      const { data: part, error } = await db
        .from("parts")
        .select("part_id, name, sku")
        .eq("part_id", partId)
        .maybeSingle();
      if (error) throw error;
      if (!part) return response({ error: "Part not found." }, 404);

      const { data: stockRows, error: stockError } = await db
        .from("stock")
        .select("stock_id, quantity_on_hand, quantity_reserved")
        .eq("part_id", partId);
      if (stockError) throw stockError;
      const stillStocked = (stockRows ?? []).find(
        (row: any) => Number(row.quantity_on_hand) > 0 || Number(row.quantity_reserved) > 0,
      );
      if (stillStocked) {
        return response({ error: "This part still has stock on hand and cannot be deleted." }, 409);
      }

      const [
        { count: reservations },
        { count: movements },
        { count: usage },
        { count: requisitions },
        { count: templateLines },
        { count: quoteLines },
      ] = await Promise.all([
        db.from("job_parts").select("part_id", { count: "exact", head: true }).eq("part_id", partId),
        db.from("stock_movements").select("part_id", { count: "exact", head: true }).eq("part_id", partId),
        db.from("report_parts_used").select("part_id", { count: "exact", head: true }).eq("part_id", partId),
        db.from("requisitions").select("part_id", { count: "exact", head: true }).eq("part_id", partId),
        db.from("job_template_items").select("part_id", { count: "exact", head: true }).eq("part_id", partId),
        db.from("quotation_line_items").select("part_id", { count: "exact", head: true }).eq("part_id", partId),
      ]);
      const blockers = [
        reservations ? String(reservations) + " stock reservation" + (reservations === 1 ? "" : "s") : "",
        movements ? String(movements) + " stock movement" + (movements === 1 ? "" : "s") : "",
        usage ? String(usage) + " report usage" + (usage === 1 ? "" : "s") : "",
        requisitions ? String(requisitions) + " requisition" + (requisitions === 1 ? "" : "s") : "",
        templateLines ? String(templateLines) + " template line" + (templateLines === 1 ? "" : "s") : "",
        quoteLines ? String(quoteLines) + " quotation line" + (quoteLines === 1 ? "" : "s") : "",
      ].filter(Boolean);
      if (blockers.length) {
        // Movements are append-only, so history can never be deleted. Archive the
        // part instead: it leaves the catalogue and keeps its records.
        const { error: archiveError } = await db
          .from("parts")
          .update({ is_active: false })
          .eq("part_id", partId);
        if (archiveError) throw archiveError;
        return response({
          action: "archived",
          message: part.name + " (" + part.sku + ") was archived. It is hidden from the catalogue but kept in the stock records.",
          references: blockers,
        });
      }

      const { error: stockDeleteError } = await db.from("stock").delete().eq("part_id", partId);
      if (stockDeleteError) throw stockDeleteError;
      const { error: partDeleteError } = await db.from("parts").delete().eq("part_id", partId);
      if (partDeleteError) throw partDeleteError;
      return response({ message: part.name + " (" + part.sku + ") was deleted." });
    }

    if (action === "restore-inventory-part") {
      const partId = String(body.partId ?? "").trim();
      if (!partId) return response({ error: "Choose a part to restore." }, 400);
      const { data: part, error } = await db
        .from("parts")
        .select("part_id, name, sku, is_active")
        .eq("part_id", partId)
        .maybeSingle();
      if (error) throw error;
      if (!part) return response({ error: "Part not found." }, 404);
      if (part.is_active) return response({ message: "That part is already active." });

      const { error: updateError } = await db
        .from("parts")
        .update({ is_active: true })
        .eq("part_id", partId);
      if (updateError) throw updateError;
      return response({ message: part.name + " (" + part.sku + ") was restored." });
    }

    return response({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error(error);
    return response({ error: "Unable to complete the request." }, 500);
  }
});
