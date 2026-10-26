import { useEffect } from "react";

// Confirmation shown before signing out. Logout only clears the session in
// sessionStorage, so there is nothing for a typed password to protect — this is
// purely a guard against a misclick. Styling mirrors ConfirmPasswordDialog.
export default function LogoutConfirmDialog({ onCancel, onConfirm }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/75 p-4 backdrop-blur-[2px] max-[620px]:items-end max-[620px]:p-0"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Log out"
        className="w-full max-w-[430px] rounded-[14px] border border-[#dfe6ec] bg-white p-6 shadow-[0_24px_70px_rgb(0_0_0_/_35%)] max-[620px]:rounded-b-none max-[620px]:rounded-t-[16px]"
      >
        <h2 className="m-0 text-[17px] font-bold text-[#063b7c]">Log out?</h2>
        <p className="m-0 mt-2 text-[12px] leading-relaxed text-[#4b5a68]">
          You will be signed out and returned to the sign-in screen. Anything
          you have not saved will be lost.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            autoFocus
            className="rounded-[6px] border border-[#d9dfe4] bg-white px-4 py-2 text-[11px] font-bold text-[#5e6b78] hover:bg-[#f4f6f8]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-[6px] bg-[#c0392b] px-4 py-2 text-[11px] font-bold text-white hover:bg-[#a93226]"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
