import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../auth.js", () => ({ callAuthFunction: vi.fn() }));

import { callAuthFunction } from "../auth.js";
import { AUDIT_ACTIONS, listAuditLog } from "./audit.js";
import {
  ACCOUNT_ACTIONS,
  createAccount,
  deleteUser,
  listPasswordResetRequests,
  listUsers,
  resolvePasswordReset,
} from "./accounts.js";
import {
  BILLING_ACTIONS,
  createInvoice,
  listInvoiceCandidates,
  listInvoices,
  recordPayment,
} from "./billing.js";
import {
  PROFILE_ACTIONS,
  changePassword,
  createProfilePhotoUpload,
  getProfile,
  removeProfilePhoto,
  updateProfile,
  updateProfilePhoto,
} from "./profile.js";
import { SESSION_ACTIONS, login, requestPasswordReset } from "./session.js";
import { DASHBOARD_ACTIONS, getDashboardSummary } from "./dashboard.js";
import {
  SCHEDULING_ACTIONS,
  confirmJobAssignment,
  createJobFromTemplate,
  deleteJob,
  getSchedule,
  listClients,
  listSchedules,
  listTechnicians,
  updateSchedule,
} from "./scheduling.js";
import {
  REPORT_ACTIONS,
  createReportUpload,
  discardReportUpload,
  listFieldReportJobs,
  listFieldReports,
  resubmitFieldReport,
  reviewFieldReport,
  submitFieldReport,
} from "./reports.js";
import {
  INVENTORY_ACTIONS,
  adjustInventoryStock,
  allocateJobStock,
  createInventoryItem,
  deleteInventoryPart,
  listInventory,
  listJobAllocationHistory,
  listJobAllocationStock,
  listPartCategories,
  listPendingJobRequests,
  listStockMovements,
  restoreInventoryPart,
  savePartCategory,
  updateInventoryItem,
} from "./inventory.js";
import {
  TEMPLATE_ACTIONS,
  deleteJobTemplate,
  listJobTemplates,
  listParts,
  saveJobTemplate,
} from "./templates.js";

describe("audit api", () => {
  beforeEach(() => {
    callAuthFunction.mockReset();
    callAuthFunction.mockResolvedValue({ entries: [] });
  });

  it("sends the list action and passes the parameters through", async () => {
    await listAuditLog({ limit: 30, offset: 0, auditAction: "update" });
    expect(callAuthFunction).toHaveBeenCalledWith(AUDIT_ACTIONS.list, {
      limit: 30,
      offset: 0,
      auditAction: "update",
    });
  });

  it("defaults to an empty payload", async () => {
    await listAuditLog();
    expect(callAuthFunction).toHaveBeenCalledWith(AUDIT_ACTIONS.list, {});
  });
});

describe("billing api", () => {
  beforeEach(() => {
    callAuthFunction.mockReset();
    callAuthFunction.mockResolvedValue({});
  });

  it("uses the documented action names", () => {
    expect(BILLING_ACTIONS).toEqual({
      listInvoices: "list-invoices",
      listCandidates: "list-invoice-candidates",
      createInvoice: "create-invoice",
      recordPayment: "record-payment",
    });
  });

  it("lists invoices without a payload", async () => {
    await listInvoices();
    expect(callAuthFunction).toHaveBeenCalledWith("list-invoices");
  });

  it("forwards candidate, invoice, and payment payloads unchanged", async () => {
    await listInvoiceCandidates();
    expect(callAuthFunction).toHaveBeenLastCalledWith("list-invoice-candidates");

    const invoice = { reportId: "r1", dueDate: "2026-11-01", extras: [] };
    await createInvoice(invoice);
    expect(callAuthFunction).toHaveBeenLastCalledWith("create-invoice", invoice);

    const payment = { invoiceId: "i1", amount: 100 };
    await recordPayment(payment);
    expect(callAuthFunction).toHaveBeenLastCalledWith("record-payment", payment);
  });
});

