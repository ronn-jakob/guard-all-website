import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import { Link } from "react-router-dom";
import { getSession } from "../lib/auth.js";
import { getDashboardSummary } from "../lib/api/dashboard.js";
import { useAsyncData } from "../lib/hooks/useAsyncData.js";

const formatPeso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatShortDate = (value) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      })
    : "";

const stockStatus = (partsStatus) => {
  if (partsStatus === "confirmed") return "Available";
  if (partsStatus === "not_required") return "Not needed";
  return "Pending";
};

const row =
  "grid grid-cols-[1.05fr_1.42fr_1.18fr_1fr_36px] items-center px-5 max-[620px]:grid-cols-[1fr_1.5fr_1.2fr_24px] max-[620px]:px-[9px]";
const label =
  "m-0 text-[10px] font-bold uppercase tracking-[.12em] text-[#777e85]";

function Dashboard() {
  const accountName = getSession()?.user?.name || "";
  const nameParts = accountName.trim().split(/\s+/).filter(Boolean);
  const greetingName =
    nameParts.length > 1
      ? `${nameParts[0][0].toUpperCase()}. ${nameParts.slice(1).join(" ")}`
      : accountName;

  const { data: summary, error: loadError, isLoading } = useAsyncData(
    getDashboardSummary,
    [],
  );

  const counts = summary?.counts ?? {};
  const jobs = summary?.jobs ?? [];
  const openInvoices = counts.openInvoices ?? null;

  const metrics = [
    [
      "event",
      "Jobs today",
      String(counts.todayJobs ?? 0),
      `${counts.upcomingJobs ?? 0} upcoming`,
      "bg-[#d6e6fb] text-[#1954a0]",
      false,
    ],
    [
      "pending_actions",
      "Awaiting stock",
      String(counts.pendingAllocation ?? 0),
      "Confirmed jobs without parts",
      "bg-[#d6e6fb] text-[#1954a0]",
      (counts.pendingAllocation ?? 0) > 0,
    ],
    counts.draftJobs != null
      ? [
          "edit_note",
          "Draft jobs",
          String(counts.draftJobs),
          "Awaiting confirmation · holding technician slots",
          "bg-[#f3e2c7] text-[#a56b00]",
          counts.draftJobs > 0,
          "/scheduling?drafts=1",
        ]
      : [
          "assignment",
          "Reports in review",
          String(counts.reportsAwaitingReview ?? 0),
          "Waiting for a manager",
          "bg-[#d6e6fb] text-[#1954a0]",
          (counts.reportsAwaitingReview ?? 0) > 0,
        ],
    openInvoices
      ? [
          "account_balance",
          "Outstanding",
          formatPeso(openInvoices.amount),
          `${openInvoices.count} unpaid ${openInvoices.count === 1 ? "invoice" : "invoices"}`,
          "bg-[#d6e6fb] text-[#1954a0]",
          openInvoices.count > 0,
        ]
      : [
          "warning",
          "Below reorder point",
          String(counts.lowStock ?? 0),
          "Requires procurement",
          "bg-[#ffd5cc] text-[#ff725f]",
          (counts.lowStock ?? 0) > 0,
        ],
  ];

  const pulseItems = [
    {
      icon: "warning",
      color: "text-[#ff725f]",
      title: "Parts below reorder point",
      note: `${counts.lowStock ?? 0} ${(counts.lowStock ?? 0) === 1 ? "part needs" : "parts need"} procurement`,
    },
    {
      icon: "assignment",
      color: "text-[#2467ae]",
      title: "Reports in review queue",
      note: `${counts.reportsAwaitingReview ?? 0} awaiting a decision`,
    },
  ];
  if (openInvoices) {
    pulseItems.push({
      icon: "account_balance",
      color: "text-[#063b7c]",
      title: "Outstanding invoices",
      note: `${openInvoices.count} open · ${formatPeso(openInvoices.amount)}`,
    });
  }
  // Drafts hold technician slots, so they lead the attention list.
  if (counts.draftJobs != null) {
    pulseItems.unshift({
      icon: "edit_note",
      color: "text-[#a56b00]",
      title: "Draft jobs awaiting confirmation",
      note: `${counts.draftJobs} holding technician slots`,
    });
  }

  return (
    <main className="flex h-screen overflow-hidden bg-[#1f2022] font-sans text-[#063b7c] max-[1024px]:block">
      <Sidebar />
      <section className="h-screen w-full min-w-0 flex-1 overflow-y-auto bg-[#edf7ff] max-[1024px]:h-[100dvh]">
        <TopBar />
        <div className="px-8 pb-6 pt-9 max-[1024px]:px-6 max-[1024px]:pb-20 max-[1024px]:pt-5 max-[620px]:px-3">
          <h1 className="m-0 mb-6 text-[30px] font-bold tracking-[-.5px] max-[1024px]:text-[24px] max-[620px]:mb-4 max-[620px]:text-[19px]">
            Good morning, {greetingName}
          </h1>

          {loadError && (
            <p
              className="mb-4 rounded-[6px] border border-[#f1b7af] bg-[#fff3f1] px-4 py-3 text-[12px] text-[#a83a2c]"
              role="alert"
            >
              {loadError}
            </p>
          )}

          <section className="grid grid-cols-4 gap-[18px] max-[1024px]:grid-cols-2 max-[620px]:grid-cols-1 max-[620px]:gap-1">
            {metrics.map(([icon, title, value, note, tone, alert, href]) => {
              const cardClass = `relative min-h-[156px] rounded-[10px] border bg-white p-[22px] shadow-[0_3px_7px_rgb(31_59_82_/_13%)] max-[1024px]:min-h-[105px] max-[1024px]:p-4 max-[620px]:min-h-[64px] max-[620px]:rounded-[6px] max-[620px]:p-3 ${alert ? "border-[#ff725f] shadow-[0_3px_8px_rgb(255_114_95_/_22%)]" : "border-[#e0e6eb]"}`;
              const body = (
                <>
                  <div
                    className={`grid h-9 w-9 place-items-center rounded-[6px] text-[15px] max-[620px]:hidden ${tone}`}
                  >
                    <span className="material-symbols-outlined text-[21px]">
                      {icon}
                    </span>
                  </div>
                  <p className="mb-0 mt-5 text-[11px] font-bold uppercase tracking-[.06em] text-[#858b90] max-[1024px]:mt-3 max-[620px]:mt-0 max-[620px]:text-[7px]">
                    {title}
                  </p>
                  <strong className="mt-px block text-[29px] font-extrabold leading-tight max-[1024px]:text-[23px] max-[620px]:text-[15px]">
                    {isLoading ? "—" : value}
                  </strong>
                  <small className="text-[10px] text-[#8e959b] max-[620px]:hidden">
                    {note}
                  </small>
                </>
              );

              return href ? (
                <Link
                  key={title}
                  to={href}
                  aria-label={`${title}: ${value}. Open the draft jobs list.`}
                  className={`${cardClass} block text-inherit no-underline transition hover:border-[#1250a0]`}
                >
                  {body}
                </Link>
              ) : (
                <article key={title} className={cardClass}>
                  {body}
                </article>
              );
            })}
          </section>

          <div className="mt-4 grid grid-cols-[minmax(0,2.25fr)_minmax(260px,1fr)] gap-[18px] max-[1024px]:grid-cols-[minmax(0,1.4fr)_minmax(180px,1fr)] max-[1024px]:gap-3 max-[620px]:grid-cols-1">
            <section className="overflow-hidden rounded-[11px] border border-[#dfe6ec] bg-white shadow-[0_3px_7px_rgb(31_59_82_/_10%)] max-[620px]:overflow-visible max-[620px]:border-0 max-[620px]:bg-transparent max-[620px]:shadow-none">
              <header className="flex items-center justify-between px-[22px] pb-[14px] pt-5 max-[1024px]:px-3 max-[1024px]:pb-3 max-[1024px]:pt-3 max-[620px]:rounded-[6px] max-[620px]:bg-white">
                <div>
                  <p className={label}>Live board · {jobs.length} scheduled</p>
                  <h2 className="m-0 mt-1 text-[21px] font-bold max-[1024px]:text-[13px]">
                    Upcoming jobs
                  </h2>
                </div>
                <Link
                  className="text-[11px] font-bold text-[#063b7c] no-underline max-[1024px]:text-[7px]"
                  to="/scheduling"
                >
                  Open schedule{" "}
                  <span className="material-symbols-outlined ml-1 align-middle text-[20px]">
                    chevron_right
                  </span>
                </Link>
              </header>
              <div className="border-t border-[#e0e6eb]" role="table">
                <div
                  className={`${row} min-h-[42px] border-b border-[#e0e0e0] text-[9px] font-bold uppercase tracking-[.04em] text-[#77818a] max-[620px]:hidden`}
                  role="row"
                >
                  <span>Time / Work order</span>
                  <span>Client &amp; site</span>
                  <span>Assigned technician</span>
                  <span>Stock check</span>
                  <span aria-hidden="true" />
                </div>
                {isLoading ? (
                  <p className="px-5 py-8 text-center text-[12px] text-[#8d969e]">
                    Loading the board...
                  </p>
                ) : jobs.length === 0 ? (
                  <p className="px-5 py-8 text-center text-[12px] text-[#8d969e]">
                    No upcoming jobs are scheduled.
                  </p>
                ) : (
                  jobs.map((job, index) => {
                    const stock = stockStatus(job.partsStatus);
                    return (
                      <div
                        className={`${row} min-h-[62px] border-b border-[#e0e0e0] text-[10px] last:border-0 max-[1024px]:min-h-[56px] max-[1024px]:px-3 max-[1024px]:text-[8px] max-[620px]:mb-1 max-[620px]:min-h-[67px] max-[620px]:rounded-[6px] max-[620px]:border max-[620px]:px-3 max-[620px]:py-2 max-[620px]:[&>*:nth-child(4)]:hidden ${index === 3 ? "max-[620px]:hidden" : ""}`}
                        role="row"
                        key={`${job.jobNumber}-${index}`}
                      >
                        <div>
                          <strong className="text-[11px]">{job.time}</strong>
                          <em className="ml-[5px] rounded-[2px] bg-[#dbeafa] px-1 py-[3px] text-[8px] not-italic font-bold text-[#184f96]">
                            {job.jobNumber}
                          </em>
                          <small className="mt-1 block text-[9px] text-[#8d969e]">
                            {job.serviceLabel} · {formatShortDate(job.scheduledDate)}
                          </small>
                        </div>
                        <div className="min-w-0">
                          <strong className="block truncate">
                            {job.clientName}
                          </strong>
                          <small className="mt-1 block text-[9px] text-[#8d969e]">
                            <span className="material-symbols-outlined align-middle text-[10px]">
                              location_on
                            </span>{" "}
                            {job.siteAddress}
                          </small>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#17549e] text-[9px] font-bold text-white">
                            {job.technicianInitials}
                          </span>
                          <span className="min-w-0 truncate">
                            {job.technicianName}
                          </span>
                          {job.additionalTechnicianCount > 0 && (
                            <span
                              title={job.technicianNames?.join(", ")}
                              className="shrink-0 rounded-[3px] bg-[#d9e8fa] px-[5px] py-1 text-[8px] font-bold text-[#15519c]"
                            >
                              +{job.additionalTechnicianCount}
                            </span>
                          )}
                        </div>
                        <span
                          className={`w-max rounded-[9px] px-3 py-1.5 text-[8px] ${stock === "Available" || stock === "Not needed" ? "border border-[#8bdba2] bg-[#dff8e5] text-[#18823a]" : "border border-[#ff9f8f] bg-[#ffe0da] text-[#d75342]"}`}
                        >
                          ◎ {stock}
                        </span>
                        <span className="material-symbols-outlined text-[20px] text-[#15519c]">
                          chevron_right
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <aside className="min-h-[290px] overflow-hidden rounded-[11px] border border-[#dfe6ec] bg-[#f8fbff] p-5 shadow-[0_3px_7px_rgb(31_59_82_/_10%)] max-[1024px]:min-h-[360px] max-[1024px]:bg-[#063b7c] max-[1024px]:p-3 max-[620px]:min-h-0 max-[620px]:rounded-[7px]">
              <header className="flex justify-between">
                <div>
                  <p className={`${label} max-[1024px]:text-[#dbeafa]`}>
                    Needs attention
                  </p>
                  <h2 className="m-0 mt-1 text-[21px] font-bold max-[1024px]:text-[13px] max-[1024px]:text-white">
                    Operation pulse
                  </h2>
                </div>
                <span className="grid h-[26px] w-[26px] place-items-center rounded-[6px] bg-white text-lg max-[1024px]:hidden">
                  <span className="material-symbols-outlined text-[18px]">
                    shield
                  </span>
                </span>
              </header>
              <div className="mt-[22px] max-[1024px]:mt-3">
                {pulseItems.map(({ icon, color, title, note }) => (
                  <div
                    className="mb-3 flex min-h-[50px] items-center gap-2 rounded-[5px] border border-[#dbe0e5] bg-white p-2.5 text-[#063b7c] max-[1024px]:mb-2 max-[1024px]:min-h-[47px] max-[1024px]:p-2"
                    key={title}
                  >
                    <span className={`w-5 text-center text-[13px] ${color}`}>
                      <span className="material-symbols-outlined text-[18px]">
                        {icon}
                      </span>
                    </span>
                    <strong className="flex-1 text-[10px] max-[1024px]:text-[8px]">
                      {title}
                      <small className="mt-1 block text-[9px] font-normal text-[#8a929a] max-[1024px]:text-[7px]">
                        {note}
                      </small>
                    </strong>
                  </div>
                ))}
              </div>
              <div className="mt-5 border-t border-[#d2d9e0]" />
            </aside>
          </div>
          <footer className="mt-6 border-t border-[#c9d4de] pt-3 text-[9px] text-[#8a9299] max-[1024px]:hidden">
            Guard-All Electronic Security Systems, Inc.
          </footer>
        </div>
      </section>
    </main>
  );
}

export default Dashboard;
