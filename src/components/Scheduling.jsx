import { useState } from "react";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";

const technicianOptions = [
  "Jordan Lee",
  "Maya Santos",
  "Donnie Ramos",
  "Lanie Santos",
];

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

function formatMonthLabel(date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatSelectedDate(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function Scheduling() {
  const [selectedOrder, setSelectedOrder] = useState("WO-88431");
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const [priority, setPriority] = useState("Normal");
  const [clientType, setClientType] = useState("Individual");
  const [technicians, setTechnicians] = useState([""]);

  // State to manage active view mode ('list' | 'calendar')
  const [viewMode, setViewMode] = useState("list");
  const [isShortageOptionsOpen, setIsShortageOptionsOpen] = useState(false);
  const [shortageResolution, setShortageResolution] = useState(null);
  const [rangeStart, setRangeStart] = useState(new Date(2026, 8, 1));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(
    new Date(2026, 8, 1),
  );

  const rangeEnd = new Date(
    rangeStart.getFullYear(),
    rangeStart.getMonth(),
    rangeStart.getDate() + 9,
  );
  const scheduledJobsInRange = schedule.filter((job) => {
    const jobDate = scheduledJobDates[job[3]];
    return jobDate >= rangeStart && jobDate <= rangeEnd;
  });
  const calendarMonthStart = new Date(
    rangeStart.getFullYear(),
    rangeStart.getMonth(),
    1,
  );
  const calendarDaysInMonth = new Date(
    calendarMonthStart.getFullYear(),
    calendarMonthStart.getMonth() + 1,
    0,
  ).getDate();
  const calendarLeadingDays = calendarMonthStart.getDay();
  const calendarDays = Array.from(
    { length: calendarLeadingDays + calendarDaysInMonth },
    (_, index) =>
      index < calendarLeadingDays
        ? null
        : new Date(
            calendarMonthStart.getFullYear(),
            calendarMonthStart.getMonth(),
            index - calendarLeadingDays + 1,
          ),
  );
  const selectedDayJobs = schedule.filter(
    (job) =>
      getDateKey(scheduledJobDates[job[3]]) === getDateKey(selectedCalendarDate),
  );
  const scheduledJobsInCalendarMonth = schedule.filter((job) => {
    const jobDate = scheduledJobDates[job[3]];
    return (
      jobDate.getFullYear() === calendarMonthStart.getFullYear() &&
      jobDate.getMonth() === calendarMonthStart.getMonth()
    );
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

  function changeCalendarMonth(monthOffset) {
    const nextMonth = new Date(
      rangeStart.getFullYear(),
      rangeStart.getMonth() + monthOffset,
      1,
    );
    setRangeStart(nextMonth);
    setSelectedCalendarDate(nextMonth);
  }

  function handleCalendarDateClick(date) {
    setSelectedCalendarDate(date);
    const firstJobOnDate = schedule.find(
      (job) => getDateKey(scheduledJobDates[job[3]]) === getDateKey(date),
    );
    if (firstJobOnDate) {
      setSelectedOrder(firstJobOnDate[3]);
    }
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
                    onClick={() =>
                      viewMode === "calendar"
                        ? changeCalendarMonth(-1)
                        : changeDateRange(-10)
                    }
                    aria-label="Previous date range"
                    className="grid h-9 w-9 place-items-center rounded-[6px] border border-[#e5e9ed] bg-white text-[#89939b] max-[620px]:hidden"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      chevron_left
                    </span>
                  </button>
                  <div>
                    <strong className="text-[15px] max-[1024px]:text-[12px] max-[620px]:text-[11px]">
                      {viewMode === "calendar"
                        ? formatMonthLabel(calendarMonthStart)
                        : formatDateRange(rangeStart, rangeEnd)}
                    </strong>
                    <small className="block text-[10px] text-[#8f989f] max-[1024px]:text-[8px]">
                      {viewMode === "calendar"
                        ? `${scheduledJobsInCalendarMonth.length} jobs scheduled this month`
                        : `10-day period · ${scheduledJobsInRange.length} jobs scheduled`}
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      viewMode === "calendar"
                        ? changeCalendarMonth(1)
                        : changeDateRange(10)
                    }
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
                      {calendarDays.map((date, index) => {
                        if (!date) {
                          return <div key={`empty-${index}`} className="bg-[#f8fbff]" />;
                        }

                        const jobsOnDate = schedule.filter(
                          (job) =>
                            getDateKey(scheduledJobDates[job[3]]) ===
                            getDateKey(date),
                        );
                        const isSelected =
                          getDateKey(date) === getDateKey(selectedCalendarDate);

                        return (
                          <button
                            key={getDateKey(date)}
                            type="button"
                            onClick={() => handleCalendarDateClick(date)}
                            aria-label={`${formatSelectedDate(date)}${jobsOnDate.length ? `, ${jobsOnDate.length} jobs` : ""}`}
                            className={`flex h-[56px] flex-col justify-between p-1 text-left transition-colors max-[1024px]:h-[50px] max-[620px]:h-[44px] max-[620px]:p-0.5 ${
                              isSelected
                                ? "bg-[#e5effc] ring-2 ring-inset ring-[#1250a0]"
                                : "bg-white hover:bg-[#f0f5fb]"
                            }`}
                          >
                            <span
                              className={`text-[10px] font-bold max-[620px]:text-[8px] ${
                                isSelected ? "text-[#1250a0]" : "text-[#818b94]"
                              }`}
                            >
                              {date.getDate()}
                            </span>
                            {jobsOnDate.length > 0 && (
                              <span className="mt-auto truncate rounded bg-[#1250a0]/10 px-1 py-0.5 text-[8px] font-bold text-[#1250a0] max-[620px]:text-[7px] max-[620px]:px-0.5">
                                {jobsOnDate.length} {jobsOnDate.length === 1 ? "Job" : "Jobs"}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <section className="mt-3 rounded-[8px] border border-[#e1e6eb] bg-[#fbfdff] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="m-0 text-[12px] font-bold text-[#263747]">
                          Jobs on {formatSelectedDate(selectedCalendarDate)}
                        </h3>
                        <span className="text-[10px] font-semibold text-[#7f8992]">
                          {selectedDayJobs.length} {selectedDayJobs.length === 1 ? "job" : "jobs"}
                        </span>
                      </div>
                      {selectedDayJobs.length > 0 ? (
                        <div className="mt-2 divide-y divide-[#e5e8eb]">
                          {selectedDayJobs.map(([time, , client, order, service]) => (
                            <button
                              key={order}
                              type="button"
                              onClick={() => setSelectedOrder(order)}
                              className={`flex w-full items-center gap-3 py-2 text-left ${
                                selectedOrder === order ? "text-[#1250a0]" : "text-[#45515c]"
                              }`}
                            >
                              <strong className="w-11 flex-none text-[11px]">{time}</strong>
                              <span className="min-w-0 flex-1">
                                <strong className="block truncate text-[11px]">{client}</strong>
                                <span className="block truncate text-[10px] text-[#89939b]">
                                  {service} · {order}
                                </span>
                              </span>
                              <span className="material-symbols-outlined text-[17px] text-[#a6afb8]">
                                chevron_right
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="m-0 mt-2 text-[11px] text-[#89939b]">
                          No scheduled jobs for this day.
                        </p>
                      )}
                    </section>
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
              <div className="mb-4 grid grid-cols-2 gap-4 max-[620px]:grid-cols-1 max-[620px]:gap-3">
                <label className="text-[14px] font-medium text-[#a9bfd9]">
                  First name <span className="text-[#ff6557]">*</span>
                  <input
                    required
                    name="firstName"
                    placeholder="First name"
                    className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                  />
                </label>
                <label className="text-[14px] font-medium text-[#a9bfd9]">
                  Last name <span className="text-[#ff6557]">*</span>
                  <input
                    required
                    name="lastName"
                    placeholder="Last name"
                    className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                  />
                </label>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-4 max-[620px]:grid-cols-1 max-[620px]:gap-3">
                <label className="text-[14px] font-medium text-[#a9bfd9]">
                  Client Type <span className="text-[#ff6557]">*</span>
                  <select
                    required
                    name="clientType"
                    value={clientType}
                    onChange={(event) => setClientType(event.target.value)}
                    className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none focus:border-[#4d88e8]"
                  >
                    <option>Individual</option>
                    <option>Company</option>
                  </select>
                </label>
                <label className="text-[14px] font-medium text-[#a9bfd9]">
                  Company Name
                  <input
                    name="companyName"
                    disabled={clientType !== "Company"}
                    required={clientType === "Company"}
                    placeholder="Company name"
                    className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8] disabled:cursor-not-allowed disabled:opacity-45"
                  />
                </label>
              </div>
              
              <label className="mb-4 block text-[14px] font-medium text-[#a9bfd9]">
                Address <span className="text-[#ff6557]">*</span>
                <input
                  required
                  autoFocus
                  name="address"
                  placeholder="Site or client address"
                  className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                />
              </label>

              <div className="mb-4 grid grid-cols-2 gap-4 max-[620px]:grid-cols-1 max-[620px]:gap-3">
                <label className="text-[14px] font-medium text-[#a9bfd9]">
                  Contact email <span className="text-[#ff6557]">*</span>
                  <input
                    required
                    name="contactEmail"
                    type="email"
                    placeholder="name@example.com"
                    className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                  />
                </label>
                <label className="text-[14px] font-medium text-[#a9bfd9]">
                  Phone number <span className="text-[#ff6557]">*</span>
                  <input
                    required
                    name="phoneNumber"
                    type="tel"
                    placeholder="09XX XXX XXXX"
                    className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                  />
                </label>
              </div>


              <div className="mb-4 grid grid-cols-2 gap-4 max-[620px]:grid-cols-1 max-[620px]:gap-3">
                <label className="col-span-2 text-[14px] font-medium text-[#a9bfd9] max-[620px]:col-span-1">
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
              </div>
              
              <div className="mb-4 grid grid-cols-2 gap-4 max-[620px]:gap-3">
                <label className="text-[14px] font-medium text-[#a9bfd9]">
                  Date <span className="text-[#ff6557]">*</span>
                  <input
                    required
                    type="date"
                    name="date"
                    value={getDateKey(selectedCalendarDate)}
                    readOnly
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

              <fieldset className="border-0 p-0">
                <div className="flex items-center justify-between gap-3">
                  <legend className="text-[14px] font-medium text-[#a9bfd9]">
                    Assign technicians <span className="text-[12px] text-[#7188a4]">(optional)</span>
                  </legend>
                  <button
                    type="button"
                    onClick={() => setTechnicians((current) => [...current, ""])}
                    className="rounded-[8px] border border-[#4d88e8] px-3 py-2 text-[12px] font-semibold text-[#9fc4ff] hover:bg-[#1d3351]"
                  >
                    + Add technician
                  </button>
                </div>
                <div className="mt-2 grid gap-2">
                  {technicians.map((technician, index) => (
                    <div className="flex items-center gap-2" key={`technician-${index}`}>
                      <select
                        name="technicians"
                        value={technician}
                        onChange={(event) =>
                          setTechnicians((current) =>
                            current.map((value, currentIndex) =>
                              currentIndex === index ? event.target.value : value,
                            ),
                          )
                        }
                        className="h-12 min-w-0 flex-1 rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none focus:border-[#4d88e8]"
                      >
                        <option value="">Select a technician</option>
                        {technicianOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      {technicians.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Remove technician ${index + 1}`}
                          onClick={() =>
                            setTechnicians((current) =>
                              current.filter((_, currentIndex) => currentIndex !== index),
                            )
                          }
                          className="grid h-10 w-10 flex-none place-items-center rounded-[8px] text-[#91a8c7] hover:bg-[#1d3351] hover:text-white"
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            delete
                          </span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </fieldset>
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
