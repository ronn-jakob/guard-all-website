// Builds the warehouse's starting selection from the quotation's part lines.
// Quantities are clamped to what the branch actually holds, and anything the
// branch cannot cover is surfaced rather than silently dropped.
export function buildAllocationPrefill(result) {
  const stockByPart = new Map();
  (result.items ?? []).forEach((row) => stockByPart.set(row.part_id, row));

  const selected = {};
  const quantities = {};
  const quotedByStock = {};
  const unavailable = [];
  const quotedLines = (result.quotedParts ?? []).filter((line) => line?.partId);

  quotedLines.forEach((line) => {
    const quoted = Number(line.quantity) || 0;
    const stock = stockByPart.get(line.partId);
    if (!stock) {
      unavailable.push({
        ...line,
        quoted,
        available: 0,
        reason: "No stock record at this branch",
      });
      return;
    }
    const available = Math.max(
      0,
      (Number(stock.quantity_on_hand) || 0) -
        (Number(stock.quantity_reserved) || 0),
    );
    if (available <= 0) {
      unavailable.push({
        ...line,
        quoted,
        available,
        reason: "Nothing available at this branch",
      });
      return;
    }

    quotedByStock[stock.stock_id] = quoted;
    selected[stock.stock_id] = true;
    quantities[stock.stock_id] = String(Math.min(quoted, available));
    if (quoted > available) {
      unavailable.push({
        ...line,
        quoted,
        available,
        reason: "Branch stock is short",
      });
    }
  });

  return {
    selected,
    quantities,
    quotedByStock,
    unavailable,
    quotedCount: quotedLines.length,
  };
}
