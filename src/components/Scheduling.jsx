import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import { callAuthFunction, getSession } from "../lib/auth.js";

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

function getToday() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function formatSelectedDate(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Sunday-first, matching the Calendar view's column order.
const DAY_LABELS = ["S", "M", "T", "W", "TH", "F", "ST"];

// Row shape shared by the schedule list and the selected-job panel.
// Index order is load-bearing and must stay in sync with mapScheduleRow:
// 0 time, 1 day, 2 client, 3 order, 4 service, 5 location, 6 technician,
// 7 stock, 8 technicians, 9 status, 10 branch, 11 date,
// 12 partsStatus, 13 assignmentConfirmedAt.
function mapScheduleRow(job) {
  return [
    job.time,
    job.dayLabel,
    job.client,
    job.order,
    job.service,
    job.location,
    job.technician,
    job.stock,
    job.technicians,
    job.status,
    job.branch,
    job.date,
    job.partsStatus,
    job.assignmentConfirmedAt,
  ];
}

const STAGE_STYLES = {
  done: "border-[#a8dfb7] bg-[#effaf2] text-[#267340]",
  ready: "border-[#a8dfb7] bg-[#effaf2] text-[#267340]",
  active: "border-[#bcd3ee] bg-[#eef4ff] text-[#1250a0]",
  waiting: "border-[#ffd9a3] bg-[#fff7e8] text-[#a86a12]",
  todo: "border-[#ffc9b8] bg-[#fff3ef] text-[#d0552f]",
};

// Stock is reserved (or not needed), so the job has reached the scheduled stage.
function isStockAllocated(partsStatus) {
  return partsStatus === "confirmed" || partsStatus === "not_required";
}

// Workflow stage shown on the badge:
//   Waiting confirmation -> assignment not confirmed yet
//   Pending              -> confirmed, queued for stock allocation
//   Scheduled            -> stock allocated (parts_status = confirmed)
function getJobStage({ status, partsStatus, assignmentConfirmed }) {
  if (status === "completed") {
    return { label: "Completed", style: STAGE_STYLES.done };
  }
  if (status === "in_progress") {
    return { label: "In progress", style: STAGE_STYLES.active };
  }
  if (isStockAllocated(partsStatus)) {
    return { label: "Scheduled", style: STAGE_STYLES.ready };
  }
  if (assignmentConfirmed) {
    return { label: "Pending", style: STAGE_STYLES.waiting };
  }
  return { label: "Waiting confirmation", style: STAGE_STYLES.todo };
}

function formatShortDate(dateValue) {
  const [year, month, day] = String(dateValue ?? "").split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day)
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}

function capitalizeFirst(value) {
  return String(value ?? "").replace(/^./, (letter) => letter.toUpperCase());
}

