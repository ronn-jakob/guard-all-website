import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import { createInvoice, listInvoiceCandidates } from "../lib/api/billing.js";

const formatPeso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
};

// Net 30 is the default term; it stays editable on the form.
const defaultDueDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
};

const fieldClass =
  "mt-1.5 h-10 w-full rounded-[6px] border border-[#d6dee6] bg-white px-3 text-[12px] text-[#273746] outline-none transition focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15";
const labelClass = "flex flex-col text-[11px] font-semibold text-[#45515c]";
const sectionClass =
  "rounded-[10px] border border-[#dfe6ec] bg-white p-5 shadow-[0_3px_8px_rgb(31_59_82_/_10%)] max-[620px]:p-4";

const jobTypeLabels = {
  installation: "Installation",
  maintenance: "Preventive maintenance",
  repair: "Service call",
  inspection: "Inspection",
};

let extraRowKey = 0;
const newExtraRow = () => {
  extraRowKey += 1;
  return { key: `extra-${extraRowKey}`, description: "", quantity: "1", unitPrice: "" };
};

function InvoiceFormPage() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [extras, setExtras] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    listInvoiceCandidates()
      .then(({ candidates: incoming }) => {
        if (!isCurrent) return;
        setCandidates(Array.isArray(incoming) ? incoming : []);
        setLoadError("");
      })
      .catch((error) => {
        if (isCurrent) setLoadError(error.message);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  const filteredCandidates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return candidates;
    return candidates.filter((candidate) =>
      `${candidate.reportNumber} ${candidate.clientName} ${candidate.jobNumber}`
        .toLowerCase()
        .includes(query),
    );
  }, [candidates, search]);

  const selected = candidates.find((candidate) => candidate.reportId === selectedId) ?? null;

  const extrasTotal = extras.reduce(
    (sum, row) =>
      sum + (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0),
    0,
  );
  const quoteTotal = selected?.quotedTotal ?? 0;
  const invoiceTotal = Math.round((quoteTotal + extrasTotal) * 100) / 100;

  function selectCandidate(candidate) {
    setSelectedId(candidate.reportId);
    setSaveError("");
    setExtras([]);
  }

  function updateExtra(index, patch) {
    setExtras((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  async function handleCreate() {
    if (!selected) {
      setSaveError("Choose an approved field report first.");
      return;
    }
    const usableExtras = extras.filter(
      (row) =>
        row.description.trim() ||
        row.quantity.trim() ||
        row.unitPrice.trim(),
    );
    if (
      usableExtras.some(
        (row) =>
          !row.description.trim() ||
          !Number.isFinite(Number(row.quantity)) ||
          Number(row.quantity) <= 0 ||
          !Number.isFinite(Number(row.unitPrice)) ||
          Number(row.unitPrice) < 0,
      )
    ) {
      setSaveError(
        "Every extra line needs a description, a quantity above zero, and a price of zero or more.",
      );
      return;
    }
    if (invoiceTotal <= 0) {
      setSaveError("This invoice would total zero. Check the quotation lines.");
      return;
    }

    setSaveError("");
    setIsSaving(true);
    try {
      await createInvoice({
        reportId: selected.reportId,
        dueDate: dueDate || null,
        extras: usableExtras.map((row) => ({
          description: row.description.trim(),
          quantity: Number(row.quantity),
          unitPrice: Number(row.unitPrice),
        })),
      });
      navigate("/billing");
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

        <div className="px-8 pb-8 pt-8 max-[1024px]:px-6 max-[1024px]:pb-20 max-[1024px]:pt-5 max-[620px]:px-3">
          <div className="mb-6 flex items-end justify-between gap-4 max-[620px]:items-start">
            <div>
              <Link
                to="/billing"
                className="mb-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[.1em] text-[#7f8992] no-underline hover:text-[#1250a0]"
              >
                <span className="material-symbols-outlined text-[15px]">
                  arrow_back
                </span>
                Invoice register
              </Link>
              <h1 className="m-0 text-[28px] font-bold tracking-[-.5px] max-[1024px]:text-[22px] max-[620px]:text-[18px]">
                New invoice
              </h1>
              <p className="mb-0 mt-2 text-[13px] text-[#8b949c] max-[620px]:text-[9px]">
                Pick an approved field report. The quotation lines are copied in;
                extras are added here.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/billing")}
              className="rounded-[6px] border border-[#d9dfe4] bg-white px-4 py-2 text-[11px] font-bold text-[#5e6b78] hover:bg-[#f4f6f8] max-[620px]:hidden"
            >
              Cancel
            </button>
          </div>

          {loadError && (
            <p
              className="mb-4 rounded-[6px] border border-[#f1b7af] bg-[#fff3f1] px-4 py-3 text-[12px] text-[#a83a2c]"
              role="alert"
            >
              {loadError}
            </p>
          )}

          <div className="grid items-start gap-4 min-[900px]:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
            <section className={sectionClass}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="m-0 text-[14px] font-bold text-[#263747]">
                  Awaiting billing
                </h2>
                <span className="rounded-full bg-[#e8f1fd] px-2.5 py-1 text-[10px] font-bold text-[#1250a0]">
                  {candidates.length}
                </span>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search report, client, job"
                className={`${fieldClass} mt-3`}
              />

              <div className="mt-3 max-h-[54vh] overflow-y-auto rounded-[8px] border border-[#e1e6eb]">
                {isLoading ? (
                  <p className="m-0 px-3 py-4 text-[11px] text-[#8d969e]">
                    Loading reports...
                  </p>
                ) : filteredCandidates.length === 0 ? (
                  <p className="m-0 px-3 py-4 text-[11px] text-[#8d969e]">
                    {candidates.length === 0
                      ? "No approved reports are waiting for an invoice."
                      : "No report matches that search."}
                  </p>
                ) : (
                  filteredCandidates.map((candidate) => {
                    const isActive = candidate.reportId === selectedId;
                    return (
                      <button
                        key={candidate.reportId}
                        type="button"
                        onClick={() => selectCandidate(candidate)}
                        className={`block w-full border-b border-[#eef2f5] px-3 py-2.5 text-left last:border-b-0 ${
                          isActive
                            ? "bg-[#e8f1fd]"
                            : "bg-white hover:bg-[#f8fbff]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-[11px] text-[#174f9a]">
                            {candidate.reportNumber}
                          </strong>
                          <span className="shrink-0 text-[10px] font-bold text-[#263747]">
                            {formatPeso(candidate.quotedTotal)}
                          </span>
                        </div>
                        <span className="mt-0.5 block truncate text-[11px] text-[#3a4a57]">
                          {candidate.clientName}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-[#8d969e]">
                          {candidate.jobNumber} · {formatDate(candidate.serviceDate)}
                        </span>
                        {candidate.reportCount > 1 && (
                          <span className="mt-1 inline-block rounded-[3px] bg-[#e8f1fd] px-1.5 py-0.5 text-[9px] font-bold text-[#1250a0]">
                            {candidate.reportCount} technician reports
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {candidates.length === 0 && !isLoading && (
                <p className="m-0 mt-3 text-[10px] text-[#8b949c]">
                  Approve a submitted field report to make it billable.{" "}
                  <Link to="/reports" className="font-bold text-[#1250a0]">
                    Open reports
                  </Link>
                </p>
              )}
            </section>

            {selected ? (
              <section className="grid gap-4">
                <div className={sectionClass}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="m-0 text-[10px] font-bold uppercase tracking-[.1em] text-[#818b94]">
                        {selected.reportNumber}
                      </p>
                      <h2 className="m-0 mt-1 text-[17px] font-bold text-[#174f9a]">
                        {selected.clientName}
                      </h2>
                      <p className="m-0 mt-1 text-[11px] text-[#8b949c]">
                        {selected.jobNumber} ·{" "}
                        {jobTypeLabels[selected.jobType] ?? selected.jobType}
                        {selected.quotationId
                          ? " · quotation linked"
                          : " · no quotation linked"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="m-0 text-[10px] font-bold uppercase tracking-[.08em] text-[#818b94]">
                        Quoted
                      </p>
                      <strong className="text-[18px] font-extrabold text-[#1250a0]">
                        {formatPeso(quoteTotal)}
                      </strong>
                    </div>
                  </div>
                  {selected.siteAddress && (
                    <p className="m-0 mt-2 text-[11px] text-[#8b949c]">
                      {selected.siteAddress}
                    </p>
                  )}
                  {selected.reports?.length > 0 && (
                    <p className="m-0 mt-2 text-[11px] text-[#8b949c]">
                      Billing from{" "}
                      <strong className="text-[#3a4a57]">
                        {selected.reportNumber}
                      </strong>
                      {selected.reports[0]?.technicianName
                        ? ` (${selected.reports[0].technicianName})`
                        : ""}
                      {selected.reportCount > 1
                        ? ` · ${selected.reportCount - 1} other technician report${
                            selected.reportCount - 1 === 1 ? "" : "s"
                          } on this job`
                        : ""}
                      .
                    </p>
                  )}
                </div>

                <div className={sectionClass}>
                  <h3 className="m-0 text-[13px] font-bold text-[#263747]">
                    Quotation lines
                  </h3>
                  <p className="m-0 mt-1 text-[10px] text-[#8b949c]">
                    Copied from the accepted quotation. They cannot be edited here.
                  </p>
                  <div className="mt-3 overflow-hidden rounded-[6px] border border-[#e1e6eb]">
                    {selected.lines.length === 0 ? (
                      <p className="m-0 px-3 py-3 text-[11px] text-[#8d969e]">
                        This job has no quotation lines. Add the charges as extras
                        below.
                      </p>
                    ) : (
                      selected.lines.map((line, index) => (
                        <div
                          key={`${line.description}-${index}`}
                          className="flex items-center justify-between gap-3 border-b border-[#eef2f5] px-3 py-2 text-[11px] last:border-b-0"
                        >
                          <span className="min-w-0 truncate text-[#3a4a57]">
                            {line.description}
                          </span>
                          <span className="shrink-0 text-[10px] text-[#8d969e]">
                            {line.quantity} × {formatPeso(line.unitPrice)}
                          </span>
                          <strong className="shrink-0 text-[#174f9a]">
                            {formatPeso(line.lineTotal)}
                          </strong>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className={sectionClass}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="m-0 text-[13px] font-bold text-[#263747]">
                        Extras
                      </h3>
                      <p className="m-0 mt-1 text-[10px] text-[#8b949c]">
                        Added to this invoice only — the quotation is not changed.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setExtras((current) => [...current, newExtraRow()])
                      }
                      className="rounded-[6px] border border-[#1250a0] bg-white px-3 py-1.5 text-[10px] font-bold text-[#1250a0] hover:bg-[#f3f8ff]"
                    >
                      + Add line
                    </button>
                  </div>

                  {extras.length === 0 ? (
                    <p className="m-0 mt-3 text-[11px] text-[#8d969e]">
                      No extras. The invoice will match the quotation.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {extras.map((row, index) => {
                        const lineTotal =
                          (Number(row.quantity) || 0) *
                          (Number(row.unitPrice) || 0);
                        return (
                          <div
                            key={row.key}
                            className="grid grid-cols-[minmax(0,1fr)_80px_100px_100px_32px] items-end gap-2 max-[620px]:grid-cols-[minmax(0,1fr)_70px_32px] max-[620px]:gap-y-1"
                          >
                            <label className={labelClass}>
                              Description
                              <input
                                className={fieldClass}
                                value={row.description}
                                onChange={(event) =>
                                  updateExtra(index, {
                                    description: event.target.value,
                                  })
                                }
                                placeholder="Extra charge"
                              />
                            </label>
                            <label className={labelClass}>
                              Qty
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                className={`${fieldClass} text-center`}
                                value={row.quantity}
                                onChange={(event) =>
                                  updateExtra(index, {
                                    quantity: event.target.value,
                                  })
                                }
                              />
                            </label>
                            <label className={labelClass}>
                              Unit price
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className={`${fieldClass} text-center`}
                                value={row.unitPrice}
                                onChange={(event) =>
                                  updateExtra(index, {
                                    unitPrice: event.target.value,
                                  })
                                }
                                placeholder="0.00"
                              />
                            </label>
                            <div className="flex h-10 items-center justify-end text-[12px] font-bold text-[#1250a0] max-[620px]:col-start-2 max-[620px]:row-start-2">
                              {formatPeso(lineTotal)}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setExtras((current) =>
                                  current.filter((_, rowIndex) => rowIndex !== index),
                                )
                              }
                              aria-label="Remove extra line"
                              className="mb-1 text-[#8b949c] hover:text-[#c0392b]"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                delete
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className={sectionClass}>
                  <div className="grid gap-3 min-[620px]:grid-cols-[1fr_220px]">
                    <label className={labelClass}>
                      Due date
                      <input
                        type="date"
                        className={fieldClass}
                        value={dueDate}
                        min={todayKey()}
                        onChange={(event) => setDueDate(event.target.value)}
                      />
                      <span className="mt-1 text-[10px] font-normal text-[#8b949c]">
                        Defaults to 30 days from today.
                      </span>
                    </label>
                    <div className="rounded-[8px] border border-[#e1e6eb] bg-[#fbfdff] px-4 py-3 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[#7f8992]">Quotation</span>
                        <span className="font-semibold text-[#263747]">
                          {formatPeso(quoteTotal)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-[#7f8992]">Extras</span>
                        <span className="font-semibold text-[#263747]">
                          {formatPeso(extrasTotal)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-[#e1e6eb] pt-2">
                        <strong className="text-[#263747]">Invoice total</strong>
                        <strong className="text-[14px] text-[#1250a0]">
                          {formatPeso(invoiceTotal)}
                        </strong>
                      </div>
                      <p className="m-0 mt-1 text-[9px] text-[#8b949c]">
                        Prices are final and tax-inclusive.
                      </p>
                    </div>
                  </div>

                  {saveError && (
                    <p
                      className="m-0 mt-3 rounded-[6px] border border-[#f1b7af] bg-[#fff3f1] px-3 py-2 text-[11px] text-[#a83a2c]"
                      role="alert"
                    >
                      {saveError}
                    </p>
                  )}

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => navigate("/billing")}
                      className="rounded-[6px] border border-[#d9dfe4] bg-white px-4 py-2 text-[11px] font-bold text-[#5e6b78] hover:bg-[#f4f6f8]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={isSaving}
                      className="rounded-[6px] bg-[#1250a0] px-5 py-2 text-[11px] font-bold text-white hover:bg-[#0f4387] disabled:opacity-50"
                    >
                      {isSaving ? "Creating invoice..." : "Create invoice"}
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <section className="rounded-[10px] border border-dashed border-[#cfdae4] bg-white/70 px-6 py-16 text-center">
                <span className="material-symbols-outlined text-[40px] text-[#a9bccd]">
                  receipt_long
                </span>
                <p className="m-0 mt-2 text-[13px] font-bold text-[#5e6b78]">
                  Choose an approved report
                </p>
                <p className="m-0 mt-1 text-[11px] text-[#8b949c]">
                  Its quotation lines and totals appear here.
                </p>
              </section>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default InvoiceFormPage;
