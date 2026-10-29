import { Link } from "react-router-dom";
import { periodLabel } from "../../lib/billing.js";

const periodModes = [
  { id: "all", label: "All time" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
];

// All time / Month / Year toggle, the month or year picker it reveals, and the
// breakdown collapse control.
export default function BillingPeriodFilter({
  periodMode,
  periodMonth,
  periodYear,
  periodValue,
  availableYears,
  invoiceCount,
  isBreakdownOpen,
  onSelectMode,
  onChangeMonth,
  onChangeYear,
  onToggleBreakdown,
  printHref = "",
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="flex rounded-full border border-[#dfe4e8] bg-[#f8fafc] p-1 text-[10px]">
        {periodModes.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelectMode(option.id)}
            className={`rounded-full px-3 py-1 ${
              periodMode === option.id
                ? "bg-white font-bold text-[#174f9a] shadow-sm"
                : "text-[#87929d]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {periodMode === "month" && (
        <input
          type="month"
          value={periodMonth}
          onChange={(event) => {
            if (event.target.value) onChangeMonth(event.target.value);
          }}
          aria-label="Invoice month"
          className="h-8 rounded-[6px] border border-[#d9dfe4] bg-white px-3 text-[11px] text-[#174f9a] outline-none focus:border-[#1250a0]"
        />
      )}
      {periodMode === "year" && (
        <select
          value={periodYear}
          onChange={(event) => onChangeYear(event.target.value)}
          aria-label="Invoice year"
          className="h-8 rounded-[6px] border border-[#d9dfe4] bg-white px-3 text-[11px] text-[#174f9a] outline-none focus:border-[#1250a0]"
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      )}

      <span className="text-[11px] text-[#8b949c]">
        {periodMode === "all"
          ? "All invoices"
          : `Showing ${periodLabel(periodMode, periodValue)} · ${invoiceCount} ${
              invoiceCount === 1 ? "invoice" : "invoices"
            }`}
      </span>

      <button
        type="button"
        onClick={onToggleBreakdown}
        className="ml-auto rounded-[6px] border border-[#d9dfe4] bg-white px-3 py-1.5 text-[10px] font-bold text-[#5e6b78] hover:bg-[#f4f6f8]"
      >
        {isBreakdownOpen ? "Hide breakdown" : "Show breakdown"}
      </button>

      {printHref && (
        <Link
          to={printHref}
          className="flex items-center gap-1 rounded-[6px] border border-[#1250a0] bg-white px-3 py-1.5 text-[10px] font-bold text-[#1250a0] no-underline hover:bg-[#f3f8ff]"
        >
          <span className="material-symbols-outlined text-[14px]">print</span>
          Print report
        </Link>
      )}
    </div>
  );
}
