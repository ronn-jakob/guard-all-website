// Four queue counters above the review workspace. Figures are derived from the
// full report list, never the filtered one, so the totals stay stable.
export default function ReportStatsCards({ reports }) {
  return (
    <div className="mb-4 grid grid-cols-4 gap-4 max-[850px]:grid-cols-2 max-[620px]:gap-2">
      {[
        [
          "Needs Review",
          String(
            reports.filter((report) => report.status === "Needs Review").length,
          ),
          "text-[#e34f2d]",
        ],
        [
          "Submitted",
          String(
            reports.filter((report) => report.status === "Submitted").length,
          ),
          "text-[#15519c]",
        ],
        [
          "Ready for Billing",
          String(
            reports.filter((report) => report.status === "Ready for Billing")
              .length,
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
          <strong className={`mt-2 block text-[29px] leading-none ${color}`}>
            {value}
          </strong>
        </article>
      ))}
    </div>
  );
}
