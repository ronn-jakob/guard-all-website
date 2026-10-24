import { formatPeso } from "./billingFormatters.js";

// Invoiced / collected / outstanding for the selected period.
export default function BillingMetricCards({ summary }) {
  const metricCards = [
    {
      icon: "receipt_long",
      title: "Invoiced",
      value: formatPeso(summary.invoiced),
      note: `${summary.count} ${summary.count === 1 ? "invoice" : "invoices"} issued`,
      alert: false,
    },
    {
      icon: "check_circle",
      title: "Collected",
      value: formatPeso(summary.collected),
      note: "Payments received",
      alert: false,
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
      {metricCards.map(({ icon, title, value, note, alert }) => (
        <article
          className={`relative min-h-[156px] rounded-[11px] border bg-white p-7 shadow-[0_3px_8px_rgb(31_59_82_/_14%)] max-[1024px]:min-h-[112px] max-[1024px]:p-4 max-[620px]:min-h-[58px] max-[620px]:rounded-[6px] max-[620px]:p-2 ${
            alert ? "border-[#ff725f]" : "border-[#dfe6ec]"
          }`}
          key={title}
        >
          <div
            className={`grid h-9 w-9 place-items-center rounded-[6px] max-[1024px]:h-7 max-[1024px]:w-7 max-[620px]:hidden ${
              alert
                ? "bg-[#ffd5cc] text-[#ff725f]"
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
        </article>
      ))}
    </section>
  );
}
