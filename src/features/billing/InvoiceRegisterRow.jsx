import {
  formatDate,
  formatPeso,
  methodLabels,
  statusLabels,
  statusStyles,
} from "./billingFormatters.js";

// One invoice row plus its expandable line/payment detail panel.
export default function InvoiceRegisterRow({
  invoice,
  isExpanded,
  onToggleExpand,
  onRecordPayment,
}) {
  return (
    <div className="border-t border-[#e4e8eb]">
      <div className="grid min-h-[64px] grid-cols-[1.1fr_1.5fr_.9fr_.9fr_1fr_1.1fr_.9fr_120px] items-center px-7 text-[11px] max-[1200px]:grid-cols-[1.1fr_1.5fr_1fr_1.2fr_.9fr_120px] max-[1200px]:[&>*:nth-child(3)]:hidden max-[1200px]:[&>*:nth-child(4)]:hidden max-[850px]:grid-cols-[1.2fr_1.4fr_1fr_120px] max-[850px]:[&>*:nth-child(6)]:hidden max-[850px]:px-4 max-[620px]:grid-cols-[1fr_auto] max-[620px]:gap-x-2 max-[620px]:gap-y-1 max-[620px]:px-3 max-[620px]:py-3">
        <div className="min-w-0">
          <strong className="block truncate text-[#174f9a]">
            {invoice.invoiceNumber}
          </strong>
          <small className="block truncate text-[9px] text-[#8d969e]">
            {invoice.jobNumber || "No work order"}
          </small>
        </div>
        <div className="min-w-0">
          <strong className="block truncate">{invoice.clientName}</strong>
          <small className="block truncate text-[9px] text-[#8d969e]">
            {invoice.reportNumber || "No field report"}
          </small>
        </div>
        <span className="text-[#7f8992]">{formatDate(invoice.issueDate)}</span>
        <span className="text-[#7f8992]">{formatDate(invoice.dueDate)}</span>
        <strong className="text-[#174f9a]">
          {formatPeso(invoice.totalAmount)}
        </strong>
        <span>
          <strong className="block text-[#263747]">
            {formatPeso(invoice.paidAmount)}
          </strong>
          <small
            className={`block text-[9px] ${
              invoice.balance > 0 ? "text-[#f05b48]" : "text-[#8d969e]"
            }`}
          >
            {invoice.balance > 0
              ? `${formatPeso(invoice.balance)} left`
              : "Settled"}
          </small>
        </span>
        <span
          className={`w-max rounded-full border px-3 py-1 text-[10px] ${statusStyles[invoice.status] ?? statusStyles.pending}`}
        >
          {statusLabels[invoice.status] ?? invoice.status}
        </span>
        <div className="flex items-center justify-end gap-2">
          {invoice.balance > 0 && invoice.status !== "cancelled" ? (
            <button
              type="button"
              onClick={() => onRecordPayment(invoice)}
              className="rounded-[6px] bg-[#1250a0] px-3 py-1.5 text-[10px] font-bold text-white hover:bg-[#0f4387]"
            >
              Record payment
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleExpand}
              className="text-[10px] font-bold text-[#7573bd] hover:text-[#1250a0]"
            >
              {isExpanded ? "Hide" : "View"}
            </button>
          )}
          {invoice.balance > 0 && (
            <button
              type="button"
              onClick={onToggleExpand}
              aria-label={isExpanded ? "Hide details" : "Show details"}
              className="text-[#8b949c] hover:text-[#1250a0]"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isExpanded ? "expand_less" : "expand_more"}
              </span>
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-dashed border-[#e4e8eb] bg-[#fbfdff] px-7 py-4 text-[11px] max-[620px]:px-3">
          <div className="grid gap-4 max-[850px]:grid-cols-1 min-[851px]:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="m-0 mb-1 text-[10px] font-bold uppercase tracking-[.08em] text-[#8b949c]">
                Invoice lines
              </p>
              <div className="rounded-[6px] border border-[#e1e6eb] bg-white">
                {invoice.lines.length === 0 ? (
                  <p className="m-0 px-3 py-2 text-[11px] text-[#8d969e]">
                    No lines recorded.
                  </p>
                ) : (
                  invoice.lines.map((line) => (
                    <div
                      key={line.id}
                      className="flex items-center justify-between gap-3 border-b border-[#eef2f5] px-3 py-1.5 last:border-b-0"
                    >
                      <span className="min-w-0 truncate text-[#3a4a57]">
                        {line.description}
                      </span>
                      <span className="shrink-0 text-[10px] text-[#8d969e]">
                        {line.quantity} × {formatPeso(line.unitPrice)}
                      </span>
                      <strong className="shrink-0 text-[#174f9a]">
                        {formatPeso(line.lineTotal)}
                      </strong>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="m-0 mb-1 text-[10px] font-bold uppercase tracking-[.08em] text-[#8b949c]">
                Payments
              </p>
              <div className="rounded-[6px] border border-[#e1e6eb] bg-white">
                {invoice.payments.length === 0 ? (
                  <p className="m-0 px-3 py-2 text-[11px] text-[#8d969e]">
                    Nothing received yet.
                  </p>
                ) : (
                  invoice.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between gap-3 border-b border-[#eef2f5] px-3 py-1.5 last:border-b-0"
                    >
                      <span className="text-[#3a4a57]">
                        {formatDate(payment.date)}
                      </span>
                      <span className="text-[10px] text-[#8d969e]">
                        {methodLabels[payment.method] ?? payment.method}
                      </span>
                      <strong className="text-[#174f9a]">
                        {formatPeso(payment.amount)}
                      </strong>
                    </div>
                  ))
                )}
              </div>
              {invoice.quotationNumber && (
                <p className="m-0 mt-2 text-[10px] text-[#8b949c]">
                  From quotation {invoice.quotationNumber}
                  {invoice.serviceDate
                    ? ` · serviced ${formatDate(invoice.serviceDate)}`
                    : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
