// Aggregates the inventory snapshot and a period's stock movements for the
// printable inventory report. Kept pure so the printed figures are testable.

const REASON_ORDER = ["restock", "job_usage", "adjustment", "transfer"];
const REASON_LABELS = {
  restock: "Restock",
  job_usage: "Job usage",
  adjustment: "Adjustment",
  transfer: "Transfer",
};

const round = (value) => Math.round((Number(value) || 0) * 100) / 100;
const capitalise = (value) =>
  String(value ?? "").replace(/^./, (letter) => letter.toUpperCase());

export function movementReasonLabel(reason) {
  return REASON_LABELS[reason] ?? String(reason ?? "");
}

// Local-day bounds as ISO timestamps, so the server filters on the day the
// browser means rather than a UTC day.
export function movementRange(period) {
  const from = new Date(
    period.start.getFullYear(),
    period.start.getMonth(),
    period.start.getDate(),
  );
  const to = new Date(
    period.end.getFullYear(),
    period.end.getMonth(),
    period.end.getDate() + 1,
  );
  return { from: from.toISOString(), to: to.toISOString() };
}

export function buildInventoryReport(
  { movements = [], stockItems = [], truncated = false } = {},
  period,
) {
  const rows = [...movements].sort((left, right) =>
    left.date < right.date ? -1 : left.date > right.date ? 1 : 0,
  );

  const stock = (stockItems ?? []).map((item) => {
    const part = item.parts ?? {};
    const quantity = Number(item.quantity_on_hand) || 0;
    const unitCost = Number(part.unit_cost) || 0;
    return {
      name: part.name ?? "Part",
      sku: part.sku ?? "",
      category: part.category ?? "Uncategorized",
      branch: capitalise(item.branch),
      quantity,
      reorderThreshold: Number(part.reorder_threshold) || 0,
      value: round(quantity * unitCost),
    };
  });

  const sumDirection = (direction) =>
    rows
      .filter((row) => row.direction === direction)
      .reduce((total, row) => total + (Number(row.quantity) || 0), 0);

  const inQty = sumDirection("in");
  const outQty = sumDirection("out");

  const totals = {
    items: stock.length,
    unitsOnHand: stock.reduce((total, item) => total + item.quantity, 0),
    valueOnHand: round(stock.reduce((total, item) => total + item.value, 0)),
    lowStock: stock.filter((item) => item.quantity <= item.reorderThreshold).length,
    movements: rows.length,
    inQty,
    outQty,
    netQty: inQty - outQty,
  };

  const reasons = new Map(
    REASON_ORDER.map((reason) => [
      reason,
      {
        reason,
        label: REASON_LABELS[reason],
        count: 0,
        inQty: 0,
        outQty: 0,
      },
    ]),
  );
  rows.forEach((row) => {
    const entry =
      reasons.get(row.reason) ?? {
        reason: row.reason,
        label: REASON_LABELS[row.reason] ?? row.reason,
        count: 0,
        inQty: 0,
        outQty: 0,
      };
    entry.count += 1;
    if (row.direction === "in") entry.inQty += Number(row.quantity) || 0;
    else entry.outQty += Number(row.quantity) || 0;
    reasons.set(row.reason, entry);
  });
  const byReason = [...reasons.values()].filter(
    (entry) => entry.count > 0 || REASON_ORDER.includes(entry.reason),
  );

  // Category rows combine the value currently on hand with the period's
  // movement volumes, so one table explains both halves of the report.
  const categories = new Map();
  const categoryEntry = (category) => {
    const key = category || "Uncategorized";
    if (!categories.has(key)) {
      categories.set(key, { category: key, inQty: 0, outQty: 0, value: 0 });
    }
    return categories.get(key);
  };
  stock.forEach((item) => {
    const entry = categoryEntry(item.category);
    entry.value = round(entry.value + item.value);
  });
  rows.forEach((row) => {
    const entry = categoryEntry(row.category);
    if (row.direction === "in") entry.inQty += Number(row.quantity) || 0;
    else entry.outQty += Number(row.quantity) || 0;
  });
  const byCategory = [...categories.values()].sort((left, right) =>
    left.category.localeCompare(right.category),
  );

  const branches = new Map();
  const branchEntry = (branch) => {
    const key = branch || "—";
    if (!branches.has(key)) {
      branches.set(key, {
        branch: key,
        unitsOnHand: 0,
        value: 0,
        movements: 0,
        inQty: 0,
        outQty: 0,
      });
    }
    return branches.get(key);
  };
  stock.forEach((item) => {
    const entry = branchEntry(item.branch);
    entry.unitsOnHand += item.quantity;
    entry.value = round(entry.value + item.value);
  });
  rows.forEach((row) => {
    const entry = branchEntry(row.branch);
    entry.movements += 1;
    if (row.direction === "in") entry.inQty += Number(row.quantity) || 0;
    else entry.outQty += Number(row.quantity) || 0;
  });
  const byBranch = [...branches.values()].sort((left, right) =>
    left.branch.localeCompare(right.branch),
  );

  const lowStockRows = stock
    .filter((item) => item.quantity <= item.reorderThreshold)
    .sort(
      (left, right) =>
        left.branch.localeCompare(right.branch) ||
        left.name.localeCompare(right.name),
    );

  return {
    period,
    rows,
    totals,
    byReason,
    byCategory,
    byBranch,
    lowStockRows,
    truncated,
  };
}
