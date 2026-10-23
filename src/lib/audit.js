// Display vocabulary for the audit log. The server sends raw table/column
// names and a resolved record label; everything a person reads comes from here
// so the labels stay consistent between the timeline and the detail drawer.

export const AUDITED_TABLES = [
  { value: "jobs", plural: "Jobs", singular: "Job" },
  { value: "job_technicians", plural: "Job technicians", singular: "Job technician" },
  { value: "job_parts", plural: "Job parts", singular: "Job part" },
  { value: "job_templates", plural: "Templates", singular: "Template" },
  { value: "job_template_items", plural: "Template lines", singular: "Template line" },
  { value: "quotations", plural: "Quotations", singular: "Quotation" },
  { value: "quotation_line_items", plural: "Quotation lines", singular: "Quotation line" },
  { value: "clients", plural: "Clients", singular: "Client" },
  { value: "field_reports", plural: "Field reports", singular: "Field report" },
  { value: "report_parts_used", plural: "Report parts", singular: "Report part" },
  { value: "report_attachments", plural: "Report attachments", singular: "Attachment" },
  { value: "invoices", plural: "Invoices", singular: "Invoice" },
  { value: "invoice_line_items", plural: "Invoice lines", singular: "Invoice line" },
  { value: "payments", plural: "Payments", singular: "Payment" },
  { value: "parts", plural: "Parts", singular: "Part" },
  { value: "stock", plural: "Stock", singular: "Stock row" },
  { value: "stock_movements", plural: "Stock movements", singular: "Stock movement" },
  { value: "requisitions", plural: "Requisitions", singular: "Requisition" },
  { value: "technicians", plural: "Technicians", singular: "Technician" },
  { value: "users", plural: "Users", singular: "User" },
  { value: "roles", plural: "Roles", singular: "Role" },
  { value: "module_permissions", plural: "Module permissions", singular: "Module permission" },
];

export const ACTION_LABELS = {
  insert: "Created",
  update: "Updated",
  delete: "Deleted",
};

// Only the columns a person is likely to read are named; the fallback turns
// snake_case into "Sentence case" so a new column is still legible.
const FIELD_LABELS = {
  job_number: "Work order",
  job_type: "Service type",
  scheduled_date: "Scheduled date",
  scheduled_time: "Scheduled time",
  scheduled_end_date: "Scheduled end date",
  scheduled_end_time: "Scheduled end time",
  site_address: "Site address",
  assignment_confirmed_at: "Confirmed at",
  parts_status: "Parts status",
  parts_confirmed_by: "Parts confirmed by",
  is_active: "Active",
  first_name: "First name",
  last_name: "Last name",
  role_id: "Role",
  branch: "Branch",
  client_id: "Client",
  quotation_id: "Quotation",
  job_id: "Job",
  technician_id: "Technician",
  report_id: "Field report",
  invoice_id: "Invoice",
  payment_id: "Payment",
  part_id: "Part",
  stock_id: "Stock row",
  template_id: "Template",
  template_item_id: "Template line",
  line_item_id: "Line",
  movement_id: "Stock movement",
  quantity_on_hand: "On hand",
  quantity_reserved: "Reserved",
  quantity: "Quantity",
  unit_cost: "Unit cost",
  unit_price: "Unit price",
  line_total: "Line total",
  total_amount: "Total",
  review_status: "Review status",
  work_performed: "Work performed",
  service_date: "Service date",
  amount: "Amount",
  payment_date: "Payment date",
  method: "Method",
  status: "Status",
  name: "Name",
  email: "Email",
  phone: "Phone",
  title: "Title",
  sku: "SKU",
  category: "Category",
  markup_percent: "Markup %",
  service_type: "Service type",
  content: "Content",
  file_url: "File",
  file_type: "File type",
  notes: "Notes",
};

export function tableLabel(table, { plural = true } = {}) {
  const entry = AUDITED_TABLES.find((candidate) => candidate.value === table);
  if (entry) return plural ? entry.plural : entry.singular;
  return String(table ?? "")
    .split("_")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function actionLabel(action) {
  return ACTION_LABELS[action] ?? String(action ?? "");
}

export function fieldLabel(field) {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  const words = String(field ?? "").replace(/_/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "";
}

export function shortId(value) {
  const text = String(value ?? "");
  return text ? `${text.slice(0, 8)}…` : "";
}

export function describeEntry(entry) {
  if (!entry) return "";
  const verb = actionLabel(entry.action);
  const noun = tableLabel(entry.table, { plural: false });
  const reference = entry.recordLabel || shortId(entry.recordId);
  return [verb, noun, reference].filter(Boolean).join(" ");
}

export function formatAuditValue(value) {
  if (value === null || value === undefined) return "—";
  if (value === "") return "(empty)";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function formatAuditTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildAuditRequest(filters = {}, { offset = 0, limit = 30 } = {}) {
  const payload = {
    limit: Math.min(Math.max(Number(limit) || 30, 1), 100),
    offset: Math.max(Number(offset) || 0, 0),
  };
  // The audit action travels as `auditAction`: a key named `action` would
  // overwrite the RPC name in callAuthFunction's request body.
  const { action, ...rest } = filters;
  if (action && String(action).trim()) payload.auditAction = String(action).trim();
  const optional = ["table", "actorId", "recordId", "from", "to", "search"];
  for (const key of optional) {
    const value = String(rest[key] ?? "").trim();
    if (value) payload[key] = value;
  }
  return payload;
}