describe("accounts api", () => {
  beforeEach(() => {
    callAuthFunction.mockReset();
    callAuthFunction.mockResolvedValue({});
  });

  it("uses the documented action names", () => {
    expect(ACCOUNT_ACTIONS).toEqual({
      listUsers: "list-users",
      createAccount: "create-account",
      deleteUser: "delete-user",
      listResetRequests: "list-password-reset-requests",
      resolveReset: "resolve-password-reset",
    });
  });

  it("lists users and reset requests without a payload", async () => {
    await listUsers();
    expect(callAuthFunction).toHaveBeenLastCalledWith("list-users");
    await listPasswordResetRequests();
    expect(callAuthFunction).toHaveBeenLastCalledWith("list-password-reset-requests");
  });

  it("forwards create, delete, and resolve payloads", async () => {
    const account = { email: "a@b.c", role: "Technician" };
    await createAccount(account);
    expect(callAuthFunction).toHaveBeenLastCalledWith("create-account", account);

    const removal = { userId: "u1", password: "secret" };
    await deleteUser(removal);
    expect(callAuthFunction).toHaveBeenLastCalledWith("delete-user", removal);

    const decision = { requestId: "r1", decision: "approve" };
    await resolvePasswordReset(decision);
    expect(callAuthFunction).toHaveBeenLastCalledWith(
      "resolve-password-reset",
      decision,
    );
  });
});

describe("profile api", () => {
  beforeEach(() => {
    callAuthFunction.mockReset();
    callAuthFunction.mockResolvedValue({});
  });

  it("uses the documented action names", () => {
    expect(PROFILE_ACTIONS).toEqual({
      get: "get-profile",
      update: "update-profile",
      createPhotoUpload: "create-profile-photo-upload",
      updatePhoto: "update-profile-photo",
      removePhoto: "remove-profile-photo",
      changePassword: "change-password",
    });
  });

  it("loads and removes without a payload", async () => {
    await getProfile();
    expect(callAuthFunction).toHaveBeenLastCalledWith("get-profile");
    await removeProfilePhoto();
    expect(callAuthFunction).toHaveBeenLastCalledWith("remove-profile-photo");
  });

  it("forwards the update, photo, and password payloads", async () => {
    const profile = { firstName: "A", lastName: "B", email: "a@b.c" };
    await updateProfile(profile);
    expect(callAuthFunction).toHaveBeenLastCalledWith("update-profile", profile);

    const upload = { contentType: "image/png", size: 100 };
    await createProfilePhotoUpload(upload);
    expect(callAuthFunction).toHaveBeenLastCalledWith(
      "create-profile-photo-upload",
      upload,
    );

    const photo = { path: "avatars/u/1.png" };
    await updateProfilePhoto(photo);
    expect(callAuthFunction).toHaveBeenLastCalledWith("update-profile-photo", photo);

    const password = { currentPassword: "a", newPassword: "bbbbbbbb" };
    await changePassword(password);
    expect(callAuthFunction).toHaveBeenLastCalledWith("change-password", password);
  });
});

describe("session api", () => {
  beforeEach(() => {
    callAuthFunction.mockReset();
    callAuthFunction.mockResolvedValue({});
  });

  it("uses the documented action names", () => {
    expect(SESSION_ACTIONS).toEqual({
      login: "login",
      requestPasswordReset: "request-password-reset",
    });
  });

  it("forwards the login payload", async () => {
    const credentials = { email: "a@b.c", password: "secret" };
    await login(credentials);
    expect(callAuthFunction).toHaveBeenCalledWith("login", credentials);
  });

  it("forwards the reset payload", async () => {
    const request = { email: "a@b.c" };
    await requestPasswordReset(request);
    expect(callAuthFunction).toHaveBeenCalledWith(
      "request-password-reset",
      request,
    );
  });
});

describe("dashboard api", () => {
  beforeEach(() => {
    callAuthFunction.mockReset();
    callAuthFunction.mockResolvedValue({});
  });

  it("loads the summary without a payload", async () => {
    expect(DASHBOARD_ACTIONS.summary).toBe("dashboard-summary");
    await getDashboardSummary();
    expect(callAuthFunction).toHaveBeenCalledWith("dashboard-summary");
  });
});

