// Read-only aggregation for the printable accounts directory. The list-users
// action only returns active accounts, so the report is the active directory.

const capitalise = (value) =>
  String(value ?? "").replace(/^./, (letter) => letter.toUpperCase());

export function buildAccountsReport(accounts) {
  const rows = [...(accounts ?? [])].sort((left, right) =>
    String(left.name ?? "").localeCompare(String(right.name ?? "")),
  );

  const roles = new Map();
  const branches = new Map();
  rows.forEach((account) => {
    const role = account.role || "No role";
    roles.set(role, (roles.get(role) ?? 0) + 1);
    const branch = account.branch ? capitalise(account.branch) : "—";
    branches.set(branch, (branches.get(branch) ?? 0) + 1);
  });

  const byRole = [...roles.entries()]
    .map(([role, count]) => ({ role, count }))
    .sort((left, right) => right.count - left.count || left.role.localeCompare(right.role));

  const byBranch = [...branches.entries()]
    .map(([branch, count]) => ({ branch, count }))
    .sort((left, right) => left.branch.localeCompare(right.branch));

  return {
    rows,
    byRole,
    byBranch,
    totals: {
      accounts: rows.length,
      roles: byRole.length,
      branches: byBranch.length,
      active: rows.filter((account) => account.status === "Active").length,
    },
  };
}
