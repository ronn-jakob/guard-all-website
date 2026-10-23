import { useState } from "react";

// Reusable confirmation for destructive actions. The password lives in component
// state only — it is never stored, logged, or kept after the dialog closes. The
// server re-verifies it before doing anything.
export default function ConfirmPasswordDialog({
  title,
  message,
  detail,
  confirmLabel = "Delete",
  busyLabel = "Deleting...",
  isBusy = false,
  error = "",
  onCancel,
  onConfirm,
}) {
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (!password) {
      setLocalError("Enter your password to confirm.");
      return;
    }
    setLocalError("");
    onConfirm(password);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/75 p-4 backdrop-blur-[2px] max-[620px]:items-end max-[620px]:p-0"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) onCancel();
      }}
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-[430px] rounded-[14px] border border-[#dfe6ec] bg-white p-6 shadow-[0_24px_70px_rgb(0_0_0_/_35%)] max-[620px]:rounded-b-none max-[620px]:rounded-t-[16px]"
      >
        <h2 className="m-0 text-[17px] font-bold text-[#a83a2c]">{title}</h2>
        <p className="m-0 mt-2 text-[12px] leading-relaxed text-[#4b5a68]">
          {message}
        </p>
        {detail && (
          <p className="m-0 mt-2 rounded-[6px] border border-[#f0dcb4] bg-[#fffbf2] px-3 py-2 text-[11px] text-[#7a5a12]">
            {detail}
          </p>
        )}

        <label className="mt-4 flex flex-col text-[11px] font-semibold text-[#45515c]">
          Confirm with your password
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-[6px] border border-[#d6dee6] bg-white px-3 text-[12px] text-[#273746] outline-none transition focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15"
          />
        </label>

        {(localError || error) && (
          <p
            className="m-0 mt-3 rounded-[6px] border border-[#f1b7af] bg-[#fff3f1] px-3 py-2 text-[11px] text-[#a83a2c]"
            role="alert"
          >
            {localError || error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="rounded-[6px] border border-[#d9dfe4] bg-white px-4 py-2 text-[11px] font-bold text-[#5e6b78] hover:bg-[#f4f6f8] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isBusy}
            className="rounded-[6px] bg-[#c0392b] px-4 py-2 text-[11px] font-bold text-white hover:bg-[#a93226] disabled:opacity-50"
          >
            {isBusy ? busyLabel : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
