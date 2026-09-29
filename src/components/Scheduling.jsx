import { useState } from "react";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";

const schedule = [
  [
    "09:00",
    "TODAY",
    "Harborview Residences",
    "WO-88429",
    "Preventive maintenance",
    "Makati - Tower 2",
    "Maya Santos",
    "Available",
  ],
  [
    "10:30",
    "TODAY",
    "Northbridge Dental Clinic",
    "WO-88431",
    "Service call",
    "Makati - West Avenue",
    "Jordan Lee",
    "1 Shortage",
  ],
  [
    "13:00",
    "TODAY",
    "Pioneer Cold Storage",
    "WO-88432",
    "CCTV expansion",
    "Cebu - Mandaue",
    "Donnie Ramos",
    "Available",
  ],
  [
    "08:30",
    "TOMORROW",
    "Lakeside Corporate Center",
    "WO-88433",
    "Access control install",
    "Makati - BGC",
    "Lanie Santos",
    "Review",
  ],
  [
    "09:00",
    "TOMORROW",
    "St. Catherine Hospital",
    "WO-88434",
    "Quarterly inspection",
    "Cebu - Lahug",
    "Jun Reyes",
    "Available",
  ],
];

const scheduledJobDates = {
  "WO-88429": new Date(2026, 8, 1),
  "WO-88431": new Date(2026, 8, 1),
  "WO-88432": new Date(2026, 8, 1),
  "WO-88433": new Date(2026, 8, 2),
  "WO-88434": new Date(2026, 8, 2),
};

function getIsoWeek(date) {
  const weekDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayOfWeek = weekDate.getUTCDay() || 7;
  weekDate.setUTCDate(weekDate.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(weekDate.getUTCFullYear(), 0, 1));
  return Math.ceil(((weekDate - yearStart) / 86400000 + 1) / 7);
}

function formatDateRange(startDate, endDate) {
  const startMonth = startDate.toLocaleString("en-US", { month: "long" });
  const endMonth = endDate.toLocaleString("en-US", { month: "long" });

  if (
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getFullYear() === endDate.getFullYear()
  ) {
    return `${startDate.getDate()}-${endDate.getDate()} ${startMonth} ${startDate.getFullYear()}`;
  }

  return `${startDate.getDate()} ${startMonth} - ${endDate.getDate()} ${endMonth} ${endDate.getFullYear()}`;
}

