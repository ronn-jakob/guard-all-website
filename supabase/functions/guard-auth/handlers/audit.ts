import { response } from "../shared.ts";

export async function handleListAuditLog({ body, db }: { body: any; db: any }) {
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