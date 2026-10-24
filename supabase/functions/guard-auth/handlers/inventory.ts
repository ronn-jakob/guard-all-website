import { branchScope, passwordConfirmationError, scopedBranch } from "../auth.ts";
import { response } from "../shared.ts";

export function nextSkuFor(existingSkus: unknown[], prefix: string) {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`, "i");
  let highest = 0;
  for (const value of existingSkus) {
    const match = pattern.exec(String(value ?? ""));
    if (!match) continue;
    highest = Math.max(highest, Number(match[1]));
  }
  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
}

export async function handleListInventory({ body, session, db }: { body: any; session: any; db: any }) {
  // Archived parts are hidden from the working catalogue but can be listed.
  const archivedOnly = String(body.status ?? "active").toLowerCase() === "archived";
  let inventoryQuery = db
    .from("stock")
    .select("stock_id, part_id, branch, quantity_on_hand, quantity_reserved, parts!inner(part_id, sku, name, category, category_id, unit_of_measure, reorder_threshold, unit_cost, address, notes, is_active)")
    .eq("parts.is_active", !archivedOnly);
  const inventoryBranch = branchScope(session);
  if (inventoryBranch !== null) inventoryQuery = inventoryQuery.eq("branch", inventoryBranch);
  const { data, error } = await inventoryQuery
    .order("branch")
    .order("stock_id");
  if (error) throw error;
  return response({ items: data ?? [] });
}

export async function handleListPartCategories({ db }: { db: any }) {
  const { data: categories, error } = await db
    .from("part_categories")
    .select("category_id, name, code_prefix, is_active")
    .order("name");
  if (error) throw error;

  const { data: partRows, error: partsError } = await db
    .from("parts")
    .select("sku, category_id");
  if (partsError) throw partsError;

  const skus = (partRows ?? []).map((row: any) => row.sku);
  const counts = new Map<string, number>();
  for (const row of partRows ?? []) {
    if (!row.category_id) continue;
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }

  return response({
    categories: (categories ?? []).map((category: any) => ({
      id: category.category_id,
      name: category.name,
      prefix: category.code_prefix,
      active: category.is_active,
      partCount: counts.get(category.category_id) ?? 0,
      nextSku: nextSkuFor(skus, category.code_prefix),
    })),
  });
}

export async function handleSavePartCategory({ body, session, db }: { body: any; session: any; db: any }) {
  const categoryId = String(body.categoryId ?? "").trim();
  const name = String(body.name ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  const prefix = String(body.prefix ?? "").trim().toUpperCase();
  const isActive = body.isActive === undefined ? true : Boolean(body.isActive);
  if (!name) return response({ error: "A category name is required." }, 400);
  if (!/^[A-Z0-9]{2,6}$/.test(prefix)) {
    return response({ error: "The code prefix must be 2–6 letters or digits." }, 400);
  }

  // Case-insensitive uniqueness is what the indexes enforce; checking first
  // lets the UI name the field that collided instead of showing a raw 23505.
  const { data: existingRows, error: existingError } = await db
    .from("part_categories")
    .select("category_id, name, code_prefix");
  if (existingError) throw existingError;
  const others = (existingRows ?? []).filter((row: any) => row.category_id !== categoryId);
  if (others.some((row: any) => String(row.name).toLowerCase() === name.toLowerCase())) {
    return response({ error: "A category with that name already exists." }, 409);
  }
  if (others.some((row: any) => String(row.code_prefix).toUpperCase() === prefix)) {
    return response({ error: "Another category already uses that code prefix." }, 409);
  }

  if (categoryId) {
    const { data: current, error: currentError } = await db
      .from("part_categories")
      .select("category_id, name")
      .eq("category_id", categoryId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return response({ error: "That category no longer exists." }, 404);

    const { error: updateError } = await db
      .from("part_categories")
      .update({ name, code_prefix: prefix, is_active: isActive })
      .eq("category_id", categoryId);
    if (updateError) throw updateError;

    // parts.category is the display text every read path uses, so a rename
    // has to follow. Existing SKUs are deliberately left alone.
    if (current.name !== name) {
      const { error: syncError } = await db
        .from("parts")
        .update({ category: name })
        .eq("category_id", categoryId);
      if (syncError) throw syncError;
    }
    return response({ category: { id: categoryId, name, prefix, active: isActive } });
  }

  const { data: created, error: createError } = await db
    .from("part_categories")
    .insert({ name, code_prefix: prefix, is_active: isActive, created_by: session.sub })
    .select("category_id, name, code_prefix, is_active")
    .single();
  if (createError) {
    if (createError.code === "23505") {
      return response({ error: "A category with that name or prefix already exists." }, 409);
    }
    throw createError;
  }
  return response({
    category: {
      id: created.category_id,
      name: created.name,
      prefix: created.code_prefix,
      active: created.is_active,
    },
  }, 201);
}

export async function handleAdjustInventoryStock({ body, session, db }: { body: any; session: any; db: any }) {
  const stockId = String(body.stockId ?? "");
  const direction = String(body.direction ?? "");
  const quantity = Number(body.quantity);
  if (!stockId || !["in", "out"].includes(direction) || !Number.isInteger(quantity) || quantity <= 0) {
    return response({ error: "Enter a valid stock quantity and direction." }, 400);
  }

  const { data: stock, error: stockLookupError } = await db
    .from("stock")
    .select("part_id, branch, quantity_on_hand, quantity_reserved")
    .eq("stock_id", stockId)
    .maybeSingle();
  if (stockLookupError) throw stockLookupError;
  if (!stock) return response({ error: "This inventory item no longer exists." }, 404);
  if (branchScope(session) !== null && String(stock.branch) !== String(session.branch)) {
    return response({ error: "This stock row belongs to another branch." }, 403);
  }
  if (direction === "out") {
    if (quantity > stock.quantity_on_hand) {
      return response({ error: "The quantity removed cannot exceed current stock." }, 400);
    }
    const reserved = Number(stock.quantity_reserved) || 0;
    const available = stock.quantity_on_hand - reserved;
    if (quantity > available) {
      return response({ error: `Only ${available} of ${stock.quantity_on_hand} units are available; ${reserved} are reserved for jobs.` }, 400);
    }
  }

  const { error: movementError } = await db.from("stock_movements").insert({
    part_id: stock.part_id,
    branch: stock.branch,
    direction,
    quantity,
    reason: "adjustment",
    performed_by: session.sub,
  });
  if (movementError) throw movementError;
  return response({ message: "Stock quantity updated." });
}

export async function handleDeleteInventoryPart({ body, session, db }: { body: any; session: any; db: any }) {
  const partId = String(body.partId ?? "").trim();
  if (!partId) return response({ error: "Choose a part to remove." }, 400);
  const passwordError = await passwordConfirmationError(session, String(body.password ?? ""));
  if (passwordError) return response({ error: passwordError }, 401);

  const { data: part, error } = await db
    .from("parts")
    .select("part_id, name, sku")
    .eq("part_id", partId)
    .maybeSingle();
  if (error) throw error;
  if (!part) return response({ error: "Part not found." }, 404);

  const { data: stockRows, error: stockError } = await db
    .from("stock")
    .select("stock_id, quantity_on_hand, quantity_reserved")
    .eq("part_id", partId);
  if (stockError) throw stockError;
  const stillStocked = (stockRows ?? []).find(
    (row: any) => Number(row.quantity_on_hand) > 0 || Number(row.quantity_reserved) > 0,
  );
  if (stillStocked) {
    return response({ error: "This part still has stock on hand and cannot be deleted." }, 409);
  }

  const [
    { count: reservations },
    { count: movements },
    { count: usage },
    { count: requisitions },
    { count: templateLines },
    { count: quoteLines },
  ] = await Promise.all([
    db.from("job_parts").select("part_id", { count: "exact", head: true }).eq("part_id", partId),
    db.from("stock_movements").select("part_id", { count: "exact", head: true }).eq("part_id", partId),
    db.from("report_parts_used").select("part_id", { count: "exact", head: true }).eq("part_id", partId),
    db.from("requisitions").select("part_id", { count: "exact", head: true }).eq("part_id", partId),
    db.from("job_template_items").select("part_id", { count: "exact", head: true }).eq("part_id", partId),
    db.from("quotation_line_items").select("part_id", { count: "exact", head: true }).eq("part_id", partId),
  ]);
  const blockers = [
    reservations ? String(reservations) + " stock reservation" + (reservations === 1 ? "" : "s") : "",
    movements ? String(movements) + " stock movement" + (movements === 1 ? "" : "s") : "",
    usage ? String(usage) + " report usage" + (usage === 1 ? "" : "s") : "",
    requisitions ? String(requisitions) + " requisition" + (requisitions === 1 ? "" : "s") : "",
    templateLines ? String(templateLines) + " template line" + (templateLines === 1 ? "" : "s") : "",
    quoteLines ? String(quoteLines) + " quotation line" + (quoteLines === 1 ? "" : "s") : "",
  ].filter(Boolean);
  if (blockers.length) {
    // Movements are append-only, so history can never be deleted. Archive the
    // part instead: it leaves the catalogue and keeps its records.
    const { error: archiveError } = await db
      .from("parts")
      .update({ is_active: false })
      .eq("part_id", partId);
    if (archiveError) throw archiveError;
    return response({
      action: "archived",
      message: part.name + " (" + part.sku + ") was archived. It is hidden from the catalogue but kept in the stock records.",
      references: blockers,
    });
  }

  const { error: stockDeleteError } = await db.from("stock").delete().eq("part_id", partId);
  if (stockDeleteError) throw stockDeleteError;
  const { error: partDeleteError } = await db.from("parts").delete().eq("part_id", partId);
  if (partDeleteError) throw partDeleteError;
  return response({ message: part.name + " (" + part.sku + ") was deleted." });
}

export async function handleRestoreInventoryPart({ body, session, db }: { body: any; session: any; db: any }) {
  const partId = String(body.partId ?? "").trim();
  if (!partId) return response({ error: "Choose a part to restore." }, 400);
  const { data: part, error } = await db
    .from("parts")
    .select("part_id, name, sku, is_active")
    .eq("part_id", partId)
    .maybeSingle();
  if (error) throw error;
  if (!part) return response({ error: "Part not found." }, 404);
  if (part.is_active) return response({ message: "That part is already active." });

  const { error: updateError } = await db
    .from("parts")
    .update({ is_active: true })
    .eq("part_id", partId);
  if (updateError) throw updateError;
  return response({ message: part.name + " (" + part.sku + ") was restored." });
}

export async function handleCreateOrUpdateInventoryItem({ body, session, db, action }: { body: any; session: any; db: any; action: string }) {
  const item = body.item && typeof body.item === "object" ? body.item : {};
  const name = String(item.name ?? "").trim();
  const requestedSku = String(item.sku ?? "").trim();
  const categoryId = String(item.categoryId ?? "").trim();
  const unitOfMeasure = String(item.unitOfMeasure ?? "").trim();
  const branch = scopedBranch(session, item.branch);
  const address = String(item.address ?? "").trim();
  const notes = String(item.notes ?? "").trim();
  const quantity = Number(item.quantity);
  const reorderThreshold = Number(item.reorderThreshold);
  const unitCost = Number(item.unitCost);

  // A managed category decides the label and the code prefix; the text value
  // on the request is only a fallback for callers that predate the table.
  let categoryName = String(item.category ?? "").trim();
  let categoryRecord: any = null;
  if (categoryId) {
    const { data: categoryRow, error: categoryError } = await db
      .from("part_categories")
      .select("category_id, name, code_prefix, is_active")
      .eq("category_id", categoryId)
      .maybeSingle();
    if (categoryError) throw categoryError;
    if (!categoryRow) return response({ error: "That category no longer exists." }, 400);
    if (action === "create-inventory-item" && !categoryRow.is_active) {
      return response({ error: "That category is inactive. Choose another one." }, 400);
    }
    categoryRecord = categoryRow;
    categoryName = categoryRow.name;
  }

  // An empty code on a create means "generate it from the category".
  const isGeneratedSku = action === "create-inventory-item" && !requestedSku && Boolean(categoryRecord);
  let sku = requestedSku;
  if (isGeneratedSku) {
    const { data: skuRows, error: skuError } = await db.from("parts").select("sku");
    if (skuError) throw skuError;
    sku = nextSkuFor((skuRows ?? []).map((row: any) => row.sku), categoryRecord.code_prefix);
  }

  if (!name || !sku || !categoryName || !unitOfMeasure || !address || !["makati", "cebu"].includes(branch) || !Number.isInteger(quantity) || quantity < 0 || !Number.isInteger(reorderThreshold) || reorderThreshold < 0 || !Number.isFinite(unitCost) || unitCost < 0) {
    return response({ error: "Please provide valid item details, branch, stock level, and unit price." }, 400);
  }

  const partValues = {
    sku,
    name,
    category: categoryName,
    unit_of_measure: unitOfMeasure,
    reorder_threshold: reorderThreshold,
    unit_cost: unitCost,
    address,
    notes: notes || null,
  };
  // On an update without a categoryId, leave the existing link untouched
  // instead of nulling it.
  if (categoryId) partValues.category_id = categoryId;

  if (action === "create-inventory-item") {
    let part: any = null;
    let partError: any = null;
    // A generated code can lose a race with a simultaneous create. Recompute
    // from the live table and retry instead of failing the whole request.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const inserted = await db
        .from("parts")
        .insert(partValues)
        .select("part_id")
        .single();
      part = inserted.data;
      partError = inserted.error;
      if (!partError) break;
      if (partError.code !== "23505" || !isGeneratedSku) break;
      const { data: skuRows, error: skuError } = await db.from("parts").select("sku");
      if (skuError) throw skuError;
      const regenerated = nextSkuFor(
        (skuRows ?? []).map((row: any) => row.sku),
        categoryRecord.code_prefix,
      );
      if (regenerated === partValues.sku) break;
      partValues.sku = regenerated;
    }
    if (partError) {
      if (partError.code !== "23505") throw partError;

      // Reuse an archived part with the same SKU rather than blocking the code
      // forever. Opening stock still has to be booked as a movement.
      const { data: archivedPart, error: archivedError } = await db
        .from("parts")
        .select("part_id, is_active")
        .eq("sku", partValues.sku)
        .maybeSingle();
      if (archivedError) throw archivedError;
      if (!archivedPart || archivedPart.is_active) {
        return response({ error: "An item with this code already exists." }, 409);
      }

      const { error: reactivateError } = await db
        .from("parts")
        .update({ ...partValues, is_active: true })
        .eq("part_id", archivedPart.part_id);
      if (reactivateError) throw reactivateError;

      const { data: stockRow, error: stockLookupError } = await db
        .from("stock")
        .select("stock_id")
        .eq("part_id", archivedPart.part_id)
        .eq("branch", branch)
        .maybeSingle();
      if (stockLookupError) throw stockLookupError;
      if (!stockRow) {
        const { error: stockInsertError } = await db
          .from("stock")
          .insert({ part_id: archivedPart.part_id, branch, quantity_on_hand: 0 });
        if (stockInsertError) throw stockInsertError;
      }
      if (quantity > 0) {
        const { error: movementError } = await db.from("stock_movements").insert({
          part_id: archivedPart.part_id,
          branch,
          direction: "in",
          quantity,
          reason: "restock",
          performed_by: session.sub,
        });
        if (movementError) throw movementError;
      }
      return response({ message: "Inventory item restored from the archive.", restored: true }, 200);
    }

    const { error: stockError } = await db
      .from("stock")
      .insert({ part_id: part.part_id, branch, quantity_on_hand: 0 });
    if (stockError) {
      await db.from("parts").delete().eq("part_id", part.part_id);
      throw stockError;
    }

    if (quantity > 0) {
      const { error: movementError } = await db.from("stock_movements").insert({
        part_id: part.part_id,
        branch,
        direction: "in",
        quantity,
        reason: "restock",
        performed_by: session.sub,
      });
      if (movementError) {
        await db.from("stock").delete().eq("part_id", part.part_id);
        await db.from("parts").delete().eq("part_id", part.part_id);
        throw movementError;
      }
    }
    return response({ message: "Inventory item created." }, 201);
  }

  const stockId = String(body.stockId ?? "");
  const partId = String(body.partId ?? "");
  const { data: stock, error: stockLookupError } = await db
    .from("stock")
    .select("stock_id, part_id, branch")
    .eq("stock_id", stockId)
    .eq("part_id", partId)
    .maybeSingle();
  if (stockLookupError) throw stockLookupError;
  if (!stock) return response({ error: "This inventory item no longer exists." }, 404);
  if (branchScope(session) !== null && String(stock.branch) !== String(session.branch)) {
    return response({ error: "This stock row belongs to another branch." }, 403);
  }

  if (stock.branch !== branch) {
    const { data: existingStock, error: duplicateBranchError } = await db
      .from("stock")
      .select("stock_id")
      .eq("part_id", partId)
      .eq("branch", branch)
      .maybeSingle();
    if (duplicateBranchError) throw duplicateBranchError;
    if (existingStock) return response({ error: "This item already has a stock record for that branch." }, 409);
  }

  const { error: partUpdateError } = await db.from("parts").update(partValues).eq("part_id", partId);
  if (partUpdateError) {
    if (partUpdateError.code === "23505") return response({ error: "An item with this code already exists." }, 409);
    throw partUpdateError;
  }
  if (stock.branch !== branch) {
    const { error: branchUpdateError } = await db.from("stock").update({ branch }).eq("stock_id", stockId);
    if (branchUpdateError) throw branchUpdateError;
  }
  return response({ message: "Inventory item updated." });
}

export async function handleListParts({ db }: { db: any }) {
  const { data, error } = await db
    .from("parts")
    .select("part_id, sku, name, category, unit_of_measure, unit_cost, reorder_threshold")
    .eq("is_active", true)
    .order("sku");
  if (error) throw error;
  return response({
    parts: (data ?? []).map((part: any) => ({
      id: part.part_id,
      sku: part.sku,
      name: part.name,
      category: part.category ?? "",
      unitOfMeasure: part.unit_of_measure,
      unitCost: Number(part.unit_cost),
      reorderThreshold: part.reorder_threshold,
    })),
  });
}
