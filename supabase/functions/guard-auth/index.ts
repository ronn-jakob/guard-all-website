declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};
declare const btoa: (value: string) => string;
declare const atob: (value: string) => string;

// @ts-ignore - This editor is not running the Deno runtime, so these edge runtime shims are not available here.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, createRequestClient, response, supabaseAdmin } from "./shared.ts";
import { verifyToken } from "./auth.ts";
import {
  handleAllocateJobStock,
  handleConfirmJobAssignment,
  handleCreateJobFromTemplate,
  handleCreateSchedule,
  handleDeleteJob,
  handleGetSchedule,
  handleListClients,
  handleListJobAllocationHistory,
  handleListJobAllocationStock,
  handleListPendingJobRequests,
  handleListSchedules,
  handleListTechnicians,
  handleUpdateSchedule,
} from "./handlers/scheduling.ts";
import {
  handleChangePassword,
  handleCreateProfilePhotoUpload,
  handleGetProfile,
  handleRemoveProfilePhoto,
  handleUpdateProfile,
  handleUpdateProfilePhoto,
} from "./handlers/profile.ts";
import {
  handleCreateReportUpload,
  handleDiscardReportUpload,
  handleListFieldReportJobs,
  handleListFieldReports,
  handleMigrateReportAttachments,
  handleResubmitFieldReport,
  handleReviewFieldReport,
  handleSubmitFieldReport,
} from "./handlers/reports.ts";
import {
  isFieldReportRole,
  isSalesBillingRole,
  isSchedulingRole,
} from "./roles.ts";
import {
  handleDeleteJobTemplate,
  handleListJobTemplates,
  handleSaveJobTemplate,
} from "./handlers/templates.ts";
import {
  handleCreateAccount,
  handleDeleteUser,
  handleListPasswordResetRequests,
  handleListUsers,
  handleResolvePasswordReset,
} from "./handlers/accounts.ts";
import { handleLogin, handleRequestPasswordReset } from "./handlers/session.ts";
import { handleListAuditLog } from "./handlers/audit.ts";
import { handleCreateInvoice, handleListInvoiceCandidates, handleListInvoices, handleRecordPayment } from "./handlers/billing.ts";
import { handleAdjustInventoryStock, handleCreateOrUpdateInventoryItem, handleDeleteInventoryPart, handleListInventory, handleListPartCategories, handleListParts, handleListStockMovements, handleRestoreInventoryPart, handleSavePartCategory } from "./handlers/inventory.ts";
import { handleDashboardSummary } from "./handlers/dashboard.ts";
const schedulingActions = new Set(["list-technicians", "list-schedules", "create-schedule", "get-schedule", "update-schedule", "confirm-job-assignment", "create-job-from-template", "list-clients", "delete-job"]);
const fieldReportActions = new Set(["list-field-report-jobs", "list-field-reports", "submit-field-report", "resubmit-field-report", "create-report-upload", "discard-report-upload"]);
const inventoryActions = new Set(["list-inventory", "create-inventory-item", "adjust-inventory-stock", "update-inventory-item", "delete-inventory-part", "restore-inventory-part", "list-part-categories", "save-part-category", "list-stock-movements"]);
const jobAllocationActions = new Set(["list-pending-job-requests", "list-job-allocation-stock", "allocate-job-stock", "list-job-allocation-history"]);
// Invoicing and payments belong to the sales_billing module (Billing Staff, Admin).
const billingActions = new Set(["list-invoices", "list-invoice-candidates", "create-invoice", "record-payment", "delete-job-template"]);
// Actions a signed-in user may perform on their own account, bypassing the module role check.
const selfServiceActions = new Set(["change-password", "update-profile", "get-profile", "create-profile-photo-upload", "update-profile-photo", "remove-profile-photo"]);
// The landing dashboard is available to every signed-in user; the payload itself is
// role-aware, so financial figures never reach roles that should not see them.
const universalActions = new Set(["dashboard-summary"]);

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

    if (action === "login") return handleLogin({ body, db });

    if (action === "request-password-reset") return handleRequestPasswordReset({ body, db });

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

    if (action === "dashboard-summary") return handleDashboardSummary({ session, db });

    if (action === "change-password") return handleChangePassword({ body, session, db });

    if (action === "update-profile") return handleUpdateProfile({ body, session, db });

    if (action === "get-profile") return handleGetProfile({ session, db });

    if (action === "create-profile-photo-upload") return handleCreateProfilePhotoUpload({ body, session, db });

    if (action === "update-profile-photo") return handleUpdateProfilePhoto({ body, session, db });

    if (action === "remove-profile-photo") return handleRemoveProfilePhoto({ session, db });

    if (action === "list-job-templates") return handleListJobTemplates({ session });

    if (action === "save-job-template") return handleSaveJobTemplate({ body, session, db });

    if (action === "create-account") return handleCreateAccount({ body, session, db });

    if (action === "list-users") return handleListUsers({ db });

    if (action === "delete-user") return handleDeleteUser({ body, session, db });

    if (action === "list-password-reset-requests") return handleListPasswordResetRequests({ db });

    if (action === "resolve-password-reset") return handleResolvePasswordReset({ body, session, db });

    if (action === "list-parts") return handleListParts({ db });

    if (action === "list-inventory") return handleListInventory({ body, session, db });

    if (action === "list-stock-movements") return handleListStockMovements({ body, session, db });

    if (action === "list-pending-job-requests") return handleListPendingJobRequests({ session });

    if (action === "list-job-allocation-history") return handleListJobAllocationHistory({ session });

    if (action === "list-job-allocation-stock") return handleListJobAllocationStock({ body, session, db });

    if (action === "allocate-job-stock") return handleAllocateJobStock({ body, session, db });

    if (action === "list-part-categories") return handleListPartCategories({ db });

    if (action === "save-part-category") return handleSavePartCategory({ body, session, db });

    if (["create-inventory-item", "update-inventory-item"].includes(action)) return handleCreateOrUpdateInventoryItem({ body, session, db, action });

    if (action === "adjust-inventory-stock") return handleAdjustInventoryStock({ body, session, db });

    if (action === "review-field-report") return handleReviewFieldReport({ body, session, db });

    if (action === "list-technicians") return handleListTechnicians({ body });

    if (action === "list-schedules") return handleListSchedules({ session });

    if (action === "list-field-report-jobs") return handleListFieldReportJobs({ session });

    if (action === "list-field-reports") return handleListFieldReports({ body, session });

    if (action === "submit-field-report") return handleSubmitFieldReport({ body, session, db });

    if (action === "resubmit-field-report") return handleResubmitFieldReport({ body, session, db });

    if (action === "create-report-upload") return handleCreateReportUpload({ body, session, db });

    if (action === "discard-report-upload") return handleDiscardReportUpload({ body, session, db });

    if (action === "migrate-report-attachments") return handleMigrateReportAttachments({ db });
    

    if (action === "list-audit-log") return handleListAuditLog({ body, db });

    if (action === "list-invoices") return handleListInvoices({ session, db });

    if (action === "list-invoice-candidates") return handleListInvoiceCandidates({ session, db });

    if (action === "create-invoice") return handleCreateInvoice({ body, session, db });

    if (action === "record-payment") return handleRecordPayment({ body, session, db });

    if (action === "get-schedule") return handleGetSchedule({ body, session, db });

    if (action === "update-schedule") return handleUpdateSchedule({ body, session, db });

    if (action === "confirm-job-assignment") return handleConfirmJobAssignment({ body, session, db });

    if (action === "list-clients") return handleListClients({ body, db });

    if (action === "create-job-from-template") return handleCreateJobFromTemplate({ body, session, db });

    if (action === "create-schedule") return handleCreateSchedule({ body, session, db });

    if (action === "delete-job-template") return handleDeleteJobTemplate({ body, session, db });

    if (action === "delete-job") return handleDeleteJob({ body, session, db });

    if (action === "delete-inventory-part") return handleDeleteInventoryPart({ body, session, db });

    if (action === "restore-inventory-part") return handleRestoreInventoryPart({ body, session, db });

    return response({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error(error);
    return response({ error: "Unable to complete the request." }, 500);
  }
});
