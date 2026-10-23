import { describe, expect, it } from "vitest";
import {
  actionLabel,
  buildAuditRequest,
  describeEntry,
  fieldLabel,
  formatAuditValue,
  shortId,
  tableLabel,
} from "./audit.js";

describe("tableLabel", () => {
  it("uses the curated plural and singular labels", () => {
    expect(tableLabel("jobs")).toBe("Jobs");
    expect(tableLabel("jobs", { plural: false })).toBe("Job");
    expect(tableLabel("job_template_items", { plural: false })).toBe("Template line");
  });

  it("sentence-cases an unknown table instead of returning blank", () => {
    expect(tableLabel("audit_log")).toBe("Audit Log");
    expect(tableLabel("")).toBe("");
  });
});

describe("actionLabel", () => {
  it("maps the stored enum values", () => {
    expect(actionLabel("insert")).toBe("Created");
    expect(actionLabel("update")).toBe("Updated");
    expect(actionLabel("delete")).toBe("Deleted");
  });

  it("passes through an unknown action", () => {
    expect(actionLabel("login")).toBe("login");
  });
});

describe("fieldLabel", () => {
  it("uses the curated label when there is one", () => {
    expect(fieldLabel("job_number")).toBe("Work order");
    expect(fieldLabel("quantity_on_hand")).toBe("On hand");
  });

  it("falls back to sentence-cased column names", () => {
    expect(fieldLabel("vendor_reference")).toBe("Vendor reference");
    expect(fieldLabel("")).toBe("");
  });
});

describe("describeEntry", () => {
  it("prefers the resolved record label", () => {
    expect(
      describeEntry({ action: "update", table: "jobs", recordLabel: "WO-00014", recordId: "abc" }),
    ).toBe("Updated Job WO-00014");
  });

  it("falls back to a short record id", () => {
    expect(
      describeEntry({
        action: "delete",
        table: "invoices",
        recordLabel: "",
        recordId: "12345678-90ab-cdef-1234-567890abcdef",
      }),
    ).toBe("Deleted Invoice 12345678…");
  });

  it("omits the reference when there is none", () => {
    expect(describeEntry({ action: "update", table: "stock" })).toBe("Updated Stock row");
  });

  it("returns an empty string for a missing entry", () => {
    expect(describeEntry(null)).toBe("");
  });
});

describe("shortId", () => {
  it("keeps eight characters", () => {
    expect(shortId("1234567890")).toBe("12345678…");
    expect(shortId("")).toBe("");
  });
});

describe("formatAuditValue", () => {
  it("renders missing and empty values distinctly", () => {
    expect(formatAuditValue(null)).toBe("—");
    expect(formatAuditValue(undefined)).toBe("—");
    expect(formatAuditValue("")).toBe("(empty)");
  });

  it("renders booleans as words", () => {
    expect(formatAuditValue(true)).toBe("Yes");
    expect(formatAuditValue(false)).toBe("No");
  });

  it("stringifies everything else", () => {
    expect(formatAuditValue(12.5)).toBe("12.5");
    expect(formatAuditValue("makati")).toBe("makati");
  });
});

describe("buildAuditRequest", () => {
  it("drops empty filters and clamps the page size", () => {
    const request = buildAuditRequest(
      { table: "jobs", action: "", actorId: "   ", search: "WO" },
      { offset: 30, limit: 500 },
    );
    expect(request).toEqual({ table: "jobs", search: "WO", offset: 30, limit: 100 });
  });

  it("sends the action filter as auditAction, never as action", () => {
    const request = buildAuditRequest({ action: "update" }, { offset: 0, limit: 30 });
    expect(request).toEqual({ auditAction: "update", offset: 0, limit: 30 });
    expect(request.action).toBeUndefined();
  });

  it("defaults to the first page", () => {
    expect(buildAuditRequest({}, {})).toEqual({ offset: 0, limit: 30 });
  });

  it("never sends a negative offset", () => {
    expect(buildAuditRequest({}, { offset: -10, limit: 0 }).offset).toBe(0);
  });
});
