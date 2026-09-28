import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import logo from "../images/Guard All Logo Blue.png";

const metrics = [
  [
    "calendar_month",
    "Scheduled jobs",
    "7",
    "2 jobs scheduled today",
    "bg-[#d6e6fb] text-[#1954a0]",
  ],
  [
    "warning",
    "Low-stocks alert",
    "3",
    "Makati only",
    "bg-[#ffd5cc] text-[#ff725f]",
    true,
  ],
  [
    "assignment",
    "Pending reports",
    "4",
    "1 requires review",
    "bg-[#d6e6fb] text-[#1954a0]",
  ],
  [
    "sell",
    "Revenue this month",
    "₱775k",
    "+1.2% from last month",
    "bg-[#d6e6fb] text-[#1954a0]",
  ],
];

const jobs = [
  [
    "09:00",
    "TODAY",
    "WO-91283",
    "HarborBridge Gateway",
    "Pasay City - Brgy. 1235",
    "CK",
    "Carl Klaro",
    "+3",
    "Available",
  ],
  [
    "14:00",
    "TODAY",
    "WO-91283",
    "Seaside Condominium",
    "Manila City - Roxas Blvd.",
    "MJ",
    "Mark James",
    "+3",
    "Available",
  ],
  [
    "09:00",
    "Tomorrow",
    "WO-91283",
    "JV Restaurant",
    "Pasay City - Brgy. 145",
    "JV",
    "James Via",
    "+2",
    "Available",
  ],
  [
    "TBA",
    "09/30/2026",
    "WO-91283",
    "HarborBridge Gateway",
    "Pasay City - Brgy. 1235",
    "CK",
    "Carl Klaro",
    "+1",
    "1 Shortage",
  ],
];

const row =
  "grid grid-cols-[1.05fr_1.42fr_1.18fr_1fr_28px] items-center px-5 max-[620px]:grid-cols-[1fr_1.5fr_1.2fr_22px] max-[620px]:px-[9px]";
const label =
  "m-0 text-[10px] font-bold uppercase tracking-[.12em] text-[#777e85]";

