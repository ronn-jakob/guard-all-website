// Single source of truth for roles and module access inside guard-auth.
// NOTE: guard-account still carries its own copy; unifying the two functions is
// a separate task (tracked in the architecture audit).

export const rolePermissions: Record<string, Array<[string, string]>> = {
  Admin: [["scheduling", "approve"], ["inventory", "approve"], ["field_reporting", "approve"], ["sales_billing", "approve"], ["admin", "approve"]],
  "Service Manager": [["scheduling", "edit"], ["field_reporting", "edit"]],
  "Sales Manager": [["scheduling", "edit"], ["field_reporting", "edit"]],
  Technician: [["field_reporting", "edit"]],
  "Warehouse Manager": [["inventory", "edit"]],
  "Billing Staff": [["sales_billing", "edit"]],
};

// The job title shown on a profile is the role, mapped to a readable label. It is
// never typed by the user.
export const roleTitles: Record<string, string> = {
  Admin: "Administrator",
  "Service Manager": "Service Manager",
  "Sales Manager": "Service Manager",
  Technician: "Field Technician",
  "Warehouse Manager": "Warehouse Manager",
  "Billing Staff": "Billing Staff",
};
export const roleTitleFor = (role: string) => roleTitles[role] ?? role;

export function isSchedulingRole(role: string) {
  return rolePermissions[role]?.some(([module]) => module === "scheduling") ?? false;
}

export function isSalesBillingRole(role: string) {
  return rolePermissions[role]?.some(([module]) => module === "sales_billing") ?? false;
}

export function isFieldReportRole(role: string) {
  return rolePermissions[role]?.some(([module]) => module === "field_reporting") ?? false;
}
