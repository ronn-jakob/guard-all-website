import ReportStatusPill from "./ReportStatusPill.jsx";

// Reviewer pane for the report selected in the queue: summary, parts, media,
// sign-off, billing readiness, and the approve/return actions.
export default function ReportReviewDetail({
  report,
  isReviewing,
  reviewError,
  reviewMessage,
  onShowAllParts,
  onOpenImage,
  onReview,
}) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_12%)]">
      <header className="flex items-start justify-between border-b border-[#e1e6eb] px-6 py-5 max-[620px]:px-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-[12px] font-bold text-[#35649a]">
              {report.id}
            </strong>
            <ReportStatusPill tone={report.tone}>
              {report.status}
            </ReportStatusPill>
          </div>
          <h2 className="m-0 mt-2 text-[17px] font-bold text-[#174276]">
            {report.client}
          </h2>
          <p className="m-0 mt-1 text-[11px] text-[#8b949c]">
            {report.service} &nbsp;•&nbsp;{" "}
            {report.isPendingReport ? "Stock reserved" : "Submitted"}{" "}
            {report.time}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[#707b86]">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#d65c58] text-[11px] font-bold text-white">
            {report.technician
              .split(" ")
              .map((name) => name[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() || "T"}
          </span>
          {report.technician}
        </div>
      </header>

      <div className="grid grid-cols-[1.25fr_1fr] gap-6 px-6 py-5 max-[620px]:grid-cols-1 max-[620px]:px-4">
        <div>
          <p className="m-0 text-[11px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
            01 / Work Summary
          </p>
          <h3 className="m-0 mt-3 text-[15px] font-bold text-[#174276]">
            {report.service}
          </h3>
          <p className="m-0 mt-2 text-[12px] leading-relaxed text-[#7d8994]">
            {report.workSummary}
          </p>
          <div className="my-4 border-t border-[#e1e6eb]" />
          <p className="m-0 text-[11px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
            02 / {report.isPendingReport ? "Reserved Parts" : "Parts Used"}
          </p>
          <div className="mt-3 rounded-[7px] border border-[#bac8db] bg-[#eef4ff] px-4 py-3 text-[12px] text-[#35649a]">
            {report.parts.length === 0 ? (
              <div className="text-[#68798a]">
                No parts were recorded for this report.
              </div>
            ) : (
              <>
                {report.parts.slice(0, 3).map((part) => (
                  <div
                    className="flex items-center justify-between gap-3 py-1.5 font-bold"
                    key={part.sku}
                  >
                    <span>
                      {part.quantity} x {part.sku}
                    </span>
                    <span className="font-normal text-[#8b949c]">
                      {part.note}
                    </span>
                  </div>
                ))}
                {report.parts.length > 3 && (
                  <button
                    type="button"
                    onClick={onShowAllParts}
                    className="mt-3 w-full border-t border-[#cbd8e7] bg-transparent pt-3 text-center text-[#68798a] hover:text-[#174f9a]"
                  >
                    Show More
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-[7px] border border-[#bac8db] bg-[#f3f7fd] p-4">
            <p className="m-0 text-[11px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
              Attached Images
            </p>
            {report.images.length === 0 ? (
              <div className="mt-3 text-[12px] text-[#8b949c]">
                No images attached.
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-[#8b949c]">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">
                    image
                  </span>
                  <span className="truncate">
                    {report.images[0].name}
                    {report.images.length > 1
                      ? ` · ${report.images.length} images`
                      : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={onOpenImage}
                  className="shrink-0 rounded-[5px] border border-[#c9d4de] bg-white px-2.5 py-1 text-[11px] font-bold text-[#174f9a] hover:border-[#1250a0] hover:bg-[#f3f8ff]"
                >
                  Open
                </button>
              </div>
            )}
          </div>
          <div className="rounded-[7px] border border-[#9ed6a8] bg-[#effbef] p-4 text-[12px] text-[#5b9764]">
            <div className="flex items-center justify-between font-bold">
              <span>✓ &nbsp; Client Sign-off</span>
              <span className="font-normal">
                {report.signature?.signedAt || "Pending"}
              </span>
            </div>
            <div className="mt-3 flex justify-between text-[11px]">
              <span>
                {report.signature?.signer || "Client Name"} ·{" "}
                {report.signature?.method || "Awaiting sign-off"}
              </span>
              <span>{report.time}</span>
            </div>
          </div>
          <div className="rounded-[7px] border border-[#bac8db] bg-[#eef4ff] p-4 text-[12px] text-[#5b9764]">
            <p className="m-0 font-bold uppercase tracking-[.08em] text-[#7d8994]">
              Billing Readiness
            </p>
            <p className="m-0 mt-4 font-bold">
              ✓ &nbsp; {report.billing?.inventory || "Pending"}
            </p>
            <p className="m-0 mt-3 font-bold">
              ✓ &nbsp; {report.billing?.readiness || "Awaiting review"}
            </p>
          </div>
        </div>
      </div>

      <footer className="flex items-center justify-between border-t border-[#e1e6eb] bg-[#eef4ff] px-6 py-4 max-[620px]:flex-col max-[620px]:items-stretch max-[620px]:gap-3 max-[620px]:px-4">
        <a
          className="text-[13px] font-bold text-[#7a8793] no-underline hover:text-[#174f9a]"
          href="#details"
          onClick={(event) => {
            event.preventDefault();
            onShowAllParts();
          }}
        >
          Show Full Details
        </a>
        {report.invoice ? (
          <p className="m-0 text-[12px] font-semibold text-[#68798a]">
            Billed as{" "}
            <strong className="text-[#35649a]">{report.invoice.number}</strong>{" "}
            ·{" "}
            {report.invoice.status === "paid"
              ? "Paid"
              : report.invoice.status === "overdue"
                ? "Overdue"
                : "Awaiting payment"}
          </p>
        ) : report.isPendingReport ? (
          <p className="m-0 text-[12px] font-semibold text-[#68798a]">
            Awaiting technician field report
          </p>
        ) : (
          <div className="flex gap-3 max-[620px]:flex-1">
            <button
              className="inline-flex h-10 flex-1 items-center justify-center rounded-[7px] border-2 border-[#c5ccd6] bg-transparent px-4 text-[12px] font-bold text-[#89939e] disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={isReviewing || report.reviewStatus === "returned"}
              onClick={() => onReview("return")}
            >
              {report.reviewStatus === "returned"
                ? "Returned"
                : "Return for Correction"}
            </button>
            <button
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-[7px] bg-[#1953a5] px-4 text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={isReviewing || report.reviewStatus === "approved"}
              onClick={() => onReview("approve")}
            >
              <span className="material-symbols-outlined text-[17px]">
                send
              </span>
              {isReviewing
                ? "Saving..."
                : report.reviewStatus === "approved"
                  ? "Approved for Billing"
                  : "Approve for Billing"}
            </button>
          </div>
        )}
      </footer>
      {(reviewError || reviewMessage) && (
        <p
          className={`m-0 border-t px-6 py-3 text-[12px] font-semibold max-[620px]:px-4 ${
            reviewError
              ? "border-[#f1b7af] bg-[#fff3f1] text-[#a83a2c]"
              : "border-[#a8dfb7] bg-[#effaf2] text-[#267340]"
          }`}
          role={reviewError ? "alert" : "status"}
        >
          {reviewError || reviewMessage}
        </p>
      )}
    </section>
  );
}
