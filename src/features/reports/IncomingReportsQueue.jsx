import { useState } from "react";
import ReportStatusPill from "./ReportStatusPill.jsx";
import { queueFilters } from "./reportsQueue.js";

// Left-hand queue: filter menu, job grouping headers, and one row per report.
// Selection and filter state stay in the page.
export default function IncomingReportsQueue({
  reports,
  openCount,
  filteredQueue,
  queueRows,
  queueFilter,
  queueFilterLabel,
  isFilterOpen,
  filterRef,
  selectedReportId,
  onToggleFilter,
  onApplyFilter,
  onSelectReport,
}) {
  const [isQueueOpen, setIsQueueOpen] = useState(true);

  return (
    <section className="overflow-hidden rounded-[10px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_12%)]">
      <header className="flex items-start justify-between border-b border-[#e1e6eb] px-5 py-4">
        <div>
          <h2 className="m-0 text-[15px] font-bold text-[#68798a]">
            Incoming Reports
          </h2>
          <p className="m-0 mt-1 text-[12px] text-[#8b949c]">
            {reports.length
              ? queueFilter === "all"
                ? `${openCount} item${openCount === 1 ? "" : "s"} in the open queue`
                : `${filteredQueue.length} of ${reports.length} · ${queueFilterLabel}`
              : "No reports or reserved jobs in current queue"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-expanded={isQueueOpen}
            aria-controls="incoming-reports-list"
            aria-label={isQueueOpen ? "Collapse incoming reports" : "Expand incoming reports"}
            onClick={() => setIsQueueOpen((isOpen) => !isOpen)}
            className="grid h-8 w-8 place-items-center border-0 bg-transparent text-[#7b8792] hover:text-[#174f9a]"
          >
            <span className="material-symbols-outlined text-[21px]">
              {isQueueOpen ? "expand_less" : "expand_more"}
            </span>
          </button>
          <div className="relative" ref={filterRef}>
          <button
            className={`border-0 bg-transparent p-0 ${
              queueFilter === "all" ? "text-[#7b8792]" : "text-[#174f9a]"
            }`}
            type="button"
            aria-expanded={isFilterOpen}
            aria-haspopup="true"
            title={`Filter the queue (${queueFilterLabel})`}
            onClick={onToggleFilter}
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
                  onClick={() => onApplyFilter(option.value)}
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
        </div>
      </header>
      {isQueueOpen && (
        <div id="incoming-reports-list" className="max-h-[640px] overflow-y-auto">
        {reports.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-[#7d8994]">
            No reports or reserved jobs are waiting in the queue.
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-[#7d8994]">
            <p className="m-0">
              Nothing matches the <strong>{queueFilterLabel}</strong> filter.
            </p>
            <button
              type="button"
              onClick={() => onApplyFilter("all")}
              className="mt-2 border-0 bg-transparent text-[12px] font-bold text-[#174f9a] hover:underline"
            >
              Show all items
            </button>
          </div>
        ) : (
          queueRows.map((row) =>
            row.type === "header" ? (
              <div
                key={row.key}
                className="flex items-center justify-between gap-2 border-b border-[#e1e6eb] bg-[#f4f8ff] px-5 py-2 text-[10px] font-bold uppercase tracking-[.06em] text-[#607286]"
              >
                <span className="truncate">
                  {row.jobNumber} · technician reports
                </span>
                <span className="shrink-0 text-[#174f9a]">
                  {row.reported} of {row.assigned} reported
                </span>
              </div>
            ) : (
              <button
                className={`block w-full border-b border-[#e1e6eb] px-5 py-4 text-left last:border-b-0 transition-colors hover:bg-[#f4f8ff] ${row.report.id === selectedReportId ? "border-l-4 border-l-[#286fc7] bg-[#eef4ff]" : ""}`}
                key={row.key}
                type="button"
                onClick={() => onSelectReport(row.report.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-[11px] font-bold text-[#35649a]">
                    {row.report.id}
                  </strong>
                  <ReportStatusPill tone={row.report.tone}>
                    {row.report.status}
                  </ReportStatusPill>
                </div>
                <h3 className="m-0 mt-3 truncate text-[15px] font-bold text-[#174276]">
                  {row.report.client}
                </h3>
                <p className="m-0 mt-1 truncate text-[12px] text-[#7d8994]">
                  {row.report.service}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-[#8b949c]">
                  <span className="min-w-0 truncate">
                    {row.report.technician}
                  </span>
                  <span className="shrink-0">{row.report.time}</span>
                </div>
              </button>
            ),
          )
        )}
        </div>
      )}
    </section>
  );
}
