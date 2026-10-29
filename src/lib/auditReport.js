// Aggregates audit events for the printable audit report. The Edge Function
// pages at 100 rows, so the caller reads several pages and hands the combined
// list here.

export const AUDIT_PRINT_CAP = 5000;

const ACTION_ORDER = ["insert", "update", "delete"];

export function buildAuditReport(
  entries,
  { total = 0, truncated = false } = {},
  period,
) {
  const rows = [...(entries ?? [])].sort((left, right) =>
    String(right.changedAt ?? "").localeCompare(String(left.changedAt ?? "")),
  );

  const byActionMap = new Map(ACTION_ORDER.map((action) => [action, 0]));
  const byTableMap = new Map();
  const byActorMap = new Map();

  rows.forEach((entry) => {
    const action = ACTION_ORDER.includes(entry.action) ? entry.action : "update";
    byActionMap.set(action, (byActionMap.get(action) ?? 0) + 1);

    const table =
      byTableMap.get(entry.table) ?? {
        table: entry.table,
        insert: 0,
        update: 0,
        delete: 0,
        total: 0,
      };
    table[action] += 1;
    table.total += 1;
    byTableMap.set(entry.table, table);

    const name = entry.actor?.name || "Unattributed";
    const role = entry.actor?.role || "";
    const actorKey = `${name}|${role}`;
    const actor = byActorMap.get(actorKey) ?? { name, role, count: 0 };
    actor.count += 1;
    byActorMap.set(actorKey, actor);
  });

  const byAction = ACTION_ORDER.map((action) => ({
    action,
    count: byActionMap.get(action) ?? 0,
  }));

  const byTable = [...byTableMap.values()].sort(
    (left, right) =>
      right.total - left.total || String(left.table).localeCompare(String(right.table)),
  );

  const byActor = [...byActorMap.values()].sort(
    (left, right) =>
      right.count - left.count || left.name.localeCompare(right.name),
  );

  return {
    period,
    rows,
    byAction,
    byTable,
    byActor,
    truncated: Boolean(truncated),
    total: total || rows.length,
    totals: {
      events: rows.length,
      inserts: byActionMap.get("insert") ?? 0,
      updates: byActionMap.get("update") ?? 0,
      deletes: byActionMap.get("delete") ?? 0,
      tables: byTable.length,
      actors: byActor.length,
    },
  };
}