describe("scheduling api", () => {
  beforeEach(() => {
    callAuthFunction.mockReset();
    callAuthFunction.mockResolvedValue({});
  });

  it("uses the documented action names", () => {
    expect(SCHEDULING_ACTIONS).toEqual({
      list: "list-schedules",
      get: "get-schedule",
      confirm: "confirm-job-assignment",
      deleteJob: "delete-job",
      listTechnicians: "list-technicians",
      listClients: "list-clients",
      update: "update-schedule",
      createFromTemplate: "create-job-from-template",
    });
  });

  it("forwards the job form lookups and writes", async () => {
    const payload = { date: "2026-10-24", excludeOrder: "WO-1" };
    await listTechnicians(payload);
    expect(callAuthFunction).toHaveBeenLastCalledWith("list-technicians", payload);

    await listClients();
    expect(callAuthFunction).toHaveBeenLastCalledWith("list-clients", {});

    await listClients({ search: "ana" });
    expect(callAuthFunction).toHaveBeenLastCalledWith("list-clients", {
      search: "ana",
    });

    await updateSchedule({ order: "WO-1" });
    expect(callAuthFunction).toHaveBeenLastCalledWith("update-schedule", {
      order: "WO-1",
    });

    await createJobFromTemplate({ templateId: "t1" });
    expect(callAuthFunction).toHaveBeenLastCalledWith(
      "create-job-from-template",
      { templateId: "t1" },
    );
  });

  it("lists schedules without a payload", async () => {
    await listSchedules();
    expect(callAuthFunction).toHaveBeenCalledWith("list-schedules");
  });

  it("forwards the get, confirm, and delete payloads", async () => {
    const order = { order: "WO-00014" };
    await getSchedule(order);
    expect(callAuthFunction).toHaveBeenLastCalledWith("get-schedule", order);

    await confirmJobAssignment(order);
    expect(callAuthFunction).toHaveBeenLastCalledWith(
      "confirm-job-assignment",
      order,
    );

    const removal = { jobNumber: "DRAFT-1", password: "secret" };
    await deleteJob(removal);
    expect(callAuthFunction).toHaveBeenLastCalledWith("delete-job", removal);
  });
});

describe("reports api", () => {
  beforeEach(() => {
    callAuthFunction.mockReset();
    callAuthFunction.mockResolvedValue({});
  });

  it("uses the documented action names", () => {
    expect(REPORT_ACTIONS).toEqual({
      list: "list-field-reports",
      review: "review-field-report",
      listJobs: "list-field-report-jobs",
      createUpload: "create-report-upload",
      discardUpload: "discard-report-upload",
      resubmit: "resubmit-field-report",
      submit: "submit-field-report",
    });
  });

  it("forwards the technician report actions", async () => {
    await listFieldReportJobs();
    expect(callAuthFunction).toHaveBeenLastCalledWith("list-field-report-jobs");

    await createReportUpload({ jobId: "j1" });
    expect(callAuthFunction).toHaveBeenLastCalledWith("create-report-upload", {
      jobId: "j1",
    });

    await discardReportUpload({ path: "p" });
    expect(callAuthFunction).toHaveBeenLastCalledWith("discard-report-upload", {
      path: "p",
    });

    await resubmitFieldReport({ reportId: "r1" });
    expect(callAuthFunction).toHaveBeenLastCalledWith("resubmit-field-report", {
      reportId: "r1",
    });

    await submitFieldReport({ jobId: "j1" });
    expect(callAuthFunction).toHaveBeenLastCalledWith("submit-field-report", {
      jobId: "j1",
    });
  });

  it("defaults the list payload to an empty object", async () => {
    await listFieldReports();
    expect(callAuthFunction).toHaveBeenCalledWith("list-field-reports", {});
  });

  it("forwards the technician filter and the review decision", async () => {
    const filter = { technicianId: "t1" };
    await listFieldReports(filter);
    expect(callAuthFunction).toHaveBeenLastCalledWith("list-field-reports", filter);

    const review = { reportId: "r1", decision: "approve" };
    await reviewFieldReport(review);
    expect(callAuthFunction).toHaveBeenLastCalledWith(
      "review-field-report",
      review,
    );
  });
});

