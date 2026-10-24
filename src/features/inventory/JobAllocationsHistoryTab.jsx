import {
  formatAllocationDate,
  formatPartsSummary,
} from "../../lib/allocationHistory.js";
import {
  allocationOutcomeFilters,
  allocationOutcomeStyles,
} from "./inventoryUtils.js";

export default function JobAllocationsHistoryTab({
  visibleAllocations,
  jobAllocationsHistory,
  allocationSearch,
  onAllocationSearchChange,
  allocationOutcome,
  onAllocationOutcomeChange,
  isLoading,
  error,
  expandedAllocationId,
  onToggleExpanded,
}) {
  return (
    <div className="p-7">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="m-0 text-[10px] font-bold uppercase tracking-[.12em] text-[#777e85]">
            WORK ORDER ALLOCATIONS
          </p>
          <h2 className="m-0 mt-1 text-[21px] font-bold text-[#063b7c]">
            Job Allocations History
          </h2>
          <p className="m-0 mt-1 text-[11px] text-[#8b949c]">
            One row per work order. Expand it to see each part that was
            reserved, used, or returned.
          </p>
        </div>
        <span className="rounded-full border border-[#d7dadd] bg-[#fafafa] px-3 py-1 text-[11px] font-bold text-[#70777d]">
          {visibleAllocations.length} of {jobAllocationsHistory.length} work orders
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={allocationSearch}
          onChange={(event) => onAllocationSearchChange(event.target.value)}
          placeholder="Search work order, client, or part"
          className="h-8 w-64 rounded-[6px] border border-[#d9dfe4] bg-white px-3 text-[11px] text-[#174f9a] outline-none focus:border-[#1250a0] max-[620px]:w-full"
        />
        <div className="flex rounded-full border border-[#dfe4e8] bg-[#f8fafc] p-1 text-[10px]">
          {allocationOutcomeFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => onAllocationOutcomeChange(filter)}
              className={`rounded-full px-3 py-1 ${
                allocationOutcome === filter
                  ? "bg-white font-bold text-[#174f9a] shadow-sm"
                  : "text-[#87929d]"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-[8px] border border-[#dfe6ec]">
        <div className="grid grid-cols-[1.3fr_1.2fr_1.7fr_1fr_1fr_32px] bg-[#fafafa] px-6 py-3 text-[10px] font-bold uppercase text-[#77818a] max-[850px]:grid-cols-[1.4fr_1.2fr_1.8fr_1fr_32px] max-[850px]:[&>span:nth-child(5)]:hidden max-[620px]:grid-cols-[1.4fr_1.6fr_1fr_32px] max-[620px]:[&>span:nth-child(2)]:hidden max-[620px]:px-3">
          <span>Work order</span>
          <span>Client / date</span>
          <span>Parts</span>
          <span>Outcome</span>
          <span>Last activity</span>
          <span />
        </div>

        {isLoading ? (
          <p className="m-0 px-6 py-8 text-center text-[12px] text-[#8e959b]">
            Loading allocation history...
          </p>
        ) : error ? (
          <p className="m-0 px-6 py-8 text-center text-[12px] text-[#a83a2c]" role="alert">
            {error}
          </p>
        ) : jobAllocationsHistory.length === 0 ? (
          <p className="m-0 px-6 py-8 text-center text-[12px] text-[#8e959b]">
            No stock reservations have been recorded.
          </p>
        ) : visibleAllocations.length === 0 ? (
          <p className="m-0 px-6 py-8 text-center text-[12px] text-[#8e959b]">
            No work orders match this search.
          </p>
        ) : (
          visibleAllocations.map((job) => {
            const isExpanded = expandedAllocationId === job.jobId;
            return (
              <div key={job.jobId} className="border-t border-[#e4e8eb]">
                <button
                  type="button"
                  onClick={() =>
                    onToggleExpanded(isExpanded ? "" : job.jobId)
                  }
                  className="grid w-full grid-cols-[1.3fr_1.2fr_1.7fr_1fr_1fr_32px] items-center px-6 py-4 text-left transition-colors hover:bg-[#f8fbff] max-[850px]:grid-cols-[1.4fr_1.2fr_1.8fr_1fr_32px] max-[850px]:[&>*:nth-child(5)]:hidden max-[620px]:grid-cols-[1.4fr_1.6fr_1fr_32px] max-[620px]:[&>*:nth-child(2)]:hidden max-[620px]:px-3"
                >
                  <div className="min-w-0">
                    <strong className="block truncate text-[12px] text-[#063b7c]">
                      {job.jobNumber}
                    </strong>
                    <span className="block truncate text-[10px] text-[#8d969e]">
                      {job.technicianNames?.join(", ") || "Unassigned"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <strong className="block truncate text-[11px] text-[#3a434d]">
                      {job.clientName}
                    </strong>
                    <span className="block text-[10px] text-[#8d969e]">
                      {formatAllocationDate(job.scheduledDate)}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#3a434d]">
                    {formatPartsSummary(job.summary)}
                  </span>
                  <span
                    className={`w-max rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                      allocationOutcomeStyles[job.outcome] ??
                      allocationOutcomeStyles["In progress"]
                    }`}
                  >
                    {job.outcome}
                  </span>
                  <span className="text-[10px] text-[#8d969e]">
                    {formatAllocationDate(job.lastActivityAt)}
                  </span>
                  <span className="material-symbols-outlined text-[18px] text-[#8b949c]">
                    {isExpanded ? "expand_less" : "expand_more"}
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-dashed border-[#e4e8eb] bg-[#fbfdff] px-6 py-3 max-[620px]:px-3">
                    <div className="grid grid-cols-[2fr_.7fr_.7fr_.8fr_1fr_1fr_1fr] items-center gap-2 pb-2 text-[9px] font-bold uppercase tracking-[.06em] text-[#8b949c] max-[850px]:grid-cols-[2fr_.8fr_.8fr_1fr_1fr] max-[850px]:[&>span:nth-child(3)]:hidden max-[620px]:grid-cols-[2fr_.8fr_.8fr_1fr] max-[620px]:[&>span:nth-child(6)]:hidden">
                      <span>Item</span>
                      <span>Reserved</span>
                      <span>Used</span>
                      <span>Returned</span>
                      <span>Status</span>
                      <span>Report</span>
                      <span>Last update</span>
                    </div>
                    {job.lines.map((line) => (
                      <div
                        key={line.jobPartId}
                        className="grid grid-cols-[2fr_.7fr_.7fr_.8fr_1fr_1fr_1fr] items-center gap-2 border-t border-[#eef2f5] py-2 text-[11px] max-[850px]:grid-cols-[2fr_.8fr_.8fr_1fr_1fr] max-[850px]:[&>*:nth-child(3)]:hidden max-[620px]:grid-cols-[2fr_.8fr_.8fr_1fr] max-[620px]:[&>*:nth-child(6)]:hidden"
                      >
                        <div className="min-w-0">
                          <strong className="block truncate text-[#174f9a]">
                            {line.name}
                          </strong>
                          <span className="block text-[10px] text-[#8d969e]">
                            {line.sku}
                            {line.unitOfMeasure ? ` · ${line.unitOfMeasure}` : ""}
                          </span>
                        </div>
                        <span className="text-[#3a434d]">
                          {line.reservedQuantity}
                        </span>
                        <span className="text-[#3a434d]">
                          {line.usedQuantity}
                        </span>
                        <span className="text-[#3a434d]">
                          {line.returnedQuantity}
                        </span>
                        <span className="capitalize text-[#607286]">
                          {line.status}
                        </span>
                        <span className="truncate text-[#607286]">
                          {line.reportNumbers?.length
                            ? line.reportNumbers.join(", ")
                            : "—"}
                        </span>
                        <span className="text-[10px] text-[#8d969e]">
                          {formatAllocationDate(
                            line.updatedAt ?? line.reservedAt,
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
