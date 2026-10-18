import { useEffect, useState } from "react";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import { callAuthFunction } from "../lib/auth.js";

const jobTypes = [
  { value: "installation", label: "Installation" },
  { value: "maintenance", label: "Preventive maintenance" },
  { value: "repair", label: "Service call" },
  { value: "inspection", label: "Inspection" },
];

const lineTypes = [
  { value: "labor", label: "Labor" },
  { value: "parts", label: "Part" },
  { value: "transport", label: "Transport" },
  { value: "other", label: "Other" },
];

const branchOptions = [
  { value: "", label: "All branches" },
  { value: "makati", label: "Makati" },
  { value: "cebu", label: "Cebu" },
];

const fieldClass =
  "mt-1.5 h-11 w-full rounded-[6px] border border-[#d6dee6] bg-white px-3 text-[13px] text-[#273746] outline-none transition focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15";
const labelClass = "flex flex-col text-[12px] font-semibold text-[#45515c]";

const formatPeso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const jobTypeLabel = (value) =>
  jobTypes.find((option) => option.value === value)?.label ?? value;

const branchLabel = (value) =>
  value ? value.replace(/^./, (letter) => letter.toUpperCase()) : "All branches";

let rowKey = 0;
function newRow(lineType = "labor") {
  rowKey += 1;
  return {
    key: `row-${rowKey}`,
    lineType,
    partId: "",
    description: "",
    quantity: "1",
    unitPrice: "",
  };
}

function toDraft(template) {
  return {
    id: template.id,
    name: template.name,
    jobType: template.jobType,
    branch: template.branch ?? "",
    description: template.description ?? "",
    isActive: template.isActive,
    markupPercent: String(template.markupPercent ?? 0),
    items: (template.items ?? []).map((item) => ({
      key: `row-${(rowKey += 1)}`,
      lineType: item.lineType,
      partId: item.partId ?? "",
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPriceBase ?? item.unitPriceClient ?? 0),
    })),
  };
}

const emptyDraft = () => ({
  id: null,
  name: "",
  jobType: "installation",
  branch: "",
  description: "",
  isActive: true,
  markupPercent: "0",
  items: [newRow("labor")],
});

