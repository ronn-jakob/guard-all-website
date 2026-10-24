import { input } from "./reportStyles.js";

export default function ReportEditDialog({
  editReport,
  setEditReport,
  editValues,
  updateEditValue,
  handleResubmit,
  isResubmitting,
  resubmitError,
}) {
  return (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/65 p-4 max-[620px]:items-end max-[620px]:p-0"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) setEditReport(null);
    }}
  >
    <section
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${editReport.id}`}
      className="flex max-h-[92vh] w-full max-w-[680px] flex-col overflow-hidden rounded-[10px] bg-white text-[#174276] shadow-[0_20px_60px_rgb(7_20_38_/_35%)] max-[620px]:max-h-[95vh] max-[620px]:rounded-b-none max-[620px]:rounded-t-[12px]"
    >
      <header className="shrink-0 border-b border-[#e1e6eb] px-6 py-5 max-[620px]:px-4">
        <p className="m-0 text-[11px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
          {editReport.id} · returned for correction
        </p>
        <h2 className="m-0 mt-1 text-[20px] font-bold">
          Correct and resubmit
        </h2>
        <p className="m-0 mt-1 text-[12px] text-[#7d8994]">
          {editReport.client} · {editReport.service}
        </p>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5 max-[620px]:px-4">
        <div className="grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
          <label className="flex flex-col text-[12px] font-semibold text-[#45515c]">
            Service date
            <input
              type="date"
              className={input}
              value={editValues.serviceDate}
              onChange={(event) =>
                updateEditValue("serviceDate", event.target.value)
              }
            />
          </label>
          <label className="flex flex-col text-[12px] font-semibold text-[#45515c]">
            Arrival time
            <input
              type="time"
              className={input}
              value={editValues.arrivalTime}
              onChange={(event) =>
                updateEditValue("arrivalTime", event.target.value)
              }
            />
          </label>
        </div>

        <label className="flex flex-col text-[12px] font-semibold text-[#45515c]">
          Work performed
          <textarea
            rows={3}
            className={`${input} h-auto py-2`}
            value={editValues.workPerformed}
            onChange={(event) =>
              updateEditValue("workPerformed", event.target.value)
            }
          />
        </label>

        <label className="flex flex-col text-[12px] font-semibold text-[#45515c]">
          Issue found
          <textarea
            rows={2}
            className={`${input} h-auto py-2`}
            value={editValues.issueDescription}
            onChange={(event) =>
              updateEditValue("issueDescription", event.target.value)
            }
          />
        </label>

        <label className="flex flex-col text-[12px] font-semibold text-[#45515c]">
          Recommendations
          <textarea
            rows={2}
            className={`${input} h-auto py-2`}
            value={editValues.recommendations}
            onChange={(event) =>
              updateEditValue("recommendations", event.target.value)
            }
          />
        </label>

        <label className="flex flex-col text-[12px] font-semibold text-[#45515c]">
          Additional notes
          <textarea
            rows={2}
            className={`${input} h-auto py-2`}
            value={editValues.additionalNotes}
            onChange={(event) =>
              updateEditValue("additionalNotes", event.target.value)
            }
          />
        </label>

        <label className="flex flex-col text-[12px] font-semibold text-[#45515c]">
          Site address
          <input
            className={input}
            value={editValues.siteAddress}
            onChange={(event) =>
              updateEditValue("siteAddress", event.target.value)
            }
          />
        </label>

        <label className="flex items-center gap-2 text-[12px] font-semibold text-[#45515c]">
          <input
            type="checkbox"
            checked={editValues.clientSignoff}
            onChange={(event) =>
              updateEditValue("clientSignoff", event.target.checked)
            }
            className="h-4 w-4 rounded border-gray-300 text-[#1250a0] focus:ring-[#1250a0]"
          />
          Client signed off
        </label>

        {editValues.clientSignoff && (
          <label className="flex flex-col text-[12px] font-semibold text-[#45515c]">
            Signed by
            <input
              className={input}
              value={editValues.clientSignoffName}
              onChange={(event) =>
                updateEditValue("clientSignoffName", event.target.value)
              }
            />
          </label>
        )}

        <p className="m-0 rounded-[6px] border border-[#e1e6eb] bg-[#f8fbff] px-3 py-2 text-[11px] text-[#607286]">
          Parts and stock usage stay exactly as first recorded. Correct the
          narrative, then resubmit for review.
        </p>

        {resubmitError && (
          <p
            className="m-0 rounded-[6px] border border-[#f0b8b0] bg-[#fff1ee] px-3 py-2 text-[12px] text-[#b64132]"
            role="alert"
          >
            {resubmitError}
          </p>
        )}
      </div>

      <footer className="flex shrink-0 justify-end gap-2 border-t border-[#e1e6eb] bg-[#f8fbff] px-6 py-4 max-[620px]:px-4">
        <button
          type="button"
          onClick={() => setEditReport(null)}
          className="rounded-[6px] border border-[#dfe6ec] bg-white px-5 py-2.5 text-[12px] font-bold text-[#5e6b78] hover:bg-[#f2f7ff]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleResubmit}
          disabled={isResubmitting}
          className="rounded-[6px] bg-[#1250a0] px-5 py-2.5 text-[12px] font-bold text-white hover:bg-[#0d438a] disabled:opacity-50"
        >
          {isResubmitting ? "Resubmitting..." : "Resubmit for review"}
        </button>
      </footer>
    </section>
  </div>
  );
}