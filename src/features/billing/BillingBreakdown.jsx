import { formatPeso } from "./billingFormatters.js";

// Monthly or yearly totals, one clickable row per period. Clicking a row filters
// the register through the page's onSelectPeriod handler.
export default function BillingBreakdown({
  breakdown,
  breakdownMode,
  periodMode,
  periodValue,
  onSelectPeriod,
}) {
  return (
    <section className="mt-5 overflow-hidden rounded-[11px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_14%)]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e1e6eb] px-7 py-4 max-[620px]:px-3">
        <div>
          <p className="m-0 text-[10px] font-bold uppercase tracking-[.12em] text-[#777e85]">
            {breakdownMode === "year" ? "YEARLY TOTALS" : "MONTHLY TOTALS"}
          </p>
          <h2 className="m-0 mt-1 text-[17px] font-bold text-[#063b7c] max-[620px]:text-[13px]">
            Billing breakdown
          </h2>
        </div>
        <span className="text-[10px] text-[#8b949c]">
          Click a period to filter the register
        </span>
      </header>
      <div className="grid grid-cols-[1.2fr_.7fr_1fr_1fr_1fr] items-center bg-[#fafafa] px-7 py-2.5 text-[10px] font-bold uppercase tracking-[.08em] text-[#77818a] max-[620px]:grid-cols-[1.1fr_1fr_1fr] max-[620px]:[&>span:nth-child(2)]:hidden max-[620px]:[&>span:nth-child(5)]:hidden max-[620px]:px-3">
        <span>Period</span>
        <span>Invoices</span>
        <span>Invoiced</span>
        <span>Collected</span>
        <span>Outstanding</span>
      </div>
      {breakdown.length === 0 ? (
        <p className="m-0 px-7 py-6 text-center text-[12px] text-[#8d969e]">
          No invoices have been issued yet.
        </p>
      ) : (
        breakdown.map((row) => {
          const isActive = periodMode !== "all" && periodValue === row.key;
          return (
            <button
              key={row.key}
              type="button"
              onClick={() => onSelectPeriod(row.key)}
              className={`grid w-full grid-cols-[1.2fr_.7fr_1fr_1fr_1fr] items-center border-t border-[#e4e8eb] px-7 py-2.5 text-left text-[11px] transition-colors hover:bg-[#f8fbff] max-[620px]:grid-cols-[1.1fr_1fr_1fr] max-[620px]:[&>*:nth-child(2)]:hidden max-[620px]:[&>*:nth-child(5)]:hidden max-[620px]:px-3 ${
                isActive ? "bg-[#eef4ff]" : ""
              }`}
            >
              <strong className="truncate text-[#174f9a]">{row.label}</strong>
              <span className="text-[#607286]">{row.count}</span>
              <span className="text-[#263747]">{formatPeso(row.invoiced)}</span>
              <span className="text-[#263747]">{formatPeso(row.collected)}</span>
              <span
                className={
                  row.outstanding > 0
                    ? "font-bold text-[#f05b48]"
                    : "text-[#263747]"
                }
              >
                {formatPeso(row.outstanding)}
              </span>
            </button>
          );
        })
      )}
    </section>
  );
}
