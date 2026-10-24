import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import { getSession } from "../lib/auth.js";
import {
  confirmJobAssignment,
  deleteJob,
  listSchedules,
} from "../lib/api/scheduling.js";
import {
  DAY_LABELS,
  capitalizeFirst,
  formatDateRange,
  formatMonthLabel,
  formatSelectedDate,
  formatShortDate,
  getDateKey,
  getJobStage,
  getToday,
  isStockAllocated,
  mapScheduleRow,
} from "../features/scheduling/scheduleUtils.js";
import SelectedJobPanel from "../features/scheduling/SelectedJobPanel.jsx";
import DeleteDraftJobDialog from "../features/scheduling/DeleteDraftJobDialog.jsx";

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
  const [searchParams] = useSearchParams();
  // Arriving from the dashboard's "Draft jobs" card: show every draft, whatever
  // week it falls in, instead of the current week's slice.
  const draftsOnly = searchParams.get("drafts") === "1";
  // State to manage active view mode ('list' | 'calendar')
  const [viewMode, setViewMode] = useState("list");
  // Paid jobs are finished work and stay off the board unless asked for.
  const [showClosed, setShowClosed] = useState(false);
  const [rangeStart, setRangeStart] = useState(getToday);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(getToday);
  // Day-of-week filter for the weekly list. null shows the whole week.
  const [dayFilter, setDayFilter] = useState(null);
  const [isConfirmingAssignment, setIsConfirmingAssignment] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState("");
  const [isDeletingDraft, setIsDeletingDraft] = useState(false);
  const [deleteDraftError, setDeleteDraftError] = useState("");
  const [scheduleReloadToken, setScheduleReloadToken] = useState(0);
  const [confirmError, setConfirmError] = useState({ order: "", message: "" });

  useEffect(() => {
    let isMounted = true;
    listSchedules()
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
  }, [confirmedAssignmentsKey, scheduleReloadToken]);

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
  // A job whose invoice is settled is finished work. It is hidden from the board
  // by default instead of reading "Scheduled" forever; the toggle brings it back.
  const visibleSchedule = showClosed
    ? schedule
    : schedule.filter((job) => job[14]?.status !== "paid");
  const scheduledJobsInRange = draftsOnly
    ? visibleSchedule.filter((job) => !job[13] && job[12] === "pending")
    : visibleSchedule.filter((job) => {
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
  const listJobs = draftsOnly
    ? scheduledJobsInRange
    : dayFilter
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
  const selectedDayJobs = visibleSchedule.filter(
    (job) =>
      getDateKey(scheduledJobDates[job[3]]) ===
      getDateKey(selectedCalendarDate),
  );
  const scheduledJobsInCalendarMonth = visibleSchedule.filter((job) => {
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
    const firstJobOnDate = visibleSchedule.find(
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
  const selectedJob = visibleSchedule.find((job) => job[3] === selectedOrder) ??
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
      null,
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
    jobInvoice,
  ] = selectedJob;
  // The DB timestamp is authoritative and shared; the local set only covers the
  // moment between confirming and the next schedule refresh.
  const isAssignmentConfirmed =
    Boolean(jobAssignmentConfirmedAt) || confirmedAssignments.has(jobOrder);
  // Draft = unconfirmed and nothing allocated yet. Only drafts may be deleted.
  const isDraftUnallocated =
    !isAssignmentConfirmed && jobPartsStatus === "pending";
  const selectedJobStage = getJobStage({
    status: jobStatus,
    partsStatus: jobPartsStatus,
    assignmentConfirmed: isAssignmentConfirmed,
    invoiceStatus: jobInvoice?.status ?? null,
  });
  const selectedJobScheduledLabel = scheduledJobDates[jobOrder]
    ? formatSelectedDate(scheduledJobDates[jobOrder]).split(",")[0].toUpperCase()
    : "SCHEDULED";

  async function handleConfirmAssignment() {
    const order = selectedJob[3];
    if (!order) return;
    setConfirmError({ order: "", message: "" });
    setIsConfirmingAssignment(true);
    try {
      await confirmJobAssignment({ jobNumber: order });
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

  async function handleDeleteDraft(password) {
    if (!deleteTarget) return;
    setDeleteDraftError("");
    setIsDeletingDraft(true);
    try {
      await deleteJob({
        jobNumber: deleteTarget,
        password,
      });
      setDeleteTarget("");
      setSelectedOrder("");
      setScheduleReloadToken((token) => token + 1);
    } catch (error) {
      setDeleteDraftError(error.message);
    } finally {
      setIsDeletingDraft(false);
    }
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
                      {draftsOnly
                        ? "Draft jobs"
                        : viewMode === "calendar"
                          ? formatMonthLabel(calendarMonthStart)
                          : formatDateRange(weekStart, weekEnd)}
                    </strong>
                    <small className="block text-[10px] text-[#8f989f] max-[1024px]:text-[8px]">
                      {draftsOnly
                        ? `${listJobs.length} awaiting confirmation`
                        : viewMode === "calendar"
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
                  {viewMode === "list" && !draftsOnly && (
                    <div className="flex items-center gap-1 max-[620px]:w-full max-[620px]:justify-between">
                      {weekDays.map((date) => {
                        const dateKey = getDateKey(date);
                        const isActive = dayFilter === dateKey;
                        const jobsOnDay = visibleSchedule.filter(
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-pressed={showClosed}
                    title="Include jobs whose invoice is already paid"
                    onClick={() => setShowClosed((isShowing) => !isShowing)}
                    className={`rounded-[6px] border px-3 py-2 text-[10px] font-bold transition-colors max-[1024px]:px-2 max-[1024px]:py-1.5 max-[1024px]:text-[9px] ${
                      showClosed
                        ? "border-[#1250a0] bg-[#1250a0] text-white"
                        : "border-[#e5e9ed] bg-white text-[#82909c] hover:border-[#1250a0] hover:text-[#1250a0]"
                    }`}
                  >
                    Paid jobs
                  </button>
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
                        jobInvoice,
                      ]) => {
                        const isSelected = selectedOrder === order;
                        const stage = getJobStage({
                          status: jobStatus,
                          partsStatus: jobPartsStatus,
                          assignmentConfirmed:
                            Boolean(jobConfirmedAt) ||
                            confirmedAssignments.has(order),
                          invoiceStatus: jobInvoice?.status ?? null,
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

            <SelectedJobPanel
              job={{
                order: jobOrder,
                client: jobClient,
                location: jobLocation,
                branch: jobBranch,
                service: jobService,
                date: jobDate,
                time: jobTime,
                technicians: jobTechnicians,
                stock: jobStock,
              }}
              stage={selectedJobStage}
              scheduledLabel={selectedJobScheduledLabel}
              invoice={jobInvoice}
              isDraft={isDraftUnallocated}
              isConfirmed={isAssignmentConfirmed}
              stockAllocated={isStockAllocated(jobPartsStatus)}
              isConfirming={isConfirmingAssignment}
              confirmError={
                confirmError.order === jobOrder ? confirmError.message : ""
              }
              onEdit={() =>
                navigate(`/scheduling/${encodeURIComponent(jobOrder)}/edit`)
              }
              onConfirm={handleConfirmAssignment}
              onViewInvoice={() => navigate("/billing")}
              onRequestDelete={() => {
                setDeleteDraftError("");
                setDeleteTarget(jobOrder);
              }}
            />
          </div>

          <footer className="mt-8 border-t border-[#c9d4de] pt-3 text-[9px] text-[#8a9299] max-[1024px]:hidden">
            Guard-All Electronic Security Systems, Inc.
          </footer>
        </div>
      </section>

      <DeleteDraftJobDialog
        jobNumber={deleteTarget}
        isBusy={isDeletingDraft}
        error={deleteDraftError}
        onCancel={() => setDeleteTarget("")}
        onConfirm={handleDeleteDraft}
      />
    </main>
  );
}

export default Scheduling;
