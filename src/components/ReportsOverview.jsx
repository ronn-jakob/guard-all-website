import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { callAuthFunction } from "../lib/auth.js";

const statusStyles = {
  orange: "border-[#ff9f8f] bg-[#ffe5df] text-[#e05b45]",
  gray: "border-[#c8c8c8] bg-[#f3f3f3] text-[#858585]",
  green: "border-[#73c481] bg-[#e1f6e4] text-[#388b47]",
  yellow: "border-[#e8cc70] bg-[#fdf5dd] text-[#8a6d1a]",
};

// Queue filters for the Incoming Reports list.
const queueFilters = [
  { value: "all", label: "All items" },
  { value: "submitted", label: "Submitted" },
  { value: "awaiting", label: "Awaiting report" },
];

function StatusPill({ children, tone }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[11px] font-bold ${
        statusStyles[tone] ?? statusStyles.gray
      }`}
    >
      {children}
    </span>
  );
}

function ReportsOverview() {
  const [reports, setReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [isFullDetailsOpen, setIsFullDetailsOpen] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [queueFilter, setQueueFilter] = useState("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    callAuthFunction("list-field-reports")
      .then(({ reports: incomingReports = [] }) => {
        if (!isMounted) return;
        const nextReports = Array.isArray(incomingReports)
          ? incomingReports
          : [];
        setReports(nextReports);
        setSelectedReportId(nextReports[0]?.id ?? null);
      })
      .catch(() => {
        if (isMounted) {
          setReports([]);
          setSelectedReportId(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reload the queue without discarding the current selection.
  async function refreshReports() {
    const { reports: incomingReports = [] } = await callAuthFunction(
      "list-field-reports",
    );
    setReports(Array.isArray(incomingReports) ? incomingReports : []);
  }

  async function handleReviewReport(decision) {
    if (!selectedReport?.reportUuid) return;
    setReviewError("");
    setReviewMessage("");
    setIsReviewing(true);
    try {
      const result = await callAuthFunction("review-field-report", {
        reportId: selectedReport.reportUuid,
        decision,
      });
      await refreshReports();
      setReviewMessage(result.message);
    } catch (error) {
      setReviewError(error.message);
    } finally {
      setIsReviewing(false);
    }
  }

  const filteredQueue = reports.filter((report) => {
    if (queueFilter === "submitted") return !report.isPendingReport;
    if (queueFilter === "awaiting") return Boolean(report.isPendingReport);
    return true;
  });
  const queueFilterLabel =
    queueFilters.find((option) => option.value === queueFilter)?.label ??
    "All items";

  // Keep the open report inside the filtered set, so the detail pane can never
  // show something that the list is currently hiding.
  const selectedReport =
    filteredQueue.find((report) => report.id === selectedReportId) ||
    filteredQueue[0] ||
    null;
  const selectedReportDetails = selectedReport;

  function applyQueueFilter(nextFilter) {
    setQueueFilter(nextFilter);
    setIsFilterOpen(false);
    const nextQueue = reports.filter((report) => {
      if (nextFilter === "submitted") return !report.isPendingReport;
      if (nextFilter === "awaiting") return Boolean(report.isPendingReport);
      return true;
    });
    if (!nextQueue.some((report) => report.id === selectedReportId)) {
      setSelectedReportId(nextQueue[0]?.id ?? null);
    }
  }

  return (
    <main className="flex h-screen overflow-hidden bg-[#1f2022] font-sans text-[#063b7c] max-[1024px]:block">
      <Sidebar />
      <section className="h-screen w-full min-w-0 flex-1 overflow-y-auto bg-[#edf7ff] max-[1024px]:h-[100dvh]">
        <TopBar />
        <div className="px-8 pb-6 pt-7 max-[1024px]:px-6 max-[1024px]:pb-20 max-[1024px]:pt-5 max-[620px]:px-3">
          <header className="mb-5 flex items-end justify-between max-[620px]:items-start max-[620px]:gap-3">
            <div>
              <p className="mb-1 text-[12px] font-bold uppercase tracking-[.12em] text-[#818b94]">
                Operations / Field reporting
              </p>
              <h1 className="m-0 text-[30px] font-bold tracking-[-.5px] max-[1280px]:text-[26px] max-[620px]:text-[22px]">
                Field Reports
              </h1>
              <p className="mb-0 mt-1 text-[14px] text-[#8b949c]">
                A concise manager review on what happened on site.
              </p>
            </div>
            <Link
              className="inline-flex items-center gap-2 rounded-[6px] bg-[#1250a0] px-4 py-3 text-[14px] font-bold text-white no-underline shadow-[0_2px_4px_rgb(18_80_160_/_25%)] transition-colors hover:bg-[#0d438a] max-[620px]:px-3 max-[620px]:py-2"
              to="/reports/new"
            >
              <span className="material-symbols-outlined text-[19px]">add</span>
              New Report
            </Link>
          </header>

          <div className="mb-4 grid grid-cols-4 gap-4 max-[850px]:grid-cols-2 max-[620px]:gap-2">
            {[
              [
                "Needs Review",
                String(
                  reports.filter((report) => report.status === "Needs Review")
                    .length,
                ),
                "text-[#e34f2d]",
              ],
              [
                "Submitted",
                String(
                  reports.filter((report) => report.status === "Submitted")
                    .length,
                ),
                "text-[#15519c]",
              ],
              [
                "Ready for Billing",
                String(
                  reports.filter(
                    (report) => report.status === "Ready for Billing",
                  ).length,
                ),
                "text-[#388b47]",
              ],
              [
                "Sign-off Captured",
                String(
                  reports.filter(
                    (report) =>
                      !report.isPendingReport &&
                      report.signature?.method !== "Awaiting client sign-off",
                  ).length,
                ),
                "text-[#15519c]",
              ],
            ].map(([label, value, color]) => (
              <article
                className="rounded-[10px] border border-[#dfe6ec] bg-white px-5 py-4 shadow-[0_3px_8px_rgb(31_59_82_/_14%)] max-[620px]:px-3 max-[620px]:py-3"
                key={label}
              >
                <p className="m-0 text-[11px] font-bold uppercase tracking-[.06em] text-[#7e878e]">
                  {label}
                </p>
                <strong
                  className={`mt-2 block text-[29px] leading-none ${color}`}
                >
                  {value}
                </strong>
              </article>
            ))}
          </div>

          <div className="grid grid-cols-[380px_minmax(0,1fr)] items-start gap-4 max-[1100px]:grid-cols-[330px_minmax(0,1fr)] max-[850px]:grid-cols-1">
            <section className="overflow-hidden rounded-[10px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_12%)]">
              <header className="flex items-start justify-between border-b border-[#e1e6eb] px-5 py-4">
                <div>
                  <h2 className="m-0 text-[15px] font-bold text-[#68798a]">
                    Incoming Reports
                  </h2>
                  <p className="m-0 mt-1 text-[12px] text-[#8b949c]">
                    {reports.length
                      ? queueFilter === "all"
                        ? `${reports.length} item${reports.length === 1 ? "" : "s"} in current queue`
                        : `${filteredQueue.length} of ${reports.length} · ${queueFilterLabel}`
                      : "No reports or reserved jobs in current queue"}
                  </p>
                </div>
                <div className="relative" ref={filterRef}>
                  <button
                    className={`border-0 bg-transparent p-0 ${
                      queueFilter === "all" ? "text-[#7b8792]" : "text-[#174f9a]"
                    }`}
                    type="button"
                    aria-expanded={isFilterOpen}
                    aria-haspopup="true"
                    title={`Filter the queue (${queueFilterLabel})`}
                    onClick={() => setIsFilterOpen((isOpen) => !isOpen)}
                  >
                    <span className="material-symbols-outlined text-[21px]">
                      filter_alt
                    </span>
                  </button>
                  {isFilterOpen && (
                    <div className="absolute right-0 z-30 mt-2 w-48 rounded-[8px] border border-[#d9dfe4] bg-white p-1 shadow-[0_8px_20px_rgba(0,0,0,0.12)]">
                      {queueFilters.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => applyQueueFilter(option.value)}
                          className={`flex w-full items-center justify-between rounded-[5px] px-3 py-2 text-left text-[12px] transition-colors ${
                            queueFilter === option.value
                              ? "bg-[#e8f1fd] font-bold text-[#1250a0]"
                              : "text-[#3a434d] hover:bg-[#f1f5f9]"
                          }`}
                        >
                          <span>{option.label}</span>
                          {queueFilter === option.value && (
                            <span className="material-symbols-outlined text-[15px]">
                              check
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </header>
              <div className="max-h-[580px] overflow-y-auto">
                {reports.length === 0 ? (
                  <div className="px-5 py-8 text-center text-[13px] text-[#7d8994]">
                    No reports or reserved jobs are waiting in the queue.
                  </div>
                ) : filteredQueue.length === 0 ? (
                  <div className="px-5 py-8 text-center text-[13px] text-[#7d8994]">
                    <p className="m-0">
                      Nothing matches the <strong>{queueFilterLabel}</strong>{" "}
                      filter.
                    </p>
                    <button
                      type="button"
                      onClick={() => applyQueueFilter("all")}
                      className="mt-2 border-0 bg-transparent text-[12px] font-bold text-[#174f9a] hover:underline"
                    >
                      Show all items
                    </button>
                  </div>
                ) : (
                  filteredQueue.map((report) => (
                    <button
                      className={`block w-full border-b border-[#e1e6eb] px-5 py-4 text-left last:border-b-0 transition-colors hover:bg-[#f4f8ff] ${report.id === selectedReportId ? "border-l-4 border-l-[#286fc7] bg-[#eef4ff]" : ""}`}
                      key={report.id}
                      type="button"
                      onClick={() => setSelectedReportId(report.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-[11px] font-bold text-[#35649a]">
                          {report.id}
                        </strong>
                        <StatusPill tone={report.tone}>
                          {report.status}
                        </StatusPill>
                      </div>
                      <h3 className="m-0 mt-3 truncate text-[15px] font-bold text-[#174276]">
                        {report.client}
                      </h3>
                      <p className="m-0 mt-1 truncate text-[12px] text-[#7d8994]">
                        {report.service}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-[#8b949c]">
                        <span className="min-w-0 truncate">
                          {report.technician}
                        </span>
                        <span className="shrink-0">{report.time}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>

            {selectedReport ? (
              <section className="overflow-hidden rounded-[10px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_12%)]">
                <header className="flex items-start justify-between border-b border-[#e1e6eb] px-6 py-5 max-[620px]:px-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-[12px] font-bold text-[#35649a]">
                        {selectedReport.id}
                      </strong>
                      <StatusPill tone={selectedReport.tone}>
                        {selectedReport.status}
                      </StatusPill>
                    </div>
                    <h2 className="m-0 mt-2 text-[17px] font-bold text-[#174276]">
                      {selectedReport.client}
                    </h2>
                    <p className="m-0 mt-1 text-[11px] text-[#8b949c]">
                      {selectedReport.service} &nbsp;•&nbsp;{" "}
                      {selectedReport.isPendingReport ? "Stock reserved" : "Submitted"}{" "}
                      {selectedReport.time}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-[#707b86]">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-[#d65c58] text-[11px] font-bold text-white">
                      {selectedReport.technician
                        .split(" ")
                        .map((name) => name[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase() || "T"}
                    </span>
                    {selectedReport.technician}
                  </div>
                </header>

                <div className="grid grid-cols-[1.25fr_1fr] gap-6 px-6 py-5 max-[620px]:grid-cols-1 max-[620px]:px-4">
                  <div>
                    <p className="m-0 text-[11px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
                      01 / Work Summary
                    </p>
                    <h3 className="m-0 mt-3 text-[15px] font-bold text-[#174276]">
                      {selectedReport.service}
                    </h3>
                    <p className="m-0 mt-2 text-[12px] leading-relaxed text-[#7d8994]">
                      {selectedReport.workSummary}
                    </p>
                    <div className="my-4 border-t border-[#e1e6eb]" />
                    <p className="m-0 text-[11px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
                      02 / {selectedReport.isPendingReport ? "Reserved Parts" : "Parts Used"}
                    </p>
                    <div className="mt-3 rounded-[7px] border border-[#bac8db] bg-[#eef4ff] px-4 py-3 text-[12px] text-[#35649a]">
                      {selectedReport.parts.length === 0 ? (
                        <div className="text-[#68798a]">
                          No parts were recorded for this report.
                        </div>
                      ) : (
                        <>
                          {selectedReport.parts.slice(0, 3).map((part) => (
                            <div
                              className="flex items-center justify-between gap-3 py-1.5 font-bold"
                              key={part.sku}
                            >
                              <span>
                                {part.quantity} x {part.sku}
                              </span>
                              <span className="font-normal text-[#8b949c]">
                                {part.note}
                              </span>
                            </div>
                          ))}
                          {selectedReport.parts.length > 3 && (
                            <button
                              type="button"
                              onClick={() => setIsFullDetailsOpen(true)}
                              className="mt-3 w-full border-t border-[#cbd8e7] bg-transparent pt-3 text-center text-[#68798a] hover:text-[#174f9a]"
                            >
                              Show More
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-[7px] border border-[#bac8db] bg-[#f3f7fd] p-4">
                      <p className="m-0 text-[11px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
                        Attached Images
                      </p>
                      {selectedReport.images.length === 0 ? (
                        <div className="mt-3 text-[12px] text-[#8b949c]">
                          No images attached.
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center justify-between text-[12px] text-[#8b949c]">
                          <span className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">
                              image
                            </span>
                            {selectedReport.images[0].name}
                          </span>
                          <strong className="text-[11px]">Open</strong>
                        </div>
                      )}
                    </div>
                    <div className="rounded-[7px] border border-[#9ed6a8] bg-[#effbef] p-4 text-[12px] text-[#5b9764]">
                      <div className="flex items-center justify-between font-bold">
                        <span>✓ &nbsp; Client Sign-off</span>
                        <span className="font-normal">
                          {selectedReport.signature?.signedAt || "Pending"}
                        </span>
                      </div>
                      <div className="mt-3 flex justify-between text-[11px]">
                        <span>
                          {selectedReport.signature?.signer || "Client Name"} ·{" "}
                          {selectedReport.signature?.method ||
                            "Awaiting sign-off"}
                        </span>
                        <span>{selectedReport.time}</span>
                      </div>
                    </div>
                    <div className="rounded-[7px] border border-[#bac8db] bg-[#eef4ff] p-4 text-[12px] text-[#5b9764]">
                      <p className="m-0 font-bold uppercase tracking-[.08em] text-[#7d8994]">
                        Billing Readiness
                      </p>
                      <p className="m-0 mt-4 font-bold">
                        ✓ &nbsp;{" "}
                        {selectedReport.billing?.inventory || "Pending"}
                      </p>
                      <p className="m-0 mt-3 font-bold">
                        ✓ &nbsp;{" "}
                        {selectedReport.billing?.readiness || "Awaiting review"}
                      </p>
                    </div>
                  </div>
                </div>

                <footer className="flex items-center justify-between border-t border-[#e1e6eb] bg-[#eef4ff] px-6 py-4 max-[620px]:flex-col max-[620px]:items-stretch max-[620px]:gap-3 max-[620px]:px-4">
                  <a
                    className="text-[13px] font-bold text-[#7a8793] no-underline hover:text-[#174f9a]"
                    href="#details"
                    onClick={(event) => {
                      event.preventDefault();
                      setIsFullDetailsOpen(true);
                    }}
                  >
                    Show Full Details
                  </a>
                    {selectedReport.isPendingReport ? (
                      <p className="m-0 text-[12px] font-semibold text-[#68798a]">
                        Awaiting technician field report
                      </p>
                    ) : (
                      <div className="flex gap-3 max-[620px]:flex-1">
                        <button
                          className="inline-flex h-10 flex-1 items-center justify-center rounded-[7px] border-2 border-[#c5ccd6] bg-transparent px-4 text-[12px] font-bold text-[#89939e] disabled:cursor-not-allowed disabled:opacity-50"
                          type="button"
                          disabled={
                            isReviewing ||
                            selectedReport.reviewStatus === "returned"
                          }
                          onClick={() => handleReviewReport("return")}
                        >
                          {selectedReport.reviewStatus === "returned"
                            ? "Returned"
                            : "Return for Correction"}
                        </button>
                        <button
                          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-[7px] bg-[#1953a5] px-4 text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                          type="button"
                          disabled={
                            isReviewing ||
                            selectedReport.reviewStatus === "approved"
                          }
                          onClick={() => handleReviewReport("approve")}
                        >
                          <span className="material-symbols-outlined text-[17px]">
                            send
                          </span>
                          {isReviewing
                            ? "Saving..."
                            : selectedReport.reviewStatus === "approved"
                              ? "Approved for Billing"
                              : "Approve for Billing"}
                        </button>
                      </div>
                    )}
                </footer>
                {(reviewError || reviewMessage) && (
                  <p
                    className={`m-0 border-t px-6 py-3 text-[12px] font-semibold max-[620px]:px-4 ${
                      reviewError
                        ? "border-[#f1b7af] bg-[#fff3f1] text-[#a83a2c]"
                        : "border-[#a8dfb7] bg-[#effaf2] text-[#267340]"
                    }`}
                    role={reviewError ? "alert" : "status"}
                  >
                    {reviewError || reviewMessage}
                  </p>
                )}
              </section>
            ) : (
              <section className="rounded-[10px] border border-dashed border-[#cbd8e7] bg-white px-5 py-8 text-center text-[14px] text-[#778593]">
                No incoming reports or reserved jobs are available.
              </section>
            )}
          </div>

          <footer className="mt-6 border-t border-[#c9d4de] pt-3 text-[12px] text-[#8a9299] max-[1024px]:hidden">
            Guard-All Electronic Security Systems, Inc.
          </footer>
        </div>
      </section>
      {isFullDetailsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/65 p-4 max-[620px]:items-end max-[620px]:p-0"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsFullDetailsOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="full-report-title"
            className="flex max-h-[92vh] w-full max-w-[1000px] flex-col overflow-hidden rounded-[10px] bg-white text-[#174276] shadow-[0_20px_60px_rgb(7_20_38_/_35%)] max-[620px]:max-h-[95vh] max-[620px]:rounded-b-none max-[620px]:rounded-t-[12px]"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#e1e6eb] px-6 py-5 max-[620px]:px-4">
              <div>
                <p className="m-0 text-[11px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
                  {selectedReport.id} · {selectedReport.status}
                </p>
                <h2
                  id="full-report-title"
                  className="m-0 mt-1 text-[22px] font-bold"
                >
                  {selectedReport.client}
                </h2>
                <p className="m-0 mt-1 text-[12px] text-[#7d8994]">
                  {selectedReport.service} · {selectedReport.technician}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close full report details"
                onClick={() => setIsFullDetailsOpen(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] border border-[#dfe6ec] bg-white text-[23px] leading-none text-[#718090] hover:bg-[#f4f8ff]"
              >
                ×
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5 max-[620px]:space-y-5 max-[620px]:px-4">
              <section>
                <h3 className="m-0 text-[12px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
                  Work Summary
                </h3>
                <p className="m-0 mt-2 text-[13px] leading-relaxed text-[#52677c]">
                  {selectedReportDetails.workSummary}
                </p>
              </section>

              <section>
                <h3 className="m-0 text-[12px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
                  {selectedReportDetails.isPendingReport ? "Reserved Parts" : "Parts Used"}
                </h3>
                <div className="mt-2 overflow-x-auto rounded-[7px] border border-[#dfe6ec]">
                  <table className="w-full min-w-[560px] border-collapse text-left text-[12px]">
                    <thead className="bg-[#f3f7fd] text-[#68798a]">
                      <tr>
                        <th className="px-3 py-2 font-bold">Item</th>
                        <th className="px-3 py-2 font-bold">Description</th>
                        <th className="px-3 py-2 font-bold">Qty</th>
                        <th className="px-3 py-2 font-bold">Usage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReportDetails.parts.map((part) => (
                        <tr
                          className="border-t border-[#e8edf2]"
                          key={part.sku}
                        >
                          <td className="px-3 py-2 font-bold text-[#35649a]">
                            {part.sku}
                          </td>
                          <td className="px-3 py-2 text-[#52677c]">
                            {part.description}
                          </td>
                          <td className="px-3 py-2 text-[#52677c]">
                            {part.quantity}
                          </td>
                          <td className="px-3 py-2 text-[#52677c]">
                            {part.note}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h3 className="m-0 text-[12px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
                  Attached Images
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
                  {selectedReportDetails.images.map((image) => (
                    <figure
                      className="m-0 overflow-hidden rounded-[7px] border border-[#dfe6ec] bg-[#f3f7fd]"
                      key={image.name}
                    >
                      <img
                        className="h-[190px] w-full object-cover"
                        src={image.src}
                        alt={image.alt}
                        loading="lazy"
                      />
                      <figcaption className="px-3 py-2 text-[11px] text-[#68798a]">
                        {image.name} · Sample preview
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </section>

              <div className="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1">
                <section className="rounded-[7px] border border-[#9ed6a8] bg-[#effbef] p-4">
                  <h3 className="m-0 text-[12px] font-bold uppercase tracking-[.08em] text-[#5b9764]">
                    Client Sign-off
                  </h3>
                  <p className="m-0 mt-3 text-[13px] font-bold text-[#39734b]">
                    {selectedReportDetails.signature.signer}
                  </p>
                  <p className="m-0 mt-1 text-[12px] text-[#5b9764]">
                    {selectedReportDetails.signature.method}
                  </p>
                  <p className="m-0 mt-2 text-[12px] text-[#5b9764]">
                    {selectedReportDetails.signature.signedAt}
                  </p>
                </section>

                <section className="rounded-[7px] border border-[#bac8db] bg-[#f3f7fd] p-4">
                  <h3 className="m-0 text-[12px] font-bold uppercase tracking-[.08em] text-[#68798a]">
                    Billing Readiness
                  </h3>
                  <p className="m-0 mt-3 text-[13px] font-bold text-[#35649a]">
                    {selectedReportDetails.billing.readiness}
                  </p>
                  <p className="m-0 mt-2 text-[12px] text-[#68798a]">
                    Inventory: {selectedReportDetails.billing.inventory}
                  </p>
                  <p className="m-0 mt-1 text-[12px] text-[#68798a]">
                    Billing reference: {selectedReportDetails.billing.reference}
                  </p>
                </section>
              </div>

              <section>
                <h3 className="m-0 text-[12px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
                  Billing / Audit History
                </h3>
                <ol className="m-0 mt-2 divide-y divide-[#e8edf2] rounded-[7px] border border-[#dfe6ec] p-0">
                  {selectedReportDetails.audit.map((entry) => (
                    <li
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5 text-[12px]"
                      key={`${entry.time}-${entry.action}`}
                    >
                      <span className="font-bold text-[#35649a]">
                        {entry.action}
                      </span>
                      <span className="text-[#68798a]">
                        {entry.actor} · {entry.time}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <footer className="flex shrink-0 justify-end border-t border-[#e1e6eb] bg-[#f8fbff] px-6 py-4 max-[620px]:px-4">
              <button
                type="button"
                onClick={() => setIsFullDetailsOpen(false)}
                className="rounded-[6px] bg-[#1250a0] px-5 py-2.5 text-[12px] font-bold text-white hover:bg-[#0d438a]"
              >
                Close details
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}

export default ReportsOverview;
