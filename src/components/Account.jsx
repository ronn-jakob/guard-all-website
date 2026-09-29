import { useState } from "react";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";

const roles = ["Administrator", "Operations Manager", "Technician", "Billing Staff"];

function Account() {
  const [accounts, setAccounts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [resetRequest, setResetRequest] = useState(() => {
    const storedRequest = localStorage.getItem("passwordResetRequest");
    return storedRequest ? JSON.parse(storedRequest) : null;
  });

  const filteredAccounts = accounts.filter((account) =>
    `${account.name} ${account.email} ${account.role}`
      .toLowerCase()
      .includes(searchTerm.trim().toLowerCase()),
  );
  const activeCount = accounts.filter(
    (account) => account.status === "Active",
  ).length;

  const handleApproveReset = () => {
    const approvedRequest = { ...resetRequest, status: "approved" };
    localStorage.setItem("passwordResetRequest", JSON.stringify(approvedRequest));
    setResetRequest(approvedRequest);
  };

  const handleClearReset = () => {
    localStorage.removeItem("passwordResetRequest");
    setResetRequest(null);
  };

  const handleCreateAccount = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = formData.get("name").trim();
    const email = formData.get("email").trim().toLowerCase();
    const role = formData.get("role");

    if (accounts.some((account) => account.email === email)) {
      setFormError("An account with this email address already exists.");
      setSuccessMessage("");
      return;
    }

    setAccounts((currentAccounts) => [
      {
        id: `GA-${String(Date.now()).slice(-6)}`,
        name,
        email,
        role,
        status: "Active",
        createdAt: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      },
      ...currentAccounts,
    ]);
    setFormError("");
    setSuccessMessage(`Account created for ${name}.`);
    form.reset();
  };

  return (
    <main className="flex h-screen overflow-hidden bg-[#202123] font-sans text-[#174f9a] max-[1024px]:block">
      <Sidebar />
      <section className="h-screen min-w-0 flex-1 overflow-y-auto bg-[#edf7ff]">
        <TopBar />
        <div className="px-8 pb-8 pt-8 max-[1024px]:px-6 max-[1024px]:pb-20 max-[1024px]:pt-5 max-[620px]:px-3">
          <header className="mb-7 max-[620px]:mb-4">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[.1em] text-[#818b94] max-[620px]:text-[7px]">
              Operations / Administration
            </p>
            <h1 className="m-0 text-[30px] font-bold tracking-[-.5px] max-[1024px]:text-[24px] max-[620px]:text-[19px]">
              Account management
            </h1>
            <p className="mb-0 mt-2 text-[14px] text-[#8b949c] max-[620px]:mt-1 max-[620px]:text-[9px]">
              Create and manage Guard All user access.
            </p>
          </header>

          <section className="mb-[18px] flex max-w-[1180px] items-center justify-between gap-4 rounded-[10px] border border-[#dfe6ec] bg-white px-5 py-4 shadow-[0_3px_8px_rgb(31_59_82_/_8%)] max-[620px]:items-start max-[620px]:flex-col max-[620px]:px-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-[6px] bg-[#fff0ec] text-[#d85b45]">
                <span className="material-symbols-outlined text-[21px]">
                  lock_reset
                </span>
              </span>
              <div className="min-w-0">
                <p className="m-0 text-[10px] font-bold uppercase tracking-[.1em] text-[#818b94]">
                  Security
                </p>
                <h2 className="m-0 mt-1 text-[16px] font-bold text-[#263747] max-[620px]:text-[14px]">
                  Password reset requests
                </h2>
                <p className="m-0 mt-1 truncate text-[12px] text-[#89939b]">
                  {resetRequest
                    ? `${resetRequest.email} · ${resetRequest.status}`
                    : "No pending password reset requests."}
                </p>
              </div>
            </div>
            {resetRequest?.status === "pending" && (
              <button
                className="inline-flex h-9 flex-none items-center gap-2 rounded-[6px] border-0 bg-[#1250a0] px-4 text-[12px] font-bold text-white transition hover:bg-[#0e4389] max-[620px]:w-full max-[620px]:justify-center"
                onClick={handleApproveReset}
                type="button"
              >
                <span className="material-symbols-outlined text-[17px]">
                  check
                </span>
                Approve request
              </button>
            )}
            {resetRequest?.status === "approved" && (
              <button
                className="flex-none text-[11px] font-semibold text-[#7d8994] hover:text-[#d85b45]"
                onClick={handleClearReset}
                type="button"
              >
                Clear
              </button>
            )}
          </section>

          <div className="grid grid-cols-[minmax(280px,0.82fr)_minmax(0,1.5fr)] items-start gap-[18px] max-[850px]:grid-cols-1">
            <section className="overflow-hidden rounded-[10px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_10%)]">
              <header className="flex items-center gap-3 border-b border-[#e1e6eb] px-6 py-5 max-[620px]:px-4 max-[620px]:py-4">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-[6px] bg-[#d6e6fb] text-[#1954a0]">
                  <span className="material-symbols-outlined text-[22px]">
                    person_add
                  </span>
                </span>
                <div>
                  <h2 className="m-0 text-[17px] font-bold max-[620px]:text-[15px]">
                    Create user account
                  </h2>
                  <p className="mb-0 mt-1 text-[12px] text-[#8b949c]">
                    Add a team member to the console.
                  </p>
                </div>
              </header>

              <form
                className="flex flex-col gap-4 p-6 max-[620px]:gap-3 max-[620px]:p-4"
                onSubmit={handleCreateAccount}
              >
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-[12px] font-semibold text-[#45515c]"
                    htmlFor="account-name"
                  >
                    Full name
                  </label>
                  <input
                    className="h-11 rounded-[6px] border border-[#d6dee6] bg-white px-3 text-[13px] text-[#273746] outline-none transition focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15"
                    id="account-name"
                    name="name"
                    placeholder="e.g. Jordan Lee"
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-[12px] font-semibold text-[#45515c]"
                    htmlFor="account-email"
                  >
                    Work email
                  </label>
                  <input
                    className="h-11 rounded-[6px] border border-[#d6dee6] bg-white px-3 text-[13px] text-[#273746] outline-none transition focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15"
                    id="account-email"
                    name="email"
                    type="email"
                    placeholder="name@guardall.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-[12px] font-semibold text-[#45515c]"
                    htmlFor="account-role"
                  >
                    Role
                  </label>
                  <select
                    className="h-11 rounded-[6px] border border-[#d6dee6] bg-white px-3 text-[13px] text-[#273746] outline-none transition focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15"
                    id="account-role"
                    name="role"
                    defaultValue="Technician"
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-[12px] font-semibold text-[#45515c]"
                    htmlFor="account-password"
                  >
                    Temporary password
                  </label>
                  <input
                    className="h-11 rounded-[6px] border border-[#d6dee6] bg-white px-3 text-[13px] text-[#273746] outline-none transition focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15"
                    id="account-password"
                    name="password"
                    type="password"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>

                {formError && (
                  <p
                    className="m-0 rounded-[5px] border border-[#f0b8b0] bg-[#fff1ee] px-3 py-2 text-[12px] text-[#b64132]"
                    role="alert"
                  >
                    {formError}
                  </p>
                )}
                {successMessage && (
                  <p
                    className="m-0 rounded-[5px] border border-[#a8dfb7] bg-[#effaf2] px-3 py-2 text-[12px] text-[#267340]"
                    role="status"
                  >
                    {successMessage}
                  </p>
                )}

                <button
                  className="mt-1 flex h-11 items-center justify-center gap-2 rounded-[6px] border-0 bg-[#1250a0] px-4 text-[13px] font-bold text-white transition hover:bg-[#0e4389] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1250a0]"
                  type="submit"
                >
                  <span className="material-symbols-outlined text-[19px]">
                    person_add
                  </span>
                  Create account
                </button>
              </form>
            </section>

            <section className="min-w-0 overflow-hidden rounded-[10px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_10%)]">
              <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e1e6eb] px-6 py-5 max-[620px]:px-4 max-[620px]:py-4">
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[.1em] text-[#818b94]">
                    Team
                  </p>
                  <h2 className="m-0 text-[18px] font-bold max-[620px]:text-[15px]">
                    User directory
                  </h2>
                </div>
                <label className="relative min-w-[190px] flex-1 max-w-[270px] max-[620px]:max-w-none">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-[#89939b]">
                    search
                  </span>
                  <input
                    className="h-10 w-full rounded-[6px] border border-[#dfe6ec] bg-[#fbfdff] pl-10 pr-3 text-[12px] text-[#273746] outline-none transition placeholder:text-[#9aa3aa] focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15"
                    type="search"
                    placeholder="Search users"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </label>
              </header>

              <div className="grid grid-cols-2 gap-3 border-b border-[#e8edf1] bg-[#fbfdff] px-6 py-4 max-[620px]:px-4">
                <div>
                  <p className="m-0 text-[11px] font-semibold text-[#838d96]">
                    Total accounts
                  </p>
                  <strong className="mt-1 block text-[22px] leading-none text-[#174f9a]">
                    {accounts.length}
                  </strong>
                </div>
                <div>
                  <p className="m-0 text-[11px] font-semibold text-[#838d96]">
                    Active
                  </p>
                  <strong className="mt-1 block text-[22px] leading-none text-[#248044]">
                    {activeCount}
                  </strong>
                </div>
              </div>

              {filteredAccounts.length > 0 ? (
                <div className="divide-y divide-[#e8edf1]">
                  {filteredAccounts.map((account) => (
                    <article
                      className="grid grid-cols-[minmax(0,1.5fr)_minmax(110px,0.8fr)_90px] items-center gap-4 px-6 py-4 max-[620px]:grid-cols-[minmax(0,1fr)_auto] max-[620px]:gap-2 max-[620px]:px-4"
                      key={account.id}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-[#e7f0fc] text-[12px] font-bold text-[#17519a]">
                          {account.name
                            .split(/\s+/)
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <strong className="block truncate text-[13px] text-[#263747]">
                            {account.name}
                          </strong>
                          <span className="block truncate text-[11px] text-[#89939b]">
                            {account.email}
                          </span>
                        </div>
                      </div>
                      <div className="max-[620px]:col-start-1 max-[620px]:pl-[52px]">
                        <span className="text-[12px] font-semibold text-[#5d6872]">
                          {account.role}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-[#929ba2]">
                          Added {account.createdAt}
                        </span>
                      </div>
                      <span className="justify-self-end rounded-full border border-[#b9e3c4] bg-[#effaf2] px-2.5 py-1 text-[10px] font-bold text-[#267340]">
                        {account.status}
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-[250px] place-items-center px-6 py-10 text-center">
                  <div>
                    <span className="material-symbols-outlined text-[34px] text-[#8fa8c4]">
                      {searchTerm ? "search_off" : "group"}
                    </span>
                    <h3 className="mb-1 mt-2 text-[14px] font-bold text-[#45515c]">
                      {searchTerm ? "No matching users" : "No accounts yet"}
                    </h3>
                    <p className="m-0 text-[12px] text-[#89939b]">
                      {searchTerm
                        ? "Try a different name, email, or role."
                        : "New user accounts will appear here."}
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Account;