function JobTemplates() {
  const [templates, setTemplates] = useState([]);
  const [parts, setParts] = useState([]);
  const [draft, setDraft] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      callAuthFunction("list-job-templates"),
      callAuthFunction("list-parts"),
    ])
      .then(([templateResult, partResult]) => {
        if (!isMounted) return;
        setTemplates(Array.isArray(templateResult?.templates) ? templateResult.templates : []);
        setParts(Array.isArray(partResult?.parts) ? partResult.parts : []);
      })
      .catch((error) => {
        if (isMounted) setLoadError(error.message);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const markupFactor = 1 + (Number(draft?.markupPercent) || 0) / 100;

  // The client price is the markup applied to each line's base price, rounded per
  // line so the total matches the quotation the backend will generate.
  const clientUnitPrice = (item) =>
    Math.round((Number(item.unitPrice) || 0) * markupFactor * 100) / 100;
  const clientLineTotal = (item) =>
    Math.round((Number(item.quantity) || 0) * clientUnitPrice(item) * 100) / 100;

  const draftSubtotal = (draft?.items ?? []).reduce(
    (sum, item) =>
      sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );
  const draftTotal = (draft?.items ?? []).reduce(
    (sum, item) => sum + clientLineTotal(item),
    0,
  );

  // Markup applies to the whole subtotal, so only the percentage changes — the
  // line prices below stay as the base amounts entered here.
  function changeMarkup(nextPercent) {
    setDraft((current) => ({ ...current, markupPercent: nextPercent }));
  }

  function updateItem(index, patch) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  function addItem() {
    setDraft((current) => ({
      ...current,
      items: [...current.items, newRow("labor")],
    }));
  }

  function removeItem(index) {
    setDraft((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function reload(selectId) {
    const { templates: incoming = [] } = await callAuthFunction(
      "list-job-templates",
    );
    const next = Array.isArray(incoming) ? incoming : [];
    setTemplates(next);
    const target = selectId
      ? next.find((template) => template.id === selectId)
      : null;
    setDraft(target ? toDraft(target) : null);
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaveError("");
    setSaveMessage("");

    if (!draft.name.trim()) {
      setSaveError("Give the template a name.");
      return;
    }
    const usableItems = draft.items.filter((item) => item.description.trim());
    if (!usableItems.length) {
      setSaveError("Add at least one line with a description.");
      return;
    }
    const missingPart = usableItems.find(
      (item) => item.lineType === "parts" && !item.partId,
    );
    if (missingPart) {
      setSaveError("Pick a part for every line marked as a Part.");
      return;
    }
    // Part quantities feed integer columns downstream (job_parts, stock_movements),
    // so they must stay whole numbers. Fractional quantities stay valid for labour.
    const badPartQuantity = usableItems.find(
      (item) =>
        item.lineType === "parts" &&
        (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1),
    );
    if (badPartQuantity) {
      setSaveError("Part quantities must be whole numbers, 1 or more.");
      return;
    }

    setIsSaving(true);
    try {
      const { templateId } = await callAuthFunction("save-job-template", {
        templateId: draft.id,
        name: draft.name,
        jobType: draft.jobType,
        branch: draft.branch || null,
        description: draft.description,
        isActive: draft.isActive,
        markupPercent: Number(draft.markupPercent) || 0,
        items: usableItems.map((item) => ({
          lineType: item.lineType,
          partId: item.lineType === "parts" ? item.partId : null,
          description: item.description,
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.unitPrice) || 0,
        })),
      });
      await reload(templateId);
      setSaveMessage("Template saved.");
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="flex h-screen overflow-hidden bg-[#1f2022] font-sans text-[#063b7c] max-[1024px]:block">
      <Sidebar />
      <section className="h-screen w-full min-w-0 flex-1 overflow-y-auto bg-[#edf7ff] max-[1024px]:h-[100dvh]">
        <TopBar />
        <div className="px-8 pb-6 pt-8 max-[1024px]:px-6 max-[1024px]:pb-20 max-[1024px]:pt-5 max-[620px]:px-3">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#818b94]">
                Finance / Pricing
              </p>
              <h1 className="m-0 text-[30px] font-bold tracking-[-.5px] max-[1024px]:text-[24px] max-[620px]:text-[19px]">
                Job templates
              </h1>
              <p className="mb-0 mt-2 text-[14px] text-[#8b949c] max-[620px]:mt-1 max-[620px]:text-[9px]">
                The standard priced packages a Service Manager picks when quoting a job.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSaveError("");
                setSaveMessage("");
                setDraft(emptyDraft());
              }}
              className="rounded-[6px] bg-[#1250a0] px-5 py-3 text-[12px] font-bold text-white shadow-[0_2px_4px_rgb(18_80_160_/_25%)] hover:bg-[#0f4387] max-[1024px]:px-4 max-[1024px]:py-2"
            >
              + New template
            </button>
          </header>

          {loadError && (
            <p
              className="mb-4 rounded-[6px] border border-[#f1b7af] bg-[#fff3f1] px-4 py-3 text-[12px] text-[#a83a2c]"
              role="alert"
            >
              {loadError}
            </p>
          )}

          <div className="grid grid-cols-[330px_minmax(0,1fr)] items-start gap-4 max-[850px]:grid-cols-1">
            <aside className="overflow-hidden rounded-[10px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_12%)]">
              <header className="border-b border-[#e1e6eb] px-5 py-4">
                <h2 className="m-0 text-[15px] font-bold text-[#68798a]">
                  Templates
                </h2>
                <p className="m-0 mt-1 text-[12px] text-[#8b949c]">
                  {templates.length}{" "}
                  {templates.length === 1 ? "template" : "templates"}
                </p>
              </header>

              {isLoading ? (
                <p className="m-0 px-5 py-8 text-center text-[13px] text-[#7d8994]">
                  Loading templates...
                </p>
              ) : templates.length === 0 ? (
                <p className="m-0 px-5 py-8 text-center text-[13px] text-[#7d8994]">
                  No templates yet. Create one so Service Managers can quote a
                  standard price.
                </p>
              ) : (
                <div className="max-h-[560px] divide-y divide-[#e1e6eb] overflow-y-auto">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => {
                        setSaveError("");
                        setSaveMessage("");
                        setDraft(toDraft(template));
                      }}
                      className={`block w-full px-5 py-4 text-left transition-colors ${
                        draft?.id === template.id
                          ? "border-l-4 border-l-[#286fc7] bg-[#eef4ff]"
                          : "hover:bg-[#f4f8ff]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <strong className="truncate text-[14px] text-[#174276]">
                          {template.name}
                        </strong>
                        {!template.isActive && (
                          <span className="shrink-0 rounded-full border border-[#c8c8c8] bg-[#f3f3f3] px-2 py-0.5 text-[10px] font-bold text-[#858585]">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="m-0 mt-1 text-[12px] text-[#7d8994]">
                        {jobTypeLabel(template.jobType)} ·{" "}
                        {branchLabel(template.branch)}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <strong className="text-[13px] text-[#1250a0]">
                          {formatPeso(template.total)}
                        </strong>
                        <span className="text-[11px] text-[#8b949c]">
                          {template.items.length}{" "}
                          {template.items.length === 1 ? "line" : "lines"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </aside>

            {!draft ? (
              <section className="rounded-[10px] border border-dashed border-[#cbd8e7] bg-white px-6 py-12 text-center text-[14px] text-[#778593]">
                Select a template to edit, or create a new one.
              </section>
            ) : (
              <section className="overflow-hidden rounded-[10px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_12%)]">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e1e6eb] px-6 py-4">
                  <div>
                    <h2 className="m-0 text-[17px] font-bold text-[#263747]">
                      {draft.id ? "Edit template" : "New template"}
                    </h2>
                    <p className="m-0 mt-1 text-[11px] text-[#8b949c]">
                      Base {formatPeso(draftSubtotal)} · markup{" "}
                      {Number(draft.markupPercent) || 0}%
                    </p>
                  </div>
                  <div className="flex items-end gap-4">
                    <label className="flex flex-col text-[11px] font-semibold text-[#68798a]">
                      Markup %
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.markupPercent}
                        onChange={(event) => changeMarkup(event.target.value)}
                        className="mt-1 h-9 w-24 rounded-[6px] border border-[#d6dee6] bg-white px-2 text-right text-[13px] text-[#273746] outline-none transition focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15"
                      />
                    </label>
                    <div className="text-right">
                      <span className="block text-[11px] font-semibold text-[#8b949c]">
                        Client price
                      </span>
                      <strong className="block text-[18px] text-[#1250a0]">
                        {formatPeso(draftTotal)}
                      </strong>
                    </div>
                  </div>
                </header>

                <form
                  className="space-y-4 px-6 py-5"
                  onSubmit={handleSave}
                >
                  <div className="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1">
                    <label className={labelClass}>
                      Template name
                      <input
                        className={fieldClass}
                        value={draft.name}
                        onChange={(event) =>
                          setDraft({ ...draft, name: event.target.value })
                        }
                        placeholder="e.g. CCTV installation — 4 cameras"
                        required
                      />
                    </label>
                    <label className={labelClass}>
                      Service type
                      <select
                        className={fieldClass}
                        value={draft.jobType}
                        onChange={(event) =>
                          setDraft({ ...draft, jobType: event.target.value })
                        }
                      >
                        {jobTypes.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1">
                    <label className={labelClass}>
                      Branch
                      <select
                        className={fieldClass}
                        value={draft.branch}
                        onChange={(event) =>
                          setDraft({ ...draft, branch: event.target.value })
                        }
                      >
                        {branchOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={labelClass}>
                      Description
                      <input
                        className={fieldClass}
                        value={draft.description}
                        onChange={(event) =>
                          setDraft({ ...draft, description: event.target.value })
                        }
                        placeholder="Shown on the template card"
                      />
                    </label>
                  </div>

                  <label className="flex items-center gap-2 text-[12px] font-semibold text-[#45515c]">
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(event) =>
                        setDraft({ ...draft, isActive: event.target.checked })
                      }
                      className="h-4 w-4 rounded border-gray-300 text-[#1250a0] focus:ring-[#1250a0]"
                    />
                    Available for new quotes
                  </label>

                  <div className="rounded-[8px] border border-[#e1e6eb]">
                    <div className="flex items-center justify-between border-b border-[#e1e6eb] bg-[#fafafa] px-3 py-2">
                      <strong className="text-[11px] font-bold uppercase tracking-[.06em] text-[#77818a]">
                        Lines
                      </strong>
                      <button
                        type="button"
                        onClick={addItem}
                        className="rounded-[5px] border border-[#1250a0] bg-white px-2.5 py-1 text-[11px] font-bold text-[#1250a0] hover:bg-[#f3f8ff]"
                      >
                        + Add line
                      </button>
                    </div>

                    <div className="divide-y divide-[#eef2f6]">
                      {draft.items.map((item, index) => (
                        <div
                          key={item.key}
                          className="grid grid-cols-[130px_150px_minmax(0,1fr)_80px_110px_100px_36px] items-end gap-2 px-3 py-3 max-[1100px]:grid-cols-2 max-[1100px]:gap-2"
                        >
                          <label className="flex flex-col text-[11px] font-semibold text-[#68798a]">
                            Type
                            <select
                              className={`${fieldClass} mt-1 h-9 text-[12px]`}
                              value={item.lineType}
                              onChange={(event) =>
                                updateItem(index, {
                                  lineType: event.target.value,
                                  partId:
                                    event.target.value === "parts"
                                      ? item.partId
                                      : "",
                                })
                              }
                            >
                              {lineTypes.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="flex flex-col text-[11px] font-semibold text-[#68798a]">
                            Part
                            <select
                              className={`${fieldClass} mt-1 h-9 text-[12px]`}
                              value={item.partId}
                              disabled={item.lineType !== "parts"}
                              onChange={(event) => {
                                const nextPartId = event.target.value;
                                const selectedPart = parts.find(
                                  (part) => part.id === nextPartId,
                                );
                                updateItem(index, {
                                  partId: nextPartId,
                                  // Base price is the inventory cost; the markup is
                                  // applied to the whole subtotal, not per line.
                                  unitPrice: selectedPart
                                    ? String(selectedPart.unitCost)
                                    : "",
                                  description: item.description.trim()
                                    ? item.description
                                    : (selectedPart?.name ?? ""),
                                });
                              }}
                            >
                              <option value="">
                                {item.lineType === "parts" ? "Select part" : "—"}
                              </option>
                              {parts.map((part) => (
                                <option key={part.id} value={part.id}>
                                  {part.sku} — {part.name} (
                                  {formatPeso(part.unitCost)})
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="flex flex-col text-[11px] font-semibold text-[#68798a]">
                            Description
                            <input
                              className={`${fieldClass} mt-1 h-9 text-[12px]`}
                              value={item.description}
                              onChange={(event) =>
                                updateItem(index, {
                                  description: event.target.value,
                                })
                              }
                              placeholder="e.g. Installation package"
                            />
                          </label>

                          <label className="flex flex-col text-[11px] font-semibold text-[#68798a]">
                            Qty
                            <input
                              type="number"
                              min={item.lineType === "parts" ? "1" : "0.01"}
                              step={item.lineType === "parts" ? "1" : "0.01"}
                              className={`${fieldClass} mt-1 h-9 text-[12px]`}
                              value={item.quantity}
                              onChange={(event) =>
                                updateItem(index, {
                                  quantity: event.target.value,
                                })
                              }
                            />
                          </label>

                          <label className="flex flex-col text-[11px] font-semibold text-[#68798a]">
                            Base price
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className={`${fieldClass} mt-1 h-9 text-[12px]`}
                              value={item.unitPrice}
                              onChange={(event) =>
                                updateItem(index, {
                                  unitPrice: event.target.value,
                                })
                              }
                              placeholder="0.00"
                            />
                          </label>

                          <div className="flex h-9 items-center justify-end text-[12px] font-bold text-[#1250a0]">
                            {formatPeso(clientLineTotal(item))}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            disabled={draft.items.length === 1}
                            aria-label={`Remove line ${index + 1}`}
                            className="grid h-9 w-9 place-items-center rounded-[6px] text-[#89939b] hover:bg-[#f3f8ff] hover:text-[#b64132] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              delete
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>

                    <p className="m-0 border-t border-[#e1e6eb] bg-[#fbfdff] px-3 py-2 text-[11px] text-[#8b949c]">
                      Prices here are base amounts. The markup is applied to the
                      whole subtotal to produce the client price, and changing the
                      percentage does not alter the line prices. The Service Manager
                      only ever sees the final client price.
                    </p>
                  </div>

                  {saveError && (
                    <p
                      className="m-0 rounded-[5px] border border-[#f0b8b0] bg-[#fff1ee] px-3 py-2 text-[12px] text-[#b64132]"
                      role="alert"
                    >
                      {saveError}
                    </p>
                  )}
                  {saveMessage && (
                    <p
                      className="m-0 rounded-[5px] border border-[#a8dfb7] bg-[#effaf2] px-3 py-2 text-[12px] text-[#267340]"
                      role="status"
                    >
                      {saveMessage}
                    </p>
                  )}

                  <div className="flex justify-end gap-3 border-t border-[#e8edf1] pt-4">
                    <button
                      type="button"
                      onClick={() => setDraft(null)}
                      className="rounded-[6px] border border-[#d6dee6] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#68798a] hover:bg-[#f7faff]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="rounded-[6px] bg-[#1250a0] px-5 py-2.5 text-[12px] font-bold text-white hover:bg-[#0f4387] disabled:cursor-wait disabled:opacity-60"
                    >
                      {isSaving ? "Saving..." : "Save template"}
                    </button>
                  </div>
                </form>
              </section>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default JobTemplates;
