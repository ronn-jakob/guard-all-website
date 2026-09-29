import guardAllLogo from "../images/Guard All Logo Blue.png";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
const Login = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const adminPassword = localStorage.getItem("adminPassword") || "admin123";
    const isAdmin =
      formData.get("email") === "admin@gmail.com" &&
      formData.get("password") === adminPassword;

    if (isAdmin) {
      sessionStorage.setItem("isAdmin", "true");
    } else {
      sessionStorage.removeItem("isAdmin");
    }

    navigate(isAdmin ? "/account" : "/dashboard");
  };

  return (
    <main className="grid min-h-screen place-items-center bg-linear-to-br from-[#7395c5] to-[#1d4f99] p-5 sm:p-8">
      <section className="grid min-h-[421px] w-full max-w-[790px] items-center gap-[42px] overflow-hidden rounded-[17px] border-x-[5px] border-[#f44319] bg-[#eaf4fc] px-7 py-11 shadow-[0_8px_15px_rgb(8_46_98_/_12%)] sm:grid-cols-[1.05fr_0.95fr] sm:gap-[54px] sm:border-x-[5px] sm:px-[66px] sm:py-[52px]">
        <div className="mx-auto flex w-full max-w-[321px] items-center justify-center sm:mx-0">
          <img
            src={guardAllLogo}
            alt="Guard-All Electronic Security Systems Inc."
            className="h-auto w-full object-contain"
          />
        </div>

        <div className="mx-auto w-full max-w-[276px] sm:ml-auto sm:mr-0">
          <header className="mb-[25px] text-center">
            <h1 className="m-0 text-[24px] font-bold leading-[1.15] text-[#003b85]">
              Welcome to Guard All
            </h1>
            <p className="mt-1 text-[13px] font-semibold text-[#003b85]">
              Please Login
            </p>
          </header>

          <form className="flex flex-col gap-[18px]" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-[11px] text-[#003b85]">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="example@gmail.com"
                className="h-12 w-full rounded-[9px] border border-[#c9c9c9] bg-white px-4 text-[11px] text-[#333] shadow-[inset_0_1px_3px_rgb(0_0_0_/_10%),0_1px_3px_rgb(0_0_0_/_13%)] outline-none placeholder:text-[#858585] focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/20"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-[11px] text-[#003b85]">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="****************"
                  className="h-12 w-full rounded-[9px] border border-[#c9c9c9] bg-white px-4 pr-12 text-[11px] text-[#333] shadow-[inset_0_1px_3px_rgb(0_0_0_/_10%),0_1px_3px_rgb(0_0_0_/_13%)] outline-none placeholder:text-[#858585] focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/20"
                />
                <button
                  type="button"
                  title={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((isVisible) => !isVisible)}
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center border-0 bg-transparent p-0 text-[#6f7f91] transition-colors hover:text-[#14519f]"
                >
                  <span className="material-symbols-outlined text-[15px] leading-none">
                    {showPassword ? "visibility" : "visibility_off"}
                  </span>
                </button>
              </div>
              <Link
                to="/forgot-password"
                className="self-end text-[11px] text-[#003b85] no-underline hover:underline"
              >
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              className="mt-6 h-[43px] rounded-[24px] border-0 bg-[#2057a2] text-[14px] font-bold text-white transition hover:bg-[#17488c] active:translate-y-px"
            >
              Login
            </button>
          </form>
        </div>
      </section>
    </main>
  );
};

export default Login;
