// Read-only full-details modal: parts table, attachments, sign-off, billing
// readiness, and audit trail for the selected report.
export default function ReportFullDetailsDialog({ report, onClose }) {
  if (!report) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/65 p-4 max-[620px]:items-end max-[620px]:p-0"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
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
              {report.id} · {report.status}
            </p>
            <h2
              id="full-report-title"
              className="m-0 mt-1 text-[22px] font-bold"
            >
              {report.client}
            </h2>
            <p className="m-0 mt-1 text-[12px] text-[#7d8994]">
              {report.service} · {report.technician}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close full report details"
            onClick={onClose}
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
              {report.workSummary}
            </p>
          </section>

          <section>
            <h3 className="m-0 text-[12px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
              {report.isPendingReport ? "Reserved Parts" : "Parts Used"}
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
                  {report.parts.map((part) => (
                    <tr className="border-t border-[#e8edf2]" key={part.sku}>
                      <td className="px-3 py-2 font-bold text-[#35649a]">
                        {part.sku}
                      </td>
                      <td className="px-3 py-2 text-[#52677c]">
                        {part.description}
                      </td>
                      <td className="px-3 py-2 text-[#52677c]">
                        {part.quantity}
                      </td>
                      <td className="px-3 py-2 text-[#52677c]">{part.note}</td>
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
              {report.images.map((image) => (
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
                {report.signature.signer}
              </p>
              <p className="m-0 mt-1 text-[12px] text-[#5b9764]">
                {report.signature.method}
              </p>
              <p className="m-0 mt-2 text-[12px] text-[#5b9764]">
                {report.signature.signedAt}
              </p>
            </section>

            <section className="rounded-[7px] border border-[#bac8db] bg-[#f3f7fd] p-4">
              <h3 className="m-0 text-[12px] font-bold uppercase tracking-[.08em] text-[#68798a]">
                Billing Readiness
              </h3>
              <p className="m-0 mt-3 text-[13px] font-bold text-[#35649a]">
                {report.billing.readiness}
              </p>
              <p className="m-0 mt-2 text-[12px] text-[#68798a]">
                Inventory: {report.billing.inventory}
              </p>
              <p className="m-0 mt-1 text-[12px] text-[#68798a]">
                Billing reference: {report.billing.reference}
              </p>
            </section>
          </div>

          <section>
            <h3 className="m-0 text-[12px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
              Billing / Audit History
            </h3>
            <ol className="m-0 mt-2 divide-y divide-[#e8edf2] rounded-[7px] border border-[#dfe6ec] p-0">
              {report.audit.map((entry) => (
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
            onClick={onClose}
            className="rounded-[6px] bg-[#1250a0] px-5 py-2.5 text-[12px] font-bold text-white hover:bg-[#0d438a]"
          >
            Close details
          </button>
        </footer>
      </section>
    </div>
  );
}
