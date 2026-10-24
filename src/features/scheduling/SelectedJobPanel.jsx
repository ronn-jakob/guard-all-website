import DetailRow from "./DetailRow.jsx";
import {
  capitalizeFirst,
  formatLongDate,
  invoiceStatusLabel,
} from "./scheduleUtils.js";

// Right-hand summary of the work order selected in the list/calendar.
// Purely presentational: values, stage, and every action come from the page so
// the confirm/delete flows keep living in Scheduling.jsx.
export default function SelectedJobPanel({
  job,
  stage,
  scheduledLabel,
  invoice,
  isDraft,
  isConfirmed,
  stockAllocated,
  isConfirming,
  confirmError,
  onEdit,
  onConfirm,
  onViewInvoice,
  onRequestDelete,
}) {
  return (
    <aside className="min-h-[518px] rounded-[12px] border border-[#dfe6ec] bg-[#f9fbfd] p-5 shadow-[0_3px_8px_rgb(31_59_82_/_10%)] max-[1024px]:min-h-[455px] max-[1024px]:p-4 max-[620px]:min-h-0 max-[620px]:rounded-[7px] max-[620px]:p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[10px] uppercase tracking-[.08em] text-[#87929c]">
            Selected work order
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <small className="text-[10px] font-bold text-[#50719a]">
              {job.order || "—"}
            </small>
            {job.order && (
              <span
                className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.04em] ${stage.style}`}
              >
                {stage.label}
              </span>
            )}
          </div>
          <h2 className="m-0 mt-2 text-[23px] font-bold leading-tight max-[1024px]:text-[17px]">
            {job.client}
          </h2>
          <p className="m-0 mt-2 flex items-start text-[10px] text-[#8a949c]">
            <span className="material-symbols-outlined mr-1 flex-none align-middle text-[15px]">
              location_on
            </span>
            <span className="min-w-0">{job.location}</span>
          </p>
        </div>
        <div className="flex flex-none items-center gap-2">
          {job.order && isDraft && (
            <button
              type="button"
              onClick={onEdit}
              className="grid h-8 w-8 place-items-center rounded-[6px] bg-white text-[#174f9a] shadow-sm hover:bg-[#eaf2fc]"
              aria-label="Edit selected work order"
              title="Edit selected work order"
            >
              <span className="material-symbols-outlined text-[17px]">
                edit
              </span>
            </button>
          )}
          <span className="rounded-[6px] bg-white px-3 py-2 text-[9px] text-[#6d879f] shadow-sm">
            {scheduledLabel}
          </span>
        </div>
      </div>

      <dl className="mt-5 overflow-hidden rounded-[8px] border border-[#e4eaf0] bg-white shadow-sm max-[1024px]:mt-4">
        <DetailRow icon="tag" label="Job number">
          {job.order || "—"}
        </DetailRow>
        <DetailRow icon="apartment" label="Branch">
          {job.branch ? capitalizeFirst(job.branch) : "—"}
        </DetailRow>
        <DetailRow icon="build" label="Service type">
          {job.service || "—"}
        </DetailRow>
        <DetailRow icon="event" label="Schedule">
          {job.date ? formatLongDate(job.date) : "—"}
        </DetailRow>
        <DetailRow icon="schedule" label="Start time">
          {job.time || "—"}
        </DetailRow>
        <DetailRow icon="location_on" label="Site">
          <span className="block">{job.location || "—"}</span>
        </DetailRow>
        <DetailRow icon="person" label="Technicians">
          {job.technicians?.length ? (
            <span className="block">
              {job.technicians.map((technician) => (
                <span className="block" key={technician.id}>
                  {technician.name}
                </span>
              ))}
            </span>
          ) : (
            "Unassigned"
          )}
        </DetailRow>
        <DetailRow icon="inventory_2" label="Parts / stock">
          {job.stock || "—"}
        </DetailRow>
        {invoice && (
          <DetailRow icon="receipt_long" label="Invoice">
            {invoice.number} · {invoiceStatusLabel(invoice.status)}
          </DetailRow>
        )}
      </dl>

      {invoice ? (
        <button
          type="button"
          onClick={onViewInvoice}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-[6px] bg-[#1250a0] py-3 text-[12px] font-bold text-white hover:bg-[#0e4388] max-[1024px]:py-2 max-[1024px]:text-[9px]"
        >
          <span className="material-symbols-outlined text-[18px]">
            receipt_long
          </span>
          View invoice
        </button>
      ) : (
        <button
          type="button"
          disabled={!job.order || isConfirming || stockAllocated}
          onClick={onConfirm}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-[6px] py-3 text-[12px] font-bold text-white max-[1024px]:py-2 max-[1024px]:text-[9px] ${
            stockAllocated
              ? "cursor-default bg-[#267340]"
              : "bg-[#1250a0] hover:bg-[#0e4388] disabled:cursor-not-allowed disabled:bg-[#86a7d5]"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {stockAllocated ? "event_available" : "check"}
          </span>
          {stockAllocated
            ? "Job scheduled"
            : isConfirming
              ? "Confirming..."
              : isConfirmed
                ? "Continue to inventory request"
                : "Confirm assignment"}
        </button>
      )}
      {isDraft && (
        <button
          type="button"
          onClick={onRequestDelete}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-[6px] border border-[#e2b4ad] bg-white py-2.5 text-[11px] font-bold text-[#b33a3a] hover:bg-[#fff3f1] max-[1024px]:py-2 max-[1024px]:text-[8px]"
        >
          <span className="material-symbols-outlined text-[16px]">
            delete
          </span>
          Delete draft
        </button>
      )}
      {confirmError && (
        <p
          className="m-0 mt-2 rounded-[6px] border border-[#f0b8b0] bg-[#fff1ee] px-3 py-2 text-[11px] text-[#b64132]"
          role="alert"
        >
          {confirmError}
        </p>
      )}
    </aside>
  );
}
