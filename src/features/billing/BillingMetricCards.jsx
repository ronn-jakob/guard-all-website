import { Link } from "react-router-dom";
import { formatPeso } from "./billingFormatters.js";

// Invoiced / awaiting invoice / outstanding. The waiting card counts approved
// field reports whose job has no invoice yet: a live queue, not a period total.
export default function BillingMetricCards({
  summary,
  waitingReports = 0,
  isLoadingWaiting = false,
  waitingError = "",
}) {
  const waitingNote = waitingError
    ? "Could not load the queue"
    : isLoadingWaiting
      ? "Loading approved reports"
      : waitingReports === 0
        ? "No approved reports waiting"
        : "Approved reports ready to bill";

  const metricCards = [
    {
      icon: "receipt_long",
      title: "Invoiced",
      value: formatPeso(summary.invoiced),
      note: `${summary.count} ${summary.count === 1 ? "invoice" : "invoices"} issued`,
      alert: false,
    },
    {
      icon: "pending_actions",
      title: "Awaiting invoice",
      value: isLoadingWaiting ? "—" : String(waitingReports),
      note: waitingNote,
      alert: false,
      accent: !waitingError && waitingReports > 0,
      to: "/billing/new",
    },
    {
      icon: "warning",
      title: "Outstanding",
      value: formatPeso(summary.outstanding),
      note: `${summary.openCount} ${summary.openCount === 1 ? "invoice" : "invoices"} awaiting payment`,
      alert: summary.outstanding > 0,
    },
  ];

  return (
    <section className="grid grid-cols-3 gap-[18px] max-[620px]:gap-1">
      {metricCards.map(({ icon, title, value, note, alert, accent, to }) => {
        const Wrapper = to ? Link : "article";
        return (
          <Wrapper
            {...(to ? { to, "aria-label": `${title}: ${value}` } : {})}
            className={`relative min-h-[156px] rounded-[11px] border bg-white p-7 shadow-[0_3px_8px_rgb(31_59_82_/_14%)] max-[1024px]:min-h-[112px] max-[1024px]:p-4 max-[620px]:min-h-[58px] max-[620px]:rounded-[6px] max-[620px]:p-2 ${
              alert ? "border-[#ff725f]" : "border-[#dfe6ec]"
            } ${
              to
                ? "block cursor-pointer text-inherit no-underline transition-colors hover:bg-[#f8fbff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1250a0]"
                : ""
            }`}
            key={title}
          >
            <div
              className={`grid h-9 w-9 place-items-center rounded-[6px] max-[1024px]:h-7 max-[1024px]:w-7 max-[620px]:hidden ${
                alert
                  ? "bg-[#ffd5cc] text-[#ff725f]"
                  : accent
                    ? "bg-[#1250a0] text-white"
                    : "bg-[#d6e6fb] text-[#1954a0]"
              }`}
            >
              <span className="material-symbols-outlined text-[21px]">
                {icon}
              </span>
            </div>
            <p className="mb-0 mt-5 text-[11px] font-bold uppercase tracking-[.07em] text-[#858b90] max-[1024px]:mt-3 max-[620px]:mt-0 max-[620px]:text-[7px] max-[620px]:tracking-normal">
              {title}
            </p>
            <strong className="mt-1 block text-[29px] font-extrabold leading-tight max-[1024px]:text-[23px] max-[620px]:text-[15px]">
              {value}
            </strong>
            <small className="text-[12px] text-[#8e959b] max-[1024px]:text-[9px] max-[620px]:hidden">
              {note}
            </small>
          </Wrapper>
        );
      })}
    </section>
  );
}
