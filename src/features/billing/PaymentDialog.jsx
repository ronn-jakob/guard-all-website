import { useState } from "react";
import { recordPayment } from "../../lib/api/billing.js";
import { fieldClass, formatPeso, methodLabels, todayKey } from "./billingFormatters.js";

// Records a payment against one invoice. The amount is capped at the balance so
// the server never has to reject an obvious overpayment.
export default function PaymentDialog({ invoice, onClose, onSaved }) {
  const [amount, setAmount] = useState(() =>
    invoice.balance > 0 ? String(invoice.balance) : "",
  );
  const [method, setMethod] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(todayKey);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a payment amount greater than zero.");
      return;
    }
    if (value > invoice.balance + 0.001) {
      setError(
        `That is more than the ${formatPeso(invoice.balance)} still owed on this invoice.`,
      );
      return;
    }

    setError("");
    setIsSaving(true);
    try {
      await recordPayment({
        invoiceId: invoice.id,
        amount: value,
        method,
        paymentDate,
      });
      onSaved();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/70 p-4 backdrop-blur-[2px] max-[620px]:items-end max-[620px]:p-0"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-label={`Record payment for ${invoice.invoiceNumber}`}
        className="w-full max-w-[430px] rounded-[14px] border border-[#dfe6ec] bg-white p-6 shadow-[0_24px_70px_rgb(0_0_0_/_35%)] max-[620px]:rounded-b-none max-[620px]:rounded-t-[16px]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="m-0 text-[10px] font-bold uppercase tracking-[.1em] text-[#818b94]">
              Record payment
            </p>
            <h2 className="m-0 mt-1 text-[18px] font-bold text-[#174f9a]">
              {invoice.invoiceNumber}
            </h2>
            <p className="m-0 mt-1 text-[12px] text-[#8b949c]">
              {invoice.clientName} · {formatPeso(invoice.balance)} outstanding
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[#818b94] hover:text-[#174f9a]"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <label className="mt-4 flex flex-col text-[11px] font-semibold text-[#45515c]">
          Amount
          <input
            type="number"
            min="0.01"
            step="0.01"
            max={invoice.balance}
            className={fieldClass}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="flex flex-col text-[11px] font-semibold text-[#45515c]">
            Method
            <select
              className={fieldClass}
              value={method}
              onChange={(event) => setMethod(event.target.value)}
            >
              {Object.entries(methodLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-[11px] font-semibold text-[#45515c]">
            Date
            <input
              type="date"
              className={fieldClass}
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
              required
            />
          </label>
        </div>

        {error && (
          <p
            className="m-0 mt-3 rounded-[6px] border border-[#f1b7af] bg-[#fff3f1] px-3 py-2 text-[11px] text-[#a83a2c]"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-[#d9dfe4] px-4 py-2 text-[11px] font-bold text-[#5e6b78] hover:bg-[#f4f6f8]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-[6px] bg-[#1250a0] px-4 py-2 text-[11px] font-bold text-white hover:bg-[#0f4387] disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save payment"}
          </button>
        </div>
      </form>
    </div>
  );
}