function Scheduling() {
  const [selectedOrder, setSelectedOrder] = useState("WO-88431");
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const [priority, setPriority] = useState("Normal");

  // State to manage active view mode ('list' | 'calendar')
  const [viewMode, setViewMode] = useState("list");
  const [isShortageOptionsOpen, setIsShortageOptionsOpen] = useState(false);
  const [shortageResolution, setShortageResolution] = useState(null);
  const [rangeStart, setRangeStart] = useState(new Date(2026, 8, 1));

  const rangeEnd = new Date(
    rangeStart.getFullYear(),
    rangeStart.getMonth(),
    rangeStart.getDate() + 14,
  );
  const scheduledJobsInRange = schedule.filter((job) => {
    const jobDate = scheduledJobDates[job[3]];
    return jobDate >= rangeStart && jobDate <= rangeEnd;
  });

  function changeDateRange(dayOffset) {
    setRangeStart(
      (currentStart) =>
        new Date(
          currentStart.getFullYear(),
          currentStart.getMonth(),
          currentStart.getDate() + dayOffset,
        ),
    );
  }

  const selectedJob =
    schedule.find((job) => job[3] === selectedOrder) ?? schedule[1];
  const isShortageResolved =
    selectedJob[3] === "WO-88431" && Boolean(shortageResolution);

  function handleShortageResolution(resolution) {
    setShortageResolution(resolution);
    setIsShortageOptionsOpen(false);
  }

  return (
    <main className="flex h-screen overflow-hidden bg-[#202123] font-sans text-[#174f9a] max-[1024px]:block">
      <Sidebar />

      <section className="h-screen min-w-0 flex-1 overflow-y-auto bg-[#edf7ff]">
        <TopBar />
        <div className="px-8 pb-6 pt-8 max-[1024px]:px-6 max-[1024px]:pb-20 max-[1024px]:pt-5 max-[620px]:px-3">
          <div className="mb-7 flex items-end justify-between gap-5 max-[620px]:mb-4 max-[620px]:items-start">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[.1em] text-[#818b94] max-[620px]:text-[7px]">
                Operations / Jobs
              </p>
              <h1 className="m-0 text-[30px] font-bold tracking-[-.5px] max-[1024px]:text-[24px] max-[620px]:text-[19px]">
                Scheduling
              </h1>
              <p className="mb-0 mt-2 text-[14px] text-[#8b949c] max-[620px]:mt-1 max-[620px]:text-[9px]">
                Put the right technician and parts on every site visit.
              </p>
            </div>
            <div className="flex items-center gap-6 max-[620px]:self-end">
              <button
                type="button"
                onClick={() => setIsCreateJobOpen(true)}
                className="rounded-[6px] bg-[#1250a0] px-5 py-3 text-[12px] font-bold text-white shadow-[0_2px_4px_rgb(18_80_160_/_25%)] max-[1024px]:px-4 max-[1024px]:py-2 max-[620px]:text-[9px]"
              >
                + Create Job
              </button>
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] gap-[18px] max-[620px]:grid-cols-1">
            <section className="flex flex-col overflow-hidden rounded-[12px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_14%)]">
              <header className="flex h-[84px] shrink-0 items-center justify-between border-b border-[#e1e6eb] px-6 max-[1024px]:h-[57px] max-[1024px]:px-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => changeDateRange(-15)}
                    aria-label="Previous date range"
                    className="grid h-9 w-9 place-items-center rounded-[6px] border border-[#e5e9ed] bg-white text-[#89939b] max-[620px]:hidden"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      chevron_left
                    </span>
                  </button>
                  <div>
                    <strong className="text-[15px] max-[1024px]:text-[12px] max-[620px]:text-[11px]">
                      {formatDateRange(rangeStart, rangeEnd)}
                    </strong>
                    <small className="block text-[10px] text-[#8f989f] max-[1024px]:text-[8px]">
                      Week {getIsoWeek(rangeStart)} ·{" "}
                      {scheduledJobsInRange.length} jobs scheduled
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={() => changeDateRange(15)}
                    aria-label="Next date range"
                    className="grid h-9 w-9 place-items-center rounded-[6px] border border-[#e5e9ed] bg-white text-[#89939b] max-[620px]:hidden"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      chevron_right
                    </span>
                  </button>
                </div>

                {/* Dynamic Toggle Controls */}
                <div className="flex rounded-[7px] bg-[#f4f7fb] p-1 text-[11px] font-bold max-[1024px]:text-[9px]">
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`rounded-[6px] px-4 py-2 transition-all max-[1024px]:px-3 max-[1024px]:py-1.5 ${
                      viewMode === "list"
                        ? "bg-white text-[#174f9a] shadow-sm"
                        : "text-[#82909c] hover:text-[#174f9a]"
                    }`}
                  >
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("calendar")}
                    className={`rounded-[6px] px-4 py-2 transition-all max-[1024px]:px-3 max-[1024px]:py-1.5 ${
                      viewMode === "calendar"
                        ? "bg-white text-[#174f9a] shadow-sm"
                        : "text-[#82909c] hover:text-[#174f9a]"
                    }`}
                  >
                    Calendar
                  </button>
                </div>
              </header>

              {/* Uniform Responsive Container Height for both Views */}
              <div className="h-[430px] overflow-y-auto max-[1024px]:h-[380px] max-[620px]:h-[350px]">
                {viewMode === "list" ? (
                  <div className="divide-y divide-[#e5e8eb]">
                    {scheduledJobsInRange.map(
                      ([
                        time,
                        day,
                        client,
                        order,
                        service,
                        location,
                        technician,
                        stock,
                      ]) => {
                        const isSelected = selectedOrder === order;
                        const isShortage =
                          stock === "1 Shortage" &&
                          !(order === "WO-88431" && shortageResolution);
                        return (
                          <button
                            type="button"
                            className={`flex min-h-[82px] w-full items-center gap-4 px-6 py-3 text-left transition-colors max-[1024px]:px-3 max-[620px]:gap-2 max-[620px]:p-2.5 ${
                              isSelected
                                ? "bg-[#f0f5fb]"
                                : "bg-white hover:bg-[#f8fbff]"
                            }`}
                            key={order}
                            onClick={() => setSelectedOrder(order)}
                          >
                            <div className="w-[70px] flex-none max-[1024px]:w-[50px]">
                              <strong className="block text-[14px] max-[1024px]:text-[11px] max-[620px]:text-[10px]">
                                {time}
                              </strong>
                              <small className="text-[10px] text-[#929aa1] max-[1024px]:text-[8px]">
                                {day}
                              </small>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline gap-1.5">
                                <strong className="truncate text-[13px] max-[1024px]:text-[11px] max-[620px]:text-[10px]">
                                  {client}
                                </strong>
                                <small className="text-[10px] text-[#8c969f] max-[1024px]:text-[8px]">
                                  {order}
                                </small>
                              </div>
                              <p className="m-0 mt-0.5 truncate text-[10px] text-[#8b949c] max-[1024px]:text-[8px]">
                                {service} · {location}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-[#7f8992] max-[1024px]:gap-2 max-[1024px]:text-[8px]">
                                <span className="truncate">
                                  <span className="material-symbols-outlined mr-0.5 align-middle text-[14px]">
                                    person
                                  </span>
                                  {technician}
                                </span>
                                <span
                                  className={`truncate ${
                                    isShortage
                                      ? "text-[#e45e4e]"
                                      : "text-[#5e8e70]"
                                  }`}
                                >
                                  <span className="material-symbols-outlined mr-0.5 align-middle text-[14px]">
                                    {isShortage ? "warning" : "inventory_2"}
                                  </span>
                                  {order === "WO-88431" && shortageResolution
                                    ? "Resolved"
                                    : stock}
                                </span>
                              </div>
                            </div>
                            <span className="material-symbols-outlined text-[20px] text-[#a6afb8]">
                              chevron_right
                            </span>
                          </button>
                        );
                      },
                    )}
                  </div>
                ) : (
                  /* Mobile Responsive Calendar Grid Component */
                  <div className="p-3 max-[620px]:p-1.5">
                    <div className="grid grid-cols-7 gap-1 rounded-lg border border-[#e1e6eb] bg-[#e1e6eb] text-center text-[11px] font-semibold max-[620px]:text-[9px]">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (day) => (
                          <div
                            key={day}
                            className="bg-[#f8fbff] py-1 text-[#7f8992]"
                          >
                            <span className="max-[420px]:hidden">{day}</span>
                            <span className="hidden max-[420px]:inline">
                              {day[0]}
                            </span>
                          </div>
                        ),
                      )}
                      {Array.from({ length: 30 }).map((_, i) => {
                        const dayNumber = i + 1;
                        const hasJobs = dayNumber === 1 || dayNumber === 2;
                        return (
                          <div
                            key={i}
                            className="flex h-[56px] flex-col justify-between bg-white p-1 text-left transition-colors hover:bg-[#f0f5fb] max-[1024px]:h-[50px] max-[620px]:h-[44px] max-[620px]:p-0.5"
                          >
                            <span className="text-[10px] font-bold text-[#818b94] max-[620px]:text-[8px]">
                              {dayNumber}
                            </span>
                            {hasJobs && (
                              <div className="mt-auto truncate rounded bg-[#1250a0]/10 px-1 py-0.5 text-[8px] font-bold text-[#1250a0] max-[620px]:text-[7px] max-[620px]:px-0.5">
                                {dayNumber === 1 ? "3 Jobs" : "2 Jobs"}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <aside className="min-h-[518px] rounded-[12px] border border-[#dfe6ec] bg-[#f9fbfd] p-5 shadow-[0_3px_8px_rgb(31_59_82_/_10%)] max-[1024px]:min-h-[455px] max-[1024px]:p-4 max-[620px]:min-h-0 max-[620px]:rounded-[7px] max-[620px]:p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="m-0 text-[10px] uppercase tracking-[.08em] text-[#87929c]">
                    Selected work order
                  </p>
                  <small className="mt-2 block text-[10px] font-bold text-[#50719a]">
                    {selectedJob[3]}
                  </small>
                  <h2 className="m-0 mt-2 text-[23px] font-bold leading-tight max-[1024px]:text-[17px]">
                    {selectedJob[2]}
                  </h2>
                  <p className="m-0 mt-2 text-[10px] text-[#8a949c]">
                    <span className="material-symbols-outlined mr-1 align-middle text-[15px]">
                      location_on
                    </span>
                    {selectedJob[5]}
                  </p>
                </div>
                <span className="rounded-[6px] bg-white px-3 py-2 text-[9px] text-[#6d879f] shadow-sm">
                  TODAY
                </span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2 max-[1024px]:mt-4">
                <div className="rounded-[6px] bg-white p-3 shadow-sm">
                  <small className="block text-[9px] uppercase text-[#89939c]">
                    Service type
                  </small>
                  <strong className="mt-1 block text-[13px] max-[1024px]:text-[10px]">
                    {selectedJob[4]}
                  </strong>
                </div>
                <div className="rounded-[6px] bg-white p-3 shadow-sm">
                  <small className="block text-[9px] uppercase text-[#89939c]">
                    Technician
                  </small>
                  <strong className="mt-1 block text-[13px]">
                    {selectedJob[6]}
                  </strong>
                </div>
              </div>

              {!isShortageResolved ? (
                <div className="mt-3 rounded-[7px] border border-[#ff8f7c] bg-[#fff0ed] p-3 text-[#df6657]">
                  <strong className="flex items-center gap-2 text-[12px] max-[1024px]:text-[9px]">
                    <span className="material-symbols-outlined text-[17px]">
                      info
                    </span>
                    Real-time stock check: shortage found
                  </strong>
                  <p className="m-0 mt-2 text-[10px] leading-relaxed max-[1024px]:text-[8px]">
                    DMP-145 PIR Motion Detector is 2 units short in Makati.
                    Requisition or swap the branch before confirming.
                  </p>
                  <a
                    className="mt-2 block text-[10px] font-bold text-[#d35e50]"
                    href="#shortage"
                    onClick={(event) => {
                      event.preventDefault();
                      setIsShortageOptionsOpen(true);
                    }}
                  >
                    View shortage options{" "}
                    <span className="material-symbols-outlined align-middle text-[15px]">
                      chevron_right
                    </span>
                  </a>
                </div>
              ) : (
                <div className="mt-3 rounded-[7px] border border-[#a9d7b4] bg-[#eff9f1] p-3 text-[#39734b]">
                  <strong className="flex items-center gap-2 text-[11px]">
                    <span className="material-symbols-outlined text-[16px]">
                      check_circle
                    </span>
                    Shortage resolved
                  </strong>
                  <p className="m-0 mt-1 text-[9px]">{shortageResolution}</p>
                </div>
              )}

              <button
                type="button"
                disabled={!isShortageResolved}
                className={`mt-3 flex w-full items-center justify-center gap-2 rounded-[6px] py-3 text-[12px] font-bold text-white max-[1024px]:py-2 max-[1024px]:text-[9px] ${
                  isShortageResolved
                    ? "bg-[#1250a0] hover:bg-[#0e4388]"
                    : "cursor-not-allowed bg-[#86a7d5]"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  check
                </span>
                Confirm assignment
              </button>
            </aside>
          </div>

          <footer className="mt-8 border-t border-[#c9d4de] pt-3 text-[9px] text-[#8a9299] max-[1024px]:hidden">
            Guard-All Electronic Security Systems, Inc.
          </footer>
        </div>

      </section>

      {isShortageOptionsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsShortageOptionsOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            className="w-full max-w-[440px] rounded-[10px] border border-[#dfe6ec] bg-white p-5 text-[#174f9a] shadow-[0_16px_48px_rgb(7_20_38_/_30%)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="m-0 text-[10px] font-bold uppercase tracking-[.08em] text-[#87929c]">
                  WO-88431 · DMP-145
                </p>
                <h2
                  id="shortage-options-title"
                  className="m-0 mt-1 text-[20px] font-bold"
                >
                  Resolve stock shortage
                </h2>
                <p className="m-0 mt-2 text-[12px] text-[#718090]">
                  Choose how to resolve the 2-unit shortage for Makati.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsShortageOptionsOpen(false)}
                className="text-[24px] leading-none text-[#718090] hover:text-[#174f9a]"
              >
                ×
              </button>
            </div>
            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={() =>
                  handleShortageResolution("Requisition stock to Makati")
                }
                className="rounded-[6px] border border-[#dfe6ec] p-3 text-left hover:border-[#1250a0] hover:bg-[#f5f9ff]"
              >
                <strong className="block text-[13px]">
                  Requisition stock to Makati
                </strong>
                <span className="mt-1 block text-[11px] text-[#718090]">
                  Request 2 units of DMP-145 from a neighboring branch.
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleShortageResolution("Swap branch")}
                className="rounded-[6px] border border-[#dfe6ec] p-3 text-left hover:border-[#1250a0] hover:bg-[#f5f9ff]"
              >
                <strong className="block text-[13px]">Swap branch</strong>
                <span className="mt-1 block text-[11px] text-[#718090]">
                  Reassign this work order to a branch with available stock.
                </span>
              </button>
            </div>
          </section>
        </div>
      )}

      {isCreateJobOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/75 p-4 backdrop-blur-[2px] max-[620px]:items-end max-[620px]:p-0"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsCreateJobOpen(false);
          }}
        >
          <section
            role="dialog"
            className="flex max-h-[92vh] w-full max-w-[890px] flex-col overflow-hidden rounded-[17px] border border-[#263c5a] bg-[#172a44] text-[#e5edf8] shadow-[0_24px_80px_rgb(0_0_0_/_45%)] max-[620px]:max-h-[94vh] max-[620px]:rounded-b-none max-[620px]:rounded-t-[16px]"
          >
            <header className="flex shrink-0 items-start justify-between border-b border-[#293d58] px-7 py-5 max-[620px]:px-5 max-[620px]:py-4">
              <div>
                <p className="m-0 text-[12px] font-semibold uppercase tracking-[.1em] text-[#91a8c7]">
                  Operations / Jobs
                </p>
                <h2
                  id="create-job-title"
                  className="m-0 mt-1 text-[27px] font-bold text-[white] max-[620px]:text-[23px]"
                >
                  Create Job
                </h2>
                <p className="m-0 mt-1 text-[15px] text-[#9aafc9]">
                  Put the right technician and parts on every site visit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateJobOpen(false)}
                className="grid h-8 w-8 place-items-center text-[27px] leading-none text-[#91a8c7] hover:text-white"
              >
                ×
              </button>
            </header>

            <form
              id="create-job-form"
              className="min-h-0 flex-1 overflow-y-auto px-7 py-5 max-[620px]:px-5"
              onSubmit={(event) => {
                event.preventDefault();
                setIsCreateJobOpen(false);
              }}
            >
              <label className="mb-4 block text-[14px] font-medium text-[#a9bfd9]">
                Client / Site <span className="text-[#ff6557]">*</span>
                <input
                  required
                  autoFocus
                  placeholder="Search client or site name..."
                  className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                />
              </label>

              <div className="mb-4 grid grid-cols-2 gap-4 max-[620px]:grid-cols-1 max-[620px]:gap-3">
                <label className="text-[14px] font-medium text-[#a9bfd9]">
                  Service type <span className="text-[#ff6557]">*</span>
                  <select
                    defaultValue="Service call"
                    className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none focus:border-[#4d88e8]"
                  >
                    <option>Service call</option>
                    <option>Preventive maintenance</option>
                    <option>Installation</option>
                    <option>Inspection</option>
                  </select>
                </label>
                <label className="text-[14px] font-medium text-[#a9bfd9]">
                  Branch <span className="text-[#ff6557]">*</span>
                  <select
                    defaultValue="Makati - Metro Manila"
                    className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none focus:border-[#4d88e8]"
                  >
                    <option>Makati - Metro Manila</option>
                    <option>Cebu - Mandaue</option>
                  </select>
                </label>
              </div>

              <fieldset className="mb-4 border-0 p-0">
                <legend className="mb-1.5 text-[14px] font-medium text-[#a9bfd9]">
                  Priority
                </legend>
                <div className="grid grid-cols-4 gap-2 max-[420px]:grid-cols-2">
                  {["Low", "Normal", "High", "Urgent"].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setPriority(level)}
                      className={`h-12 rounded-[10px] border text-[15px] transition-colors ${priority === level ? "border-[#4d88e8] bg-[#4d88e8] text-white" : "border-[#293f5d] bg-[#1d3351] text-[#e5edf8] hover:border-[#4d88e8]"}`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="mb-4 grid grid-cols-2 gap-4 max-[620px]:gap-3">
                <label className="text-[14px] font-medium text-[#a9bfd9]">
                  Date <span className="text-[#ff6557]">*</span>
                  <input
                    required
                    type="date"
                    defaultValue="2026-09-30"
                    className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none focus:border-[#4d88e8]"
                  />
                </label>
                <label className="text-[14px] font-medium text-[#a9bfd9]">
                  Start time <span className="text-[#ff6557]">*</span>
                  <input
                    required
                    type="time"
                    defaultValue="09:00"
                    className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none focus:border-[#4d88e8]"
                  />
                </label>
              </div>

              <label className="block text-[14px] font-medium text-[#a9bfd9]">
                Assign technician <span className="text-[#ff6557]">*</span>
                <select
                  required
                  defaultValue="Jordan Lee"
                  className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none focus:border-[#4d88e8]"
                >
                  <option>Jordan Lee</option>
                  <option>Maya Santos</option>
                  <option>Donnie Ramos</option>
                  <option>Lanie Santos</option>
                </select>
              </label>
              <p className="mb-5 mt-2 flex items-center gap-2 text-[14px] text-[#27a567]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#27a567]" />
                No conflicts on selected date and time
              </p>

              <label className="mt-4 block text-[14px] font-medium text-[#a9bfd9]">
                Notes for technician
                <textarea
                  rows="3"
                  placeholder="Access instructions, contact person, issue description..."
                  className="mt-1.5 w-full resize-y rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 py-3 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                />
              </label>
            </form>

            <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-[#293d58] bg-[#172a44] px-7 py-4 max-[620px]:flex-col max-[620px]:items-stretch max-[620px]:px-5">
              <span className="text-[14px] text-[#91a8c7]">
                Work order no. WO-88435 (auto)
              </span>
              <div className="flex gap-3 max-[420px]:flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsCreateJobOpen(false)}
                  className="h-[50px] rounded-[10px] border border-[#293f5d] px-5 text-[14px] text-[#e5edf8] hover:bg-[#1d3351]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateJobOpen(false)}
                  className="h-[50px] rounded-[10px] border border-[#293f5d] px-5 text-[14px] text-[#e5edf8] hover:bg-[#1d3351]"
                >
                  Save draft
                </button>
                <button
                  type="submit"
                  form="create-job-form"
                  className="h-[50px] rounded-[10px] bg-[#4d88e8] px-5 text-[14px] font-semibold text-white hover:bg-[#5b96f4] max-[420px]:flex-1"
                >
                  Create job with shortage
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}

export default Scheduling;