function Dashboard() {
  return (
    <main className="flex h-screen overflow-hidden bg-[#1f2022] font-sans text-[#063b7c] max-[1024px]:block max-[1024px]:[&>aside]:hidden">
      <Sidebar />

      <section className="h-screen min-w-0 flex-1 overflow-y-auto bg-[#edf7ff]">
        <TopBar />
        <header className="hidden h-[52px] items-center justify-between border-b border-[#d7e2ec] bg-white px-4 max-[1024px]:flex"><img className="h-7 w-[95px] object-contain" src={logo} alt="Guard-All" /><div className="text-right text-[7px] text-[#7c8186]"><strong className="block text-[8px] text-[#202a35]">Makati - Metro Manila</strong><span>Mon, 15 Sep 2026 · 9:58 AM</span></div><span className="grid h-7 w-7 place-items-center rounded-full bg-[#ff4825] text-[8px] font-bold text-white">RJ</span></header>
        <div className="px-8 pb-6 pt-9 max-[1024px]:px-6 max-[1024px]:pb-20 max-[1024px]:pt-5 max-[620px]:px-3">
          <h1 className="m-0 mb-6 text-[30px] font-bold tracking-[-.5px] max-[1024px]:text-[24px] max-[620px]:mb-4 max-[620px]:text-[19px]">
            Good morning, R. Jakob
          </h1>
          <section
            className="grid grid-cols-4 gap-[18px] max-[1024px]:grid-cols-2 max-[620px]:grid-cols-1 max-[620px]:gap-1"
            
          >
            {metrics.map(([icon, title, value, note, tone, alert]) => (
              <article
                className={`relative min-h-[156px] rounded-[10px] border bg-white p-[22px] shadow-[0_3px_7px_rgb(31_59_82_/_13%)] max-[1024px]:min-h-[105px] max-[1024px]:p-4 max-[620px]:min-h-[64px] max-[620px]:rounded-[6px] max-[620px]:p-3 ${alert ? "border-[#ff725f] shadow-[0_3px_8px_rgb(255_114_95_/_22%)]" : "border-[#e0e6eb]"}`}
                key={title}
              >
                <div
                  className={`grid h-9 w-9 place-items-center rounded-[6px] text-[15px] max-[620px]:hidden ${tone}`}
                >
                  <span className="material-symbols-outlined text-[21px]">{icon}</span>
                </div>
                <span
                  className={`absolute right-[20px] top-[22px] text-[17px] max-[620px]:hidden ${alert ? "text-[#ff725f]" : "text-[#16bc56]"}`}
                >
                  <span className="material-symbols-outlined text-[22px]">north_east</span>
                </span>
                <p className="mb-0 mt-5 text-[11px] font-bold uppercase tracking-[.06em] text-[#858b90] max-[1024px]:mt-3 max-[620px]:mt-0 max-[620px]:text-[7px]">
                  {title}
                </p>
                <strong className="mt-px block text-[29px] font-extrabold leading-tight max-[1024px]:text-[23px] max-[620px]:text-[15px]">
                  {value}
                </strong>
                <small className="text-[10px] text-[#8e959b] max-[620px]:hidden">{note}</small>
              </article>
            ))}
          </section>

          <div className="mt-4 grid grid-cols-[minmax(0,2.25fr)_minmax(260px,1fr)] gap-[18px] max-[1024px]:grid-cols-[minmax(0,1.4fr)_minmax(180px,1fr)] max-[1024px]:gap-3 max-[620px]:grid-cols-1">
            <section className="overflow-hidden rounded-[11px] border border-[#dfe6ec] bg-white shadow-[0_3px_7px_rgb(31_59_82_/_10%)] max-[620px]:overflow-visible max-[620px]:border-0 max-[620px]:bg-transparent max-[620px]:shadow-none">
              <header className="flex items-center justify-between px-[22px] pb-[14px] pt-5 max-[1024px]:px-3 max-[1024px]:pb-3 max-[1024px]:pt-3 max-[620px]:rounded-[6px] max-[620px]:bg-white">
                <div>
                  <p className={label}>Live board · 7 scheduled</p>
                  <h2 className="m-0 mt-1 text-[21px] font-bold max-[1024px]:text-[13px]">
                    Upcoming jobs
                  </h2>
                </div>
                <a
                  className="text-[11px] font-bold text-[#063b7c] no-underline max-[1024px]:text-[7px]"
                  href="#schedule"
                >
                  Open schedule <span className="material-symbols-outlined ml-1 align-middle text-[20px]">chevron_right</span>
                </a>
              </header>
              <div
                className="border-t border-[#e0e6eb]"
                role="table"
               
              >
                <div
                  className={`${row} min-h-[42px] border-b border-[#e0e0e0] text-[9px] font-bold uppercase tracking-[.04em] text-[#77818a] max-[620px]:hidden`}
                  role="row"
                >
                  <span>Time / Work order</span>
                  <span>Client &amp; site</span>
                  <span>Assigned technician</span>
                  <span>Stock check</span>
                  <span>Open</span>
                </div>
                {jobs.map((job, index) => (
                  <div
                    className={`${row} min-h-[62px] border-b border-[#e0e0e0] text-[10px] last:border-0 max-[1024px]:min-h-[56px] max-[1024px]:text-[8px] max-[1024px]:px-3 max-[620px]:mb-1 max-[620px]:min-h-[67px] max-[620px]:rounded-[6px] max-[620px]:border max-[620px]:px-3 max-[620px]:py-2 max-[620px]:[&>*:nth-child(4)]:hidden ${index === 3 ? "max-[620px]:hidden" : ""}`}
                    role="row"
                    key={`${job[0]}-${index}`}
                  >
                    <div>
                      <strong className="text-[11px]">{job[0]}</strong>
                      <em className="ml-[5px] rounded-[2px] bg-[#dbeafa] px-1 py-[3px] text-[8px] not-italic font-bold text-[#184f96]">
                        {job[1]}
                      </em>
                      <small className="mt-1 block text-[9px] text-[#8d969e]">
                        {job[2]}
                      </small>
                    </div>
                    <div className="min-w-0">
                      <strong className="block truncate">{job[3]}</strong>
                      <small className="mt-1 block text-[9px] text-[#8d969e]">
                        <span className="material-symbols-outlined align-middle text-[10px]">location_on</span> {job[4]}
                      </small>
                    </div>
                      <div className="flex items-center gap-2">
                      <span
                        className={`grid h-7 w-7 place-items-center rounded-full text-[9px] font-bold text-white ${index === 1 ? "bg-[#17549e]" : "bg-[#e24f52]"}`}
                      >
                        {job[5]}
                      </span>
                      <span>{job[6]}</span>
                      <b className="ml-1 rounded-[3px] bg-[#d9e8fa] px-[5px] py-1 text-[8px] text-[#15519c]">
                        {job[7]}
                      </b>
                    </div>
                    <span
                      className={`w-max rounded-[9px] px-3 py-1.5 text-[8px] ${job[8] === "Available" ? "border border-[#8bdba2] bg-[#dff8e5] text-[#18823a]" : "border border-[#ff9f8f] bg-[#ffe0da] text-[#d75342]"}`}
                    >
                      ◎ {job[8]}
                    </span>
                    <span className="material-symbols-outlined text-[20px] text-[#15519c]">chevron_right</span>
                  </div>
                ))}
              </div>
            </section>

            <aside className="min-h-[290px] overflow-hidden rounded-[11px] border border-[#dfe6ec] bg-[#f8fbff] p-5 shadow-[0_3px_7px_rgb(31_59_82_/_10%)] max-[1024px]:min-h-[360px] max-[1024px]:bg-[#063b7c] max-[1024px]:p-3 max-[620px]:min-h-0 max-[620px]:rounded-[7px]">
              <header className="flex justify-between">
                <div>
                  <p className={`${label} max-[1024px]:text-[#dbeafa]`}>Needs attention</p>
                  <h2 className="m-0 mt-1 text-[21px] font-bold max-[1024px]:text-white max-[1024px]:text-[13px]">
                    Operation pulse
                  </h2>
                </div>
                <span className="grid h-[26px] w-[26px] place-items-center rounded-[6px] bg-white text-lg max-[1024px]:hidden">
                  <span className="material-symbols-outlined text-[18px]">shield</span>
                </span>
              </header>
              <div className="mt-[22px] max-[1024px]:mt-3">
                {[
                  [
                    "warning",
                    "text-[#ff725f]",
                    "3 parts below reorder point",
                    "CDI Alarm, Microchip",
                  ],
                  [
                    "assignment",
                    "text-[#2467ae]",
                    "4 reports in review queue",
                    "1 has missing client sign-off",
                  ],
                  [
                    "account_balance",
                    "text-[#063b7c]",
                    "₱64,343 outstanding",
                    "2 invoice due this cycle",
                  ],
                ].map(([icon, color, title, note]) => (
                  <a
                    className="mb-3 flex min-h-[50px] items-center gap-2 rounded-[5px] border border-[#dbe0e5] bg-white p-2.5 text-[#063b7c] no-underline max-[1024px]:mb-2 max-[1024px]:min-h-[47px] max-[1024px]:p-2"
                    href="#attention"
                    key={title}
                  >
                    <span className={`w-5 text-center text-[13px] ${color}`}>
                      <span className="material-symbols-outlined text-[18px]">{icon}</span>
                    </span>
                    <strong className="flex-1 text-[10px] max-[1024px]:text-[8px]">
                      {title}
                      <small className="mt-1 block text-[9px] font-normal text-[#8a929a] max-[1024px]:text-[7px]">
                        {note}
                      </small>
                    </strong>
                    <b className="material-symbols-outlined text-[17px] font-normal text-[#a6adb3]">chevron_right</b>
                  </a>
                ))}
              </div>
              <div className="mt-5 border-t border-[#d2d9e0]" />
            </aside>
          </div>
          <footer className="mt-6 border-t border-[#c9d4de] pt-3 text-[9px] text-[#8a9299] max-[1024px]:hidden">
            Guard-All Electronic Security Systems, Inc.
          </footer>
        </div>
        <nav className="hidden max-[1024px]:fixed max-[1024px]:bottom-0 max-[1024px]:left-0 max-[1024px]:right-0 max-[1024px]:z-10 max-[1024px]:grid max-[1024px]:grid-cols-5 max-[1024px]:border-t max-[1024px]:border-[#d5dfe8] max-[1024px]:bg-white max-[1024px]:py-2 max-[620px]:py-1" aria-label="Mobile navigation"><a className="flex flex-col items-center text-[7px] font-bold text-[#174f9a] no-underline" href="/dashboard"><span className="material-symbols-outlined text-[17px]">dashboard</span>Dash</a><a className="flex flex-col items-center text-[7px] text-[#8a9299] no-underline" href="/scheduling"><span className="material-symbols-outlined text-[17px]">calendar_month</span>Schedule</a><a className="flex flex-col items-center text-[7px] text-[#8a9299] no-underline" href="/inventory"><span className="material-symbols-outlined text-[17px]">inventory_2</span>Inventory</a><a className="flex flex-col items-center text-[7px] text-[#8a9299] no-underline" href="/billing"><span className="material-symbols-outlined text-[17px]">sell</span>Billing</a><a className="flex flex-col items-center text-[7px] text-[#8a9299] no-underline" href="/reports"><span className="material-symbols-outlined text-[17px]">assignment</span>Reports</a></nav>
      </section>
    </main>
  );
}

export default Dashboard;
