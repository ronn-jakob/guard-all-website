import ReportField from "./ReportField.jsx";

export default function ReportDetailDialog({ openReport, setOpenReport, openReportEditor, canFilterByTechnician }) {
  return (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/65 p-4 max-[620px]:items-end max-[620px]:p-0"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) setOpenReport(null);
    }}
  >
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="submitted-report-title"
      className="flex max-h-[92vh] w-full max-w-[880px] flex-col overflow-hidden rounded-[10px] bg-white text-[#174276] shadow-[0_20px_60px_rgb(7_20_38_/_35%)] max-[620px]:max-h-[95vh] max-[620px]:rounded-b-none max-[620px]:rounded-t-[12px]"
    >
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#e1e6eb] px-6 py-5 max-[620px]:px-4">
        <div className="min-w-0">
          <p className="m-0 text-[11px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
            {openReport.id} · {openReport.status}
          </p>
          <h2
            id="submitted-report-title"
            className="m-0 mt-1 text-[22px] font-bold"
          >
            {openReport.client}
          </h2>
          <p className="m-0 mt-1 text-[12px] text-[#7d8994]">
            {openReport.service} · {openReport.technician}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close report details"
          onClick={() => setOpenReport(null)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] border border-[#dfe6ec] bg-white text-[23px] leading-none text-[#718090] hover:bg-[#f4f8ff]"
        >
          ×
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 max-[620px]:px-4">
        <section className="grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
          <ReportField
            fieldLabel="Service date"
            value={openReport.serviceDate}
          />
          <ReportField
            fieldLabel="Time on site"
            value={openReport.arrivalTime}
          />
          <ReportField fieldLabel="Submitted" value={openReport.time} />
          <ReportField
            fieldLabel="Billing readiness"
            value={openReport.billing?.readiness}
          />
          <ReportField
            fieldLabel="Site address"
            value={openReport.siteAddress}
          />
          <ReportField
            fieldLabel="Client sign-off"
            value={openReport.signature?.signer}
          />
        </section>

        <section>
          <h3 className="m-0 text-[12px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
            Work summary
          </h3>
          <p className="m-0 mt-2 text-[13px] leading-relaxed text-[#52677c]">
            {openReport.workSummary}
          </p>
        </section>

        {(openReport.issueDescription ||
          openReport.recommendations ||
          openReport.additionalNotes) && (
          <section className="space-y-3">
            {openReport.issueDescription && (
              <div>
                <h3 className="m-0 text-[12px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
                  Issue found
                </h3>
                <p className="m-0 mt-1 text-[13px] leading-relaxed text-[#52677c]">
                  {openReport.issueDescription}
                </p>
              </div>
            )}
            {openReport.recommendations && (
              <div>
                <h3 className="m-0 text-[12px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
                  Recommendations
                </h3>
                <p className="m-0 mt-1 text-[13px] leading-relaxed text-[#52677c]">
                  {openReport.recommendations}
                </p>
              </div>
            )}
            {openReport.additionalNotes && (
              <div>
                <h3 className="m-0 text-[12px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
                  Additional notes
                </h3>
                <p className="m-0 mt-1 text-[13px] leading-relaxed text-[#52677c]">
                  {openReport.additionalNotes}
                </p>
              </div>
            )}
          </section>
        )}

        <section>
          <h3 className="m-0 text-[12px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
            Parts used
          </h3>
          {openReport.parts.length === 0 ? (
            <p className="m-0 mt-2 text-[12px] text-[#8b949c]">
              No parts were recorded for this report.
            </p>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-[7px] border border-[#dfe6ec]">
              <table className="w-full min-w-[420px] border-collapse text-left text-[12px]">
                <thead className="bg-[#f3f7fd] text-[#68798a]">
                  <tr>
                    <th className="px-3 py-2 font-bold">Item</th>
                    <th className="px-3 py-2 font-bold">Description</th>
                    <th className="px-3 py-2 font-bold">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {openReport.parts.map((part, index) => (
                    <tr
                      className="border-t border-[#e8edf2]"
                      key={`${part.sku}-${index}`}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {openReport.images.length > 0 && (
          <section>
            <h3 className="m-0 text-[12px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
              Attached images
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
              {openReport.images.map((image, index) => (
                <figure
                  className="m-0 overflow-hidden rounded-[7px] border border-[#dfe6ec] bg-[#f3f7fd]"
                  key={`${image.name}-${index}`}
                >
                  {image.src ? (
                    <img
                      className="h-[190px] w-full object-cover"
                      src={image.src}
                      alt={image.alt}
                      loading="lazy"
                    />
                  ) : null}
                  <figcaption className="px-3 py-2 text-[11px] text-[#68798a]">
                    {image.name}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}
      </div>

      <footer className="flex shrink-0 justify-end gap-2 border-t border-[#e1e6eb] bg-[#f8fbff] px-6 py-4 max-[620px]:px-4">
        {openReport.reviewStatus === "returned" && !canFilterByTechnician && (
          <button
            type="button"
            onClick={() => openReportEditor(openReport)}
            className="rounded-[6px] border border-[#1250a0] bg-white px-5 py-2.5 text-[12px] font-bold text-[#1250a0] hover:bg-[#f2f7ff]"
          >
            Edit and resubmit
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpenReport(null)}
          className="rounded-[6px] bg-[#1250a0] px-5 py-2.5 text-[12px] font-bold text-white hover:bg-[#0d438a]"
        >
          Close
        </button>
      </footer>
    </section>
  </div>
  );
}