import { response, supabaseAdmin } from "../shared.ts";
import { branchScope, passwordConfirmationError } from "../auth.ts";
import { isSalesBillingRole } from "../roles.ts";

// Templates are the standard priced packages that Billing Staff maintain. The
// client-facing total is the sum of the priced lines; part lines carry unit_price 0
// and exist only to tell the warehouse what to allocate.
export async function listJobTemplates(session: Record<string, unknown>) {
  // Markup is commercially sensitive: only sales_billing roles receive it, so a
  // Service Manager never sees the percentage behind the price.
  const includeMarkup = isSalesBillingRole(String(session.role ?? ""));
  const templateBranch = branchScope(session);

  let templateQuery = supabaseAdmin
    .from("job_templates")
    .select("template_id, name, job_type, branch, description, is_active, markup_percent, created_at, job_template_items(item_id, line_type, part_id, description, quantity, unit_price, line_total)");
  // Non-admins see their branch plus the shared All-branches templates.
  if (templateBranch !== null) {
    templateQuery = templateQuery.or(`branch.eq.${templateBranch},branch.is.null`);
  }
  const { data, error } = await templateQuery.order("name");
  if (error) throw error;

  return (data ?? []).map((template: any) => {
    const items = (Array.isArray(template.job_template_items) ? template.job_template_items : [])
      .slice()
      .sort((left: any, right: any) => String(left.item_id).localeCompare(String(right.item_id)));
    const factor = 1 + Number(template.markup_percent || 0) / 100;

    // Base prices are only exposed to sales_billing roles; everyone else sees the
    // quoted price alone. Rounding is per line so `total` matches the quotation
    // that gioms_create_job_from_template will generate.
    const mappedItems: any[] = items.map((item: any) => {
      const quantity = Number(item.quantity);
      const baseUnit = Number(item.unit_price);
      const clientUnit = Math.round(baseUnit * factor * 100) / 100;
      return {
        id: item.item_id,
        lineType: item.line_type,
        partId: item.part_id ?? "",
        description: item.description,
        quantity,
        unitPriceClient: clientUnit,
        lineTotalClient: Math.round(quantity * clientUnit * 100) / 100,
        ...(includeMarkup
          ? {
              unitPriceBase: baseUnit,
              lineTotalBase: Math.round(quantity * baseUnit * 100) / 100,
            }
          : {}),
      };
    });

    return {
      id: template.template_id,
      name: template.name,
      jobType: template.job_type,
      branch: template.branch ?? "",
      description: template.description ?? "",
      isActive: template.is_active,
      createdAt: template.created_at,
      items: mappedItems,
      total: mappedItems.reduce((sum: number, item: any) => sum + item.lineTotalClient, 0),
      ...(includeMarkup
        ? {
            markupPercent: Number(template.markup_percent),
            subtotal: mappedItems.reduce(
              (sum: number, item: any) => sum + (item.lineTotalBase ?? 0),
              0,
            ),
          }
        : {}),
    };
  });
}

export async function handleListJobTemplates({ session }: { session: any }) {
  return response({ templates: await listJobTemplates(session) });
}

export async function handleSaveJobTemplate({ body, session, db }: { body: any; session: any; db: any }) {
  const items = Array.isArray(body.items) ? body.items : [];
  // Admins may scope a template to one branch or to All branches; everyone
  // else writes only for their own branch. Editing a shared All-branches
  // template keeps it shared instead of silently claiming it.
  let templateBranch: string | null = null;
  if (String(session.role ?? "") === "Admin") {
    templateBranch = body.branch ? String(body.branch) : null;
  } else {
    const ownBranch = String(session.branch ?? "");
    if (body.templateId) {
      const { data: existingTemplate, error: templateLookupError } = await db
        .from("job_templates")
        .select("branch")
        .eq("template_id", String(body.templateId))
        .maybeSingle();
      if (templateLookupError) throw templateLookupError;
      if (!existingTemplate) return response({ error: "Template not found." }, 404);
      if (existingTemplate.branch && existingTemplate.branch !== ownBranch) {
        return response({ error: "This template belongs to another branch." }, 403);
      }
      templateBranch = existingTemplate.branch ? ownBranch : null;
    } else {
      templateBranch = ownBranch || null;
    }
  }

  const { data: savedTemplateId, error } = await db.rpc("gioms_save_job_template", {
    p_template_id: body.templateId ? String(body.templateId) : null,
    p_name: String(body.name ?? ""),
    p_job_type: body.jobType ? String(body.jobType) : null,
    p_branch: templateBranch,
    p_description: String(body.description ?? ""),
    p_is_active: body.isActive === undefined ? true : Boolean(body.isActive),
    p_markup_percent: Number(body.markupPercent ?? 0),
    p_items: items.map((item: any) => ({
      lineType: String(item?.lineType ?? ""),
      partId: item?.partId ? String(item.partId) : null,
      description: String(item?.description ?? ""),
      quantity: Number(item?.quantity ?? 0),
      unitPrice: Number(item?.unitPrice ?? 0),
    })),
    p_actor: session.sub,
  });
  if (error) return response({ error: error.message }, 400);
  return response({ templateId: savedTemplateId, message: "Template saved." }, body.templateId ? 200 : 201);
}

export async function handleDeleteJobTemplate({ body, session, db }: { body: any; session: any; db: any }) {
  const templateId = String(body.templateId ?? "").trim();
  if (!templateId) return response({ error: "Choose a template to remove." }, 400);
  const passwordError = await passwordConfirmationError(session, String(body.password ?? ""));
  if (passwordError) return response({ error: passwordError }, 401);

  const { data: template, error } = await db
    .from("job_templates")
    .select("template_id, name, branch")
    .eq("template_id", templateId)
    .maybeSingle();
  if (error) throw error;
  if (!template) return response({ error: "Template not found." }, 404);
  if (branchScope(session) !== null && String(template.branch ?? "") !== String(session.branch)) {
    return response({ error: "This template belongs to another branch." }, 403);
  }

  // A template referenced by a quotation cannot be deleted; archive it so the
  // quotes keep their record and the picker stops offering it.
  const { count, error: usageError } = await db
    .from("quotations")
    .select("quotation_id", { count: "exact", head: true })
    .eq("template_id", templateId);
  if (usageError) throw usageError;

  if ((count ?? 0) > 0) {
    const { error: archiveError } = await db
      .from("job_templates")
      .update({ is_active: false })
      .eq("template_id", templateId);
    if (archiveError) throw archiveError;
    return response({
      action: "archived",
      usedOnQuotations: count,
      message:
        '"' +
        template.name +
        '" is used on ' +
        count +
        " quotation" +
        (count === 1 ? "" : "s") +
        ", so it was archived instead of deleted.",
    });
  }

  const { error: deleteError } = await db
    .from("job_templates")
    .delete()
    .eq("template_id", templateId);
  if (deleteError) throw deleteError;
  return response({
    action: "deleted",
    usedOnQuotations: 0,
    message: '"' + template.name + '" was deleted.',
  });
}
