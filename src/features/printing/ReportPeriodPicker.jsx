import { currentPeriodValue } from "../../lib/reportPeriods.js";

const modes = [
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
  { id: "year", label: "Yearly" },
];

const controlClass =
  "h-8 rounded-[6px] border border-[#d9dfe4] bg-white px-3 text-[11px] font-semibold text-[#174f9a] outline-none focus:border-[#1250a0]";

// Week / Month / Year switch, period stepper, and the print trigger. Screen
// only — the whole toolbar is hidden when printing.
export default function ReportPeriodPicker({ period, onSelect, onPrint }) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, index) => String(currentYear - index));
  if (period.mode === "year" && !years.includes(period.value)) {
    years.unshift(period.value);
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <div className="flex rounded-full border border-[#dfe4e8] bg-[#f8fafc] p-1 text-[10px]">
        {modes.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id, currentPeriodValue(option.id))}
            className={`rounded-full px-3 py-1 ${
              period.mode === option.id
                ? "bg-white font-bold text-[#174f9a] shadow-sm"
                : "text-[#87929d]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous period"
          onClick={() => onSelect(period.mode, period.previous)}
          className="grid h-8 w-8 place-items-center rounded-[6px] border border-[#dfe4e8] bg-white text-[#5e6b78] hover:bg-[#f4f6f8]"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>

        {period.mode === "week" && (
          <span className="min-w-[190px] text-center text-[11px] font-semibold text-[#174f9a]">
            {period.label}
          </span>
        )}
        {period.mode === "month" && (
          <input
            type="month"
            value={period.value}
            onChange={(event) => {
              if (event.target.value) onSelect("month", event.target.value);
            }}
            aria-label="Report month"
            className={controlClass}
          />
        )}
        {period.mode === "year" && (
          <select
            value={period.value}
            onChange={(event) => onSelect("year", event.target.value)}
            aria-label="Report year"
            className={controlClass}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          aria-label="Next period"
          onClick={() => onSelect(period.mode, period.next)}
          className="grid h-8 w-8 place-items-center rounded-[6px] border border-[#dfe4e8] bg-white text-[#5e6b78] hover:bg-[#f4f6f8]"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      </div>

      <button
        type="button"
        onClick={onPrint}
        className="ml-auto flex h-8 items-center gap-1.5 rounded-[6px] bg-[#1250a0] px-3 text-[11px] font-bold text-white hover:bg-[#0f4387]"
      >
        <span className="material-symbols-outlined text-[16px]">print</span>
        Print / Save as PDF
      </button>
    </div>
  );
}
