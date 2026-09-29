import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import guardAllLogo from "../images/Guard All Logo Blue.png";

function ForgotPassword() {
  const navigate = useNavigate();
  const [request, setRequest] = useState(() => {
    const storedRequest = localStorage.getItem("passwordResetRequest");
    return storedRequest ? JSON.parse(storedRequest) : null;
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleRequest = (event) => {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email").trim().toLowerCase();
    const nextRequest = {
      email,
      status: "pending",
      requestedAt: new Date().toISOString(),
    };

    localStorage.setItem("passwordResetRequest", JSON.stringify(nextRequest));
    setRequest(nextRequest);
    setError("");
    setMessage("Your request was sent to the administrator for approval.");
  };

  const handlePasswordReset = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    localStorage.setItem("adminPassword", password);
    localStorage.removeItem("passwordResetRequest");
    setRequest(null);
    setError("");
    setMessage("Your password was changed. You can now sign in.");
  };

  return (
    <main className="grid min-h-screen place-items-center bg-linear-to-br from-[#7395c5] to-[#1d4f99] p-5 sm:p-8">
      <section className="w-full max-w-[500px] rounded-[17px] border-x-[5px] border-[#f44319] bg-[#eaf4fc] px-7 py-9 shadow-[0_8px_15px_rgb(8_46_98_/_12%)] sm:px-[55px] sm:py-[48px]">
        <img
          src={guardAllLogo}
          alt="Guard-All Electronic Security Systems Inc."
          className="mx-auto mb-7 h-auto w-[220px] object-contain"
        />
        <header className="mb-6 text-center">
          <h1 className="m-0 text-[24px] font-bold text-[#003b85]">
            Forgot Password
          </h1>
          <p className="mb-0 mt-2 text-[13px] text-[#527093]">
            Request administrator approval to reset your password.
          </p>
        </header>

        {!request && (
          <form className="flex flex-col gap-4" onSubmit={handleRequest}>
            <label className="flex flex-col gap-1 text-[11px] text-[#003b85]">
              Account email
              <input
                className="h-12 rounded-[9px] border border-[#c9c9c9] bg-white px-4 text-[12px] text-[#333] outline-none focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/20"
                name="email"
                type="email"
                placeholder="example@gmail.com"
                required
              />
            </label>
            <button
              className="mt-2 h-11 rounded-[24px] border-0 bg-[#2057a2] text-[13px] font-bold text-white transition hover:bg-[#17488c]"
              type="submit"
            >
              Send request to admin
            </button>
          </form>
        )}

        {request?.status === "pending" && (
          <div className="rounded-[8px] border border-[#cbd8e7] bg-white p-4 text-center">
            <span className="material-symbols-outlined text-[30px] text-[#1954a0]">
              hourglass_top
            </span>
            <h2 className="m-0 mt-2 text-[15px] font-bold text-[#174f9a]">
              Waiting for approval
            </h2>
            <p className="mb-0 mt-2 text-[12px] leading-relaxed text-[#718090]">
              The administrator must approve the request before you can create a new password.
            </p>
          </div>
        )}

        {request?.status === "approved" && (
          <form className="flex flex-col gap-4" onSubmit={handlePasswordReset}>
            <p className="m-0 rounded-[6px] border border-[#a8dfb7] bg-[#effaf2] px-3 py-2 text-[12px] text-[#267340]">
              Your request was approved. Create a new password below.
            </p>
            <label className="flex flex-col gap-1 text-[11px] text-[#003b85]">
              New password
              <input
                className="h-12 rounded-[9px] border border-[#c9c9c9] bg-white px-4 text-[12px] text-[#333] outline-none focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/20"
                name="password"
                type="password"
                minLength={8}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-[#003b85]">
              Confirm new password
              <input
                className="h-12 rounded-[9px] border border-[#c9c9c9] bg-white px-4 text-[12px] text-[#333] outline-none focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/20"
                name="confirmPassword"
                type="password"
                minLength={8}
                required
              />
            </label>
            <button
              className="h-11 rounded-[24px] border-0 bg-[#2057a2] text-[13px] font-bold text-white transition hover:bg-[#17488c]"
              type="submit"
            >
              Set new password
            </button>
          </form>
        )}

        {message && (
          <p className="mt-4 rounded-[6px] border border-[#a8dfb7] bg-[#effaf2] px-3 py-2 text-center text-[12px] text-[#267340]" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-[6px] border border-[#f0b8b0] bg-[#fff1ee] px-3 py-2 text-center text-[12px] text-[#b64132]" role="alert">
            {error}
          </p>
        )}
        <Link
          className="mt-6 block text-center text-[12px] font-semibold text-[#003b85] no-underline hover:underline"
          to="/"
          onClick={() => {
            if (request?.status === "approved") navigate("/");
          }}
        >
          Back to login
        </Link>
      </section>
    </main>
  );
}

export default ForgotPassword;