describe("templates api", () => {
  beforeEach(() => {
    callAuthFunction.mockReset();
    callAuthFunction.mockResolvedValue({});
  });

  it("uses the documented action names", () => {
    expect(TEMPLATE_ACTIONS).toEqual({
      list: "list-job-templates",
      listParts: "list-parts",
      save: "save-job-template",
      remove: "delete-job-template",
    });
  });

  it("lists templates and parts without a payload", async () => {
    await listJobTemplates();
    expect(callAuthFunction).toHaveBeenLastCalledWith("list-job-templates");
    await listParts();
    expect(callAuthFunction).toHaveBeenLastCalledWith("list-parts");
  });

  it("forwards the save and delete payloads", async () => {
    const template = { name: "Standard install", items: [] };
    await saveJobTemplate(template);
    expect(callAuthFunction).toHaveBeenLastCalledWith("save-job-template", template);

    const removal = { templateId: "t1", password: "secret" };
    await deleteJobTemplate(removal);
    expect(callAuthFunction).toHaveBeenLastCalledWith(
      "delete-job-template",
      removal,
    );
  });
});

describe("inventory api", () => {
  beforeEach(() => {
    callAuthFunction.mockReset();
    callAuthFunction.mockResolvedValue({});
  });

  it("uses the documented action names", () => {
    expect(INVENTORY_ACTIONS).toEqual({
      list: "list-inventory",
      listCategories: "list-part-categories",
      saveCategory: "save-part-category",
      adjustStock: "adjust-inventory-stock",
      deletePart: "delete-inventory-part",
      restorePart: "restore-inventory-part",
      createItem: "create-inventory-item",
      updateItem: "update-inventory-item",
      allocationStock: "list-job-allocation-stock",
      pendingRequests: "list-pending-job-requests",
      allocationHistory: "list-job-allocation-history",
      allocate: "allocate-job-stock",
      listMovements: "list-stock-movements",
    });
  });

  it("forwards the stock movement range", async () => {
    await listStockMovements({ from: "2026-10-01T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" });
    expect(callAuthFunction).toHaveBeenLastCalledWith("list-stock-movements", {
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-11-01T00:00:00.000Z",
    });
  });

  it("defaults the inventory list payload to an empty object", async () => {
    await listInventory();
    expect(callAuthFunction).toHaveBeenLastCalledWith("list-inventory", {});
  });

  it("forwards the archived filter and category calls", async () => {
    await listInventory({ status: "archived" });
    expect(callAuthFunction).toHaveBeenLastCalledWith("list-inventory", {
      status: "archived",
    });

    await listPartCategories();
    expect(callAuthFunction).toHaveBeenLastCalledWith("list-part-categories");

    await listPendingJobRequests();
    expect(callAuthFunction).toHaveBeenLastCalledWith(
      "list-pending-job-requests",
    );

    await listJobAllocationHistory();
    expect(callAuthFunction).toHaveBeenLastCalledWith(
      "list-job-allocation-history",
    );
  });

  it("forwards the writes without merging create and update", async () => {
    const category = { categoryId: "c1", name: "Intrusion" };
    await savePartCategory(category);
    expect(callAuthFunction).toHaveBeenLastCalledWith(
      "save-part-category",
      category,
    );

    const allocation = { jobNumber: "WO-1", items: [] };
    await allocateJobStock(allocation);
    expect(callAuthFunction).toHaveBeenLastCalledWith(
      "allocate-job-stock",
      allocation,
    );

    const stock = { jobNumber: "WO-1" };
    await listJobAllocationStock(stock);
    expect(callAuthFunction).toHaveBeenLastCalledWith(
      "list-job-allocation-stock",
      stock,
    );

    await adjustInventoryStock({ stockId: "s1", direction: "in" });
    expect(callAuthFunction).toHaveBeenLastCalledWith(
      "adjust-inventory-stock",
      { stockId: "s1", direction: "in" },
    );

    await updateInventoryItem({ stockId: "s1" });
    expect(callAuthFunction).toHaveBeenLastCalledWith("update-inventory-item", {
      stockId: "s1",
    });

    await createInventoryItem({ item: { sku: "DMP-001" } });
    expect(callAuthFunction).toHaveBeenLastCalledWith("create-inventory-item", {
      item: { sku: "DMP-001" },
    });

    await deleteInventoryPart({ partId: "p1", password: "x" });
    expect(callAuthFunction).toHaveBeenLastCalledWith("delete-inventory-part", {
      partId: "p1",
      password: "x",
    });

    await restoreInventoryPart({ partId: "p1" });
    expect(callAuthFunction).toHaveBeenLastCalledWith(
      "restore-inventory-part",
      { partId: "p1" },
    );
  });
});