function formatLongDate(dateValue) {
  const [year, month, day] = String(dateValue ?? "").split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DetailRow({ icon, label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#eef2f6] px-3 py-2 last:border-b-0">
      <dt className="flex flex-none items-center gap-1.5 text-[10px] uppercase tracking-[.06em] text-[#89939c]">
        <span className="material-symbols-outlined text-[14px]">{icon}</span>
        {label}
      </dt>
      <dd className="m-0 min-w-0 text-right text-[12px] font-semibold text-[#263747]">
        {children}
      </dd>
    </div>
  );
}

function Scheduling() {
  const [selectedOrder, setSelectedOrder] = useState("");
  const [schedule, setSchedule] = useState([]);
  const [scheduledJobDates, setScheduledJobDates] = useState({});
  const [formError, setFormError] = useState("");
  const sessionUser = getSession()?.user;
  const confirmedAssignmentsKey = `confirmed-schedule-assignments:${sessionUser?.id ?? "unknown"}`;
  const [confirmedAssignments, setConfirmedAssignments] = useState(() => {
    try {
      const storedAssignments = JSON.parse(
        localStorage.getItem(confirmedAssignmentsKey) || "[]",
      );
      return new Set(Array.isArray(storedAssignments) ? storedAssignments : []);
    } catch {
      return new Set();
    }
  });
  const navigate = useNavigate();
  // State to manage active view mode ('list' | 'calendar')
  const [viewMode, setViewMode] = useState("list");
  const [rangeStart, setRangeStart] = useState(getToday);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(getToday);
  // Day-of-week filter for the weekly list. null shows the whole week.
  const [dayFilter, setDayFilter] = useState(null);
  const [isConfirmingAssignment, setIsConfirmingAssignment] = useState(false);
  const [confirmError, setConfirmError] = useState({ order: "", message: "" });

  useEffect(() => {
    let isMounted = true;
    callAuthFunction("list-schedules")
      .then(({ schedules }) => {
        if (!isMounted || !schedules) return;
        const nextDates = Object.fromEntries(
          schedules.map((job) => [job.order, new Date(`${job.date}T00:00:00`)]),
        );
        setSchedule(schedules.map(mapScheduleRow));
        setScheduledJobDates(nextDates);
      })
      .catch((error) => {
        if (isMounted) setFormError(error.message);
      });
    return () => {
      isMounted = false;
    };
  }, [confirmedAssignmentsKey]);

  // Weekly list range: the Sunday-Saturday week containing the anchored date.
  const weekStart = new Date(
    rangeStart.getFullYear(),
    rangeStart.getMonth(),
    rangeStart.getDate() - rangeStart.getDay(),
  );
  const weekEnd = new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() + 6,
  );
  const isCurrentWeek =
    getDateKey(getToday()) >= getDateKey(weekStart) &&
    getDateKey(getToday()) <= getDateKey(weekEnd);
  const scheduledJobsInRange = schedule.filter((job) => {
    const jobDate = scheduledJobDates[job[3]];
    return jobDate >= weekStart && jobDate <= weekEnd;
  });
  const weekDays = Array.from({ length: 7 }, (_, index) =>
    new Date(
      weekStart.getFullYear(),
      weekStart.getMonth(),
      weekStart.getDate() + index,
    ),
  );
  const listJobs = dayFilter
    ? scheduledJobsInRange.filter(
        (job) => getDateKey(scheduledJobDates[job[3]]) === dayFilter,
      )
    : scheduledJobsInRange;
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
      getDateKey(scheduledJobDates[job[3]]) ===
      getDateKey(selectedCalendarDate),
  );
  const scheduledJobsInCalendarMonth = schedule.filter((job) => {
    const jobDate = scheduledJobDates[job[3]];
    return (
      jobDate.getFullYear() === calendarMonthStart.getFullYear() &&
      jobDate.getMonth() === calendarMonthStart.getMonth()
    );
  });

  function changeDateRange(dayOffset) {
    setDayFilter(null);
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
    setDayFilter(null);
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

  // The create form opens on the day the scheduler is looking at, so clicking a
  // calendar day or a list day chip carries straight through to it. This is only
  // a starting value — the date stays editable on the form.
  const selectedCalendarKey = getDateKey(selectedCalendarDate);
  const selectedDayInWeek =
    selectedCalendarKey >= getDateKey(weekStart) &&
    selectedCalendarKey <= getDateKey(weekEnd);
  const createDateKey =
    viewMode === "calendar"
      ? selectedCalendarKey
      : (dayFilter ??
        (selectedDayInWeek ? selectedCalendarKey : getDateKey(getToday())));

  const defaultVisibleJob =
    viewMode === "calendar" ? selectedDayJobs[0] : listJobs[0];
  const selectedJob = schedule.find((job) => job[3] === selectedOrder) ??
    defaultVisibleJob ?? [
      "--:--",
      "",
      "No scheduled jobs",
      "",
      "",
      "Select a date to view jobs",
      "Unassigned",
      "Available",
      [],
      "",
      "",
      "",
      "",
      "",
    ];
  const [
    jobTime,
    ,
    jobClient,
    jobOrder,
    jobService,
    jobLocation,
    ,
    jobStock,
    jobTechnicians,
    jobStatus,
    jobBranch,
    jobDate,
    jobPartsStatus,
    jobAssignmentConfirmedAt,
  ] = selectedJob;
  // The DB timestamp is authoritative and shared; the local set only covers the
  // moment between confirming and the next schedule refresh.
  const isAssignmentConfirmed =
    Boolean(jobAssignmentConfirmedAt) || confirmedAssignments.has(jobOrder);
  const selectedJobStage = getJobStage({
    status: jobStatus,
    partsStatus: jobPartsStatus,
    assignmentConfirmed: isAssignmentConfirmed,
  });

  async function handleConfirmAssignment() {
    const order = selectedJob[3];
    if (!order) return;
    setConfirmError({ order: "", message: "" });
    setIsConfirmingAssignment(true);
    try {
      await callAuthFunction("confirm-job-assignment", { jobNumber: order });
    } catch (error) {
      setConfirmError({ order, message: error.message });
      setIsConfirmingAssignment(false);
      return;
    }
    const nextConfirmedAssignments = new Set(confirmedAssignments);
    nextConfirmedAssignments.add(order);
    setConfirmedAssignments(nextConfirmedAssignments);
    localStorage.setItem(
      confirmedAssignmentsKey,
      JSON.stringify([...nextConfirmedAssignments]),
    );
    setIsConfirmingAssignment(false);
    navigate(`/inventory/allocate?job=${encodeURIComponent(order)}`);
  }

  return (
    <main className="flex h-screen overflow-hidden bg-[#202123] font-sans text-[#174f9a] max-[1024px]:block">
      <Sidebar />

      <section className="h-screen w-full min-w-0 flex-1 overflow-y-auto bg-[#edf7ff] max-[1024px]:h-[100dvh]">
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
                onClick={() => navigate(`/scheduling/new?date=${createDateKey}`)}
                className="rounded-[6px] bg-[#1250a0] px-5 py-3 text-[12px] font-bold text-white shadow-[0_2px_4px_rgb(18_80_160_/_25%)] max-[1024px]:px-4 max-[1024px]:py-2 max-[620px]:text-[9px]"
              >
                + Create Job
              </button>
            </div>
          </div>

          {formError && (
            <p
              className="mb-4 rounded-[6px] border border-[#f1b7af] bg-[#fff3f1] px-4 py-3 text-[12px] text-[#a83a2c]"
              role="alert"
            >
              {formError}
            </p>
          )}

          <div className="grid grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] gap-[18px] max-[620px]:grid-cols-1">
            <section className="flex flex-col overflow-hidden rounded-[12px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_14%)]">
              <header className="flex h-[84px] shrink-0 items-center justify-between border-b border-[#e1e6eb] px-6 max-[1024px]:h-auto max-[1024px]:min-h-[57px] max-[1024px]:px-3 max-[620px]:flex-wrap max-[620px]:gap-y-2 max-[620px]:py-2">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 max-[620px]:gap-x-2">
                  <button
                    type="button"
                    onClick={() =>
                      viewMode === "calendar"
                        ? changeCalendarMonth(-1)
                        : changeDateRange(-7)
                    }
                    aria-label="Previous week"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] border border-[#e5e9ed] bg-white text-[#89939b] max-[620px]:h-7 max-[620px]:w-7"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      chevron_left
                    </span>
                  </button>
                  <div>
                    <strong className="text-[15px] max-[1024px]:text-[12px] max-[620px]:text-[11px]">
                      {viewMode === "calendar"
                        ? formatMonthLabel(calendarMonthStart)
                        : formatDateRange(weekStart, weekEnd)}
                    </strong>
                    <small className="block text-[10px] text-[#8f989f] max-[1024px]:text-[8px]">
                      {viewMode === "calendar"
                        ? `${scheduledJobsInCalendarMonth.length} jobs scheduled this month`
                        : dayFilter
                          ? `${formatSelectedDate(new Date(`${dayFilter}T00:00:00`)).split(",")[0]} · ${listJobs.length} ${listJobs.length === 1 ? "job" : "jobs"}`
                          : isCurrentWeek
                            ? `This week · ${listJobs.length} jobs scheduled`
                            : `Week · ${listJobs.length} jobs scheduled`}
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      viewMode === "calendar"
                        ? changeCalendarMonth(1)
                        : changeDateRange(7)
                    }
                    aria-label="Next week"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] border border-[#e5e9ed] bg-white text-[#89939b] max-[620px]:h-7 max-[620px]:w-7"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      chevron_right
                    </span>
                  </button>

                  {/* Day-of-week filter (list view only) */}
                  {viewMode === "list" && (
                    <div className="flex items-center gap-1 max-[620px]:w-full max-[620px]:justify-between">
                      {weekDays.map((date) => {
                        const dateKey = getDateKey(date);
                        const isActive = dayFilter === dateKey;
                        const jobsOnDay = schedule.filter(
                          (job) =>
                            getDateKey(scheduledJobDates[job[3]]) === dateKey,
                        ).length;
                        return (
                          <button
                            key={dateKey}
                            type="button"
                            aria-label={`${formatSelectedDate(date)}, ${jobsOnDay} ${jobsOnDay === 1 ? "job" : "jobs"}`}
                            aria-pressed={isActive}
                            title={`${formatSelectedDate(date)} · ${jobsOnDay} ${jobsOnDay === 1 ? "job" : "jobs"}`}
                            onClick={() => {
                              if (isActive) {
                                setDayFilter(null);
                                return;
                              }
                              setDayFilter(dateKey);
                              handleCalendarDateClick(date);
                            }}
                            className={`h-8 min-w-[34px] rounded-[6px] px-1 text-[11px] font-bold transition-colors max-[620px]:h-7 max-[620px]:min-w-[30px] max-[620px]:text-[10px] ${
                              isActive
                                ? "bg-[#1250a0] text-white"
                                : jobsOnDay > 0
                                  ? "border border-[#bcd3ee] bg-[#eef4ff] text-[#1250a0] hover:border-[#1250a0]"
                                  : "border border-[#e5e9ed] bg-white text-[#82909c] hover:border-[#1250a0] hover:text-[#1250a0]"
                            }`}
                          >
                            {DAY_LABELS[date.getDay()]}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
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
                    {listJobs.length === 0 && (
                      <p className="m-0 px-6 py-10 text-center text-[12px] text-[#8d969e]">
                        {dayFilter
                          ? "No jobs scheduled for this day."
                          : "No jobs scheduled this week."}
                      </p>
                    )}
                    {listJobs.map(
                      ([
                        time,
                        day,
                        client,
                        order,
                        service,
                        location,
                        technician,
                        stock,
                        ,
                        jobStatus,
                        branch,
                        date,
                        jobPartsStatus,
                        jobConfirmedAt,
                      ]) => {
                        const isSelected = selectedOrder === order;
                        const stage = getJobStage({
                          status: jobStatus,
                          partsStatus: jobPartsStatus,
                          assignmentConfirmed:
                            Boolean(jobConfirmedAt) ||
                            confirmedAssignments.has(order),
                        });
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
                            <div className="w-[74px] flex-none max-[1024px]:w-[54px]">
                              <strong className="block text-[14px] max-[1024px]:text-[11px] max-[620px]:text-[10px]">
                                {time}
                              </strong>
                              <small className="block text-[10px] text-[#929aa1] max-[1024px]:text-[8px]">
                                {day}
                              </small>
                              <small className="mt-0.5 block font-semibold text-[9px] text-[#7f8992] max-[1024px]:text-[8px]">
                                {formatShortDate(date)}
                              </small>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <strong className="truncate text-[13px] max-[1024px]:text-[11px] max-[620px]:text-[10px]">
                                  {client}
                                </strong>
                                <span
                                  className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[.04em] max-[1024px]:text-[7px] ${stage.style}`}
                                >
                                  {stage.label}
                                </span>
                              </div>
                              <p className="m-0 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[#8b949c] max-[1024px]:text-[8px]">
                                <span className="font-semibold text-[#6d879f]">
                                  {order}
                                </span>
                                <span className="text-[#c3ccd4]">|</span>
                                <span className="truncate">{service}</span>
                                <span className="text-[#c3ccd4]">|</span>
                                <span className="inline-flex items-center">
                                  <span className="material-symbols-outlined mr-0.5 align-middle text-[13px]">
                                    apartment
                                  </span>
                                  {capitalizeFirst(branch)}
                                </span>
                              </p>
                              <p className="m-0 mt-0.5 flex items-center text-[10px] text-[#8b949c] max-[1024px]:text-[8px]">
                                <span className="material-symbols-outlined mr-0.5 flex-none align-middle text-[13px]">
                                  location_on
                                </span>
                                <span className="truncate">{location}</span>
                              </p>
                              <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-[#7f8992] max-[1024px]:gap-2 max-[1024px]:text-[8px]">
                                <span className="truncate">
                                  <span className="material-symbols-outlined mr-0.5 align-middle text-[14px]">
                                    person
                                  </span>
                                  {technician}
                                </span>
                                <span className="truncate text-[#5e8e70]">
                                  <span className="material-symbols-outlined mr-0.5 align-middle text-[14px]">
                                    inventory_2
                                  </span>
                                  {stock}
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
                          return (
                            <div
                              key={`empty-${index}`}
                              className="bg-[#f8fbff]"
                            />
                          );
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
                                {jobsOnDate.length}{" "}
                                {jobsOnDate.length === 1 ? "Job" : "Jobs"}
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
                          {selectedDayJobs.length}{" "}
                          {selectedDayJobs.length === 1 ? "job" : "jobs"}
                        </span>
                      </div>
                      {selectedDayJobs.length > 0 ? (
                        <div className="mt-2 divide-y divide-[#e5e8eb]">
                          {selectedDayJobs.map(
                            ([time, , client, order, service]) => (
                              <button
                                key={order}
                                type="button"
                                onClick={() => setSelectedOrder(order)}
                                className={`flex w-full items-center gap-3 py-2 text-left ${
                                  selectedOrder === order
                                    ? "text-[#1250a0]"
                                    : "text-[#45515c]"
                                }`}
                              >
                                <strong className="w-11 flex-none text-[11px]">
                                  {time}
                                </strong>
                                <span className="min-w-0 flex-1">
                                  <strong className="block truncate text-[11px]">
                                    {client}
                                  </strong>
                                  <span className="block truncate text-[10px] text-[#89939b]">
                                    {service} · {order}
                                  </span>
                                </span>
                                <span className="material-symbols-outlined text-[17px] text-[#a6afb8]">
                                  chevron_right
                                </span>
                              </button>
                            ),
                          )}
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
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 text-[10px] uppercase tracking-[.08em] text-[#87929c]">
                    Selected work order
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <small className="text-[10px] font-bold text-[#50719a]">
                      {jobOrder || "—"}
                    </small>
                    {jobOrder && (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.04em] ${selectedJobStage.style}`}
                      >
                        {selectedJobStage.label}
                      </span>
                    )}
                  </div>
                  <h2 className="m-0 mt-2 text-[23px] font-bold leading-tight max-[1024px]:text-[17px]">
                    {jobClient}
                  </h2>
                  <p className="m-0 mt-2 flex items-start text-[10px] text-[#8a949c]">
                    <span className="material-symbols-outlined mr-1 flex-none align-middle text-[15px]">
                      location_on
                    </span>
                    <span className="min-w-0">{jobLocation}</span>
                  </p>
                </div>
                <div className="flex flex-none items-center gap-2">
                  {jobOrder && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/scheduling/${encodeURIComponent(jobOrder)}/edit`)
                      }
                      className="grid h-8 w-8 place-items-center rounded-[6px] bg-white text-[#174f9a] shadow-sm hover:bg-[#eaf2fc]"
                      aria-label="Edit selected work order"
                      title="Edit selected work order"
                    >
                      <span className="material-symbols-outlined text-[17px]">
                        edit
                      </span>
                    </button>
                  )}
                  <span className="rounded-[6px] bg-white px-3 py-2 text-[9px] text-[#6d879f] shadow-sm">
                    {scheduledJobDates[jobOrder]
                      ? formatSelectedDate(scheduledJobDates[jobOrder])
                          .split(",")[0]
                          .toUpperCase()
                      : "SCHEDULED"}
                  </span>
                </div>
              </div>

              <dl className="mt-5 overflow-hidden rounded-[8px] border border-[#e4eaf0] bg-white shadow-sm max-[1024px]:mt-4">
                <DetailRow icon="tag" label="Job number">
                  {jobOrder || "—"}
                </DetailRow>
                <DetailRow icon="apartment" label="Branch">
                  {jobBranch ? capitalizeFirst(jobBranch) : "—"}
                </DetailRow>
                <DetailRow icon="build" label="Service type">
                  {jobService || "—"}
                </DetailRow>
                <DetailRow icon="event" label="Schedule">
                  {jobDate ? formatLongDate(jobDate) : "—"}
                </DetailRow>
                <DetailRow icon="schedule" label="Start time">
                  {jobTime || "—"}
                </DetailRow>
                <DetailRow icon="location_on" label="Site">
                  <span className="block">{jobLocation || "—"}</span>
                </DetailRow>
                <DetailRow icon="person" label="Technicians">
                  {jobTechnicians?.length ? (
                    <span className="block">
                      {jobTechnicians.map((technician) => (
                        <span className="block" key={technician.id}>
                          {technician.name}
                        </span>
                      ))}
                    </span>
                  ) : (
                    "Unassigned"
                  )}
                </DetailRow>
                <DetailRow icon="inventory_2" label="Parts / stock">
                  {jobStock || "—"}
                </DetailRow>
              </dl>

              <button
                type="button"
                disabled={
                  !jobOrder || isConfirmingAssignment || isStockAllocated(jobPartsStatus)
                }
                onClick={handleConfirmAssignment}
                className={`mt-3 flex w-full items-center justify-center gap-2 rounded-[6px] py-3 text-[12px] font-bold text-white max-[1024px]:py-2 max-[1024px]:text-[9px] ${
                  isStockAllocated(jobPartsStatus)
                    ? "cursor-default bg-[#267340]"
                    : "bg-[#1250a0] hover:bg-[#0e4388] disabled:cursor-not-allowed disabled:bg-[#86a7d5]"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isStockAllocated(jobPartsStatus) ? "event_available" : "check"}
                </span>
                {isStockAllocated(jobPartsStatus)
                  ? "Job scheduled"
                  : isConfirmingAssignment
                    ? "Confirming..."
                    : isAssignmentConfirmed
                      ? "Continue to inventory request"
                      : "Confirm assignment"}
              </button>
              {confirmError.message && confirmError.order === jobOrder && (
                <p
                  className="m-0 mt-2 rounded-[6px] border border-[#f0b8b0] bg-[#fff1ee] px-3 py-2 text-[11px] text-[#b64132]"
                  role="alert"
                >
                  {confirmError.message}
                </p>
              )}
            </aside>
          </div>

          <footer className="mt-8 border-t border-[#c9d4de] pt-3 text-[9px] text-[#8a9299] max-[1024px]:hidden">
            Guard-All Electronic Security Systems, Inc.
          </footer>
        </div>
      </section>

    </main>
  );
}

export default Scheduling;
