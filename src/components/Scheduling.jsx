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

function getTechnicianRoleUsers(technicians) {
  return technicians.filter((technician) => technician.roleName === "Technician");
}

// Sunday-first, matching the Calendar view's column order.
const DAY_LABELS = ["S", "M", "T", "W", "TH", "F", "ST"];

// Kept in sync with the public.job_type enum; the backend's jobTypeFor maps
// these labels to installation / maintenance / inspection / repair.
const SERVICE_TYPES = [
  "Service call",
  "Preventive maintenance",
  "Installation",
  "Inspection",
];

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
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const [isEditJobOpen, setIsEditJobOpen] = useState(false);
  const [editValues, setEditValues] = useState({});
  const [editTechnicians, setEditTechnicians] = useState([""]);
  const [editTechnicianOptions, setEditTechnicianOptions] = useState([]);
  const [clientType, setClientType] = useState("Individual");
  const [technicians, setTechnicians] = useState([""]);
  const [technicianOptions, setTechnicianOptions] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [scheduledJobDates, setScheduledJobDates] = useState({});
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
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
  const defaultBranch =
    getSession()?.user?.branch === "cebu" ? "Cebu" : "Makati";
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

  useEffect(() => {
    let isMounted = true;
    callAuthFunction("list-technicians", {
      date: getDateKey(selectedCalendarDate),
    })
      .then(({ technicians: availableTechnicians }) => {
        if (isMounted) {
          setTechnicianOptions(getTechnicianRoleUsers(availableTechnicians || []));
        }
      })
      .catch((error) => {
        if (isMounted) setFormError(error.message);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedCalendarDate]);

  useEffect(() => {
    if (!isEditJobOpen || !editValues.date) return;
    let isMounted = true;
    callAuthFunction("list-technicians", {
      date: editValues.date,
      excludeOrder: editValues.order,
    })
      .then(({ technicians: availableTechnicians }) => {
        if (isMounted) {
          setEditTechnicianOptions(getTechnicianRoleUsers(availableTechnicians || []));
        }
      })
      .catch((error) => {
        if (isMounted) setFormError(error.message);
      });
    return () => {
      isMounted = false;
    };
  }, [isEditJobOpen, editValues.date, editValues.order]);

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

  async function handleCreateJob(event) {
    event.preventDefault();
    setFormError("");
    setIsSaving(true);
    const formData = new FormData(event.currentTarget);
    try {
      await callAuthFunction("create-schedule", {
        firstName: formData.get("firstName"),
        lastName: formData.get("lastName"),
        clientType: formData.get("clientType"),
        companyName: formData.get("companyName"),
        address: formData.get("address"),
        contactEmail: formData.get("contactEmail"),
        phoneNumber: formData.get("phoneNumber"),
        serviceType: formData.get("serviceType"),
        date: formData.get("date"),
        startTime: formData.get("startTime"),
        endTime: formData.get("endTime"),
        branch: formData.get("branch"),
        technicianIds: formData.getAll("technicians").filter(Boolean),
      });
      const { schedules } = await callAuthFunction("list-schedules");
      const nextDates = Object.fromEntries(
        (schedules || []).map((job) => [
          job.order,
          new Date(`${job.date}T00:00:00`),
        ]),
      );
      setSchedule((schedules || []).map(mapScheduleRow));
      setScheduledJobDates(nextDates);
      setTechnicians([""]);
      setIsCreateJobOpen(false);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  function openEditJob() {
    const startTime = selectedJob[0] || "09:00";
    const [hours, minutes] = startTime.split(":").map(Number);
    const endDate = new Date(2026, 0, 1, hours + 1, minutes);
    setEditValues({
      order: selectedJob[3],
      serviceType: SERVICE_TYPES.includes(selectedJob[4])
        ? selectedJob[4]
        : "Service call",
      date: getDateKey(
        scheduledJobDates[selectedJob[3]] || selectedCalendarDate,
      ),
      startTime,
      endTime: `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`,
      branch: selectedJob[10]
        ? capitalizeFirst(selectedJob[10])
        : defaultBranch,
    });
    setEditTechnicians(
      selectedJob[8]?.length
        ? selectedJob[8].map((technician) => technician.id)
        : [""],
    );
    setFormError("");
    setIsEditJobOpen(true);
  }

  async function handleEditJob(event) {
    event.preventDefault();
    setFormError("");
    setIsSaving(true);
    const formData = new FormData(event.currentTarget);
    try {
      await callAuthFunction("update-schedule", {
        order: formData.get("order"),
        serviceType: formData.get("serviceType"),
        date: formData.get("date"),
        startTime: formData.get("startTime"),
        endTime: formData.get("endTime"),
        branch: formData.get("branch"),
        technicianIds: formData.getAll("technicians").filter(Boolean),
      });
      const { schedules } = await callAuthFunction("list-schedules");
      const nextDates = Object.fromEntries(
        (schedules || []).map((job) => [
          job.order,
          new Date(`${job.date}T00:00:00`),
        ]),
      );
      setSchedule((schedules || []).map(mapScheduleRow));
      setScheduledJobDates(nextDates);
      setSelectedCalendarDate(new Date(`${formData.get("date")}T00:00:00`));
      setIsEditJobOpen(false);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setIsSaving(false);
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
                onClick={() => setIsCreateJobOpen(true)}
                className="rounded-[6px] bg-[#1250a0] px-5 py-3 text-[12px] font-bold text-white shadow-[0_2px_4px_rgb(18_80_160_/_25%)] max-[1024px]:px-4 max-[1024px]:py-2 max-[620px]:text-[9px]"
              >
                + Create Job
              </button>
            </div>
          </div>

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
                      onClick={openEditJob}
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

      {isEditJobOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/75 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsEditJobOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-labelledby="edit-job-title"
            className="w-full max-w-[560px] rounded-[14px] border border-[#263c5a] bg-[#172a44] p-6 text-[#e5edf8] shadow-[0_24px_80px_rgb(0_0_0_/_45%)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="m-0 text-[11px] font-semibold uppercase tracking-[.1em] text-[#91a8c7]">
                  {editValues.order}
                </p>
                <h2
                  id="edit-job-title"
                  className="m-0 mt-1 text-[23px] font-bold text-white"
                >
                  Edit scheduled job
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsEditJobOpen(false)}
                className="grid h-8 w-8 place-items-center text-[25px] text-[#91a8c7] hover:text-white"
              >
                ×
              </button>
            </div>
            <form className="mt-5 grid gap-4" onSubmit={handleEditJob}>
              <input
                type="hidden"
                name="order"
                value={editValues.order || ""}
                readOnly
              />
              <label className="text-[13px] font-medium text-[#a9bfd9]">
                Service type
                <select
                  name="serviceType"
                  value={editValues.serviceType || ""}
                  onChange={(event) =>
                    setEditValues((current) => ({
                      ...current,
                      serviceType: event.target.value,
                    }))
                  }
                  className="mt-1.5 h-11 w-full rounded-[8px] border border-[#293f5d] bg-[#1d3351] px-3 text-[14px] text-white outline-none focus:border-[#4d88e8]"
                >
                  {SERVICE_TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
                <label className="text-[13px] font-medium text-[#a9bfd9]">
                  Date
                  <input
                    required
                    type="date"
                    name="date"
                    value={editValues.date || ""}
                    onChange={(event) =>
                      setEditValues((current) => ({
                        ...current,
                        date: event.target.value,
                      }))
                    }
                    className="mt-1.5 h-11 w-full rounded-[8px] border border-[#293f5d] bg-[#1d3351] px-3 text-[14px] text-white outline-none focus:border-[#4d88e8]"
                  />
                </label>
                <label className="text-[13px] font-medium text-[#a9bfd9]">
                  Branch
                  <select
                    name="branch"
                    value={editValues.branch || defaultBranch}
                    onChange={(event) =>
                      setEditValues((current) => ({
                        ...current,
                        branch: event.target.value,
                      }))
                    }
                    className="mt-1.5 h-11 w-full rounded-[8px] border border-[#293f5d] bg-[#1d3351] px-3 text-[14px] text-white outline-none focus:border-[#4d88e8]"
                  >
                    <option>Makati</option>
                    <option>Cebu</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
                <label className="text-[13px] font-medium text-[#a9bfd9]">
                  Start time
                  <input
                    required
                    type="time"
                    name="startTime"
                    value={editValues.startTime || ""}
                    onChange={(event) =>
                      setEditValues((current) => ({
                        ...current,
                        startTime: event.target.value,
                      }))
                    }
                    className="mt-1.5 h-11 w-full rounded-[8px] border border-[#293f5d] bg-[#1d3351] px-3 text-[14px] text-white outline-none focus:border-[#4d88e8]"
                  />
                </label>
                <label className="text-[13px] font-medium text-[#a9bfd9]">
                  End time
                  <input
                    required
                    type="time"
                    name="endTime"
                    value={editValues.endTime || ""}
                    onChange={(event) =>
                      setEditValues((current) => ({
                        ...current,
                        endTime: event.target.value,
                      }))
                    }
                    className="mt-1.5 h-11 w-full rounded-[8px] border border-[#293f5d] bg-[#1d3351] px-3 text-[14px] text-white outline-none focus:border-[#4d88e8]"
                  />
                </label>
              </div>
              <fieldset className="border-0 p-0">
                <div className="flex items-center justify-between gap-3">
                  <legend className="text-[13px] font-medium text-[#a9bfd9]">
                    Assign technicians
                  </legend>
                  <button
                    type="button"
                    onClick={() =>
                      setEditTechnicians((current) => [...current, ""])
                    }
                    className="rounded-[6px] border border-[#4d88e8] px-3 py-2 text-[11px] font-semibold text-[#9fc4ff] hover:bg-[#1d3351]"
                  >
                    + Add technician
                  </button>
                </div>
                <div className="mt-2 grid gap-2">
                  {editTechnicians.map((technicianId, index) => {
                    return (
                      <div
                        className="flex items-center gap-2"
                        key={`edit-technician-${index}`}
                      >
                        <select
                          name="technicians"
                          value={technicianId}
                          onChange={(event) =>
                            setEditTechnicians((current) =>
                              current.map((value, currentIndex) =>
                                currentIndex === index
                                  ? event.target.value
                                  : value,
                              ),
                            )
                          }
                          className="h-11 min-w-0 flex-1 rounded-[8px] border border-[#293f5d] bg-[#1d3351] px-3 text-[14px] text-white outline-none focus:border-[#4d88e8]"
                        >
                          <option value="" disabled>Select a technician</option>
                          {editTechnicianOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                        {editTechnicians.length > 1 && (
                          <button
                            type="button"
                            aria-label={`Remove technician ${index + 1}`}
                            onClick={() =>
                              setEditTechnicians((current) =>
                                current.filter(
                                  (_, currentIndex) => currentIndex !== index,
                                ),
                              )
                            }
                            className="grid h-10 w-10 flex-none place-items-center rounded-[6px] text-[#91a8c7] hover:bg-[#1d3351] hover:text-white"
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              delete
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </fieldset>
              {formError && (
                <p
                  className="m-0 rounded-[6px] border border-[#8f3e3a] bg-[#3c2229] px-3 py-2 text-[12px] text-[#ffb3a8]"
                  role="alert"
                >
                  {formError}
                </p>
              )}
              <div className="flex justify-end gap-3 border-t border-[#293d58] pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditJobOpen(false)}
                  className="rounded-[8px] border border-[#293f5d] px-4 py-2 text-[13px] text-[#e5edf8] hover:bg-[#1d3351]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-[8px] bg-[#4d88e8] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#5b96f4]"
                >
                  {isSaving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
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
              onSubmit={handleCreateJob}
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
                    name="serviceType"
                    defaultValue="Service call"
                    className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none focus:border-[#4d88e8]"
                  >
                    {SERVICE_TYPES.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
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
                    name="startTime"
                    defaultValue="09:00"
                    className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none focus:border-[#4d88e8]"
                  />
                </label>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-4 max-[620px]:grid-cols-1 max-[620px]:gap-3">
                <label className="text-[14px] font-medium text-[#a9bfd9]">
                  End time <span className="text-[#ff6557]">*</span>
                  <input
                    required
                    type="time"
                    name="endTime"
                    defaultValue="10:00"
                    className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none focus:border-[#4d88e8]"
                  />
                </label>
                <label className="text-[14px] font-medium text-[#a9bfd9]">
                  Branch <span className="text-[#ff6557]">*</span>
                  <select
                    required
                    name="branch"
                    defaultValue={defaultBranch}
                    className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none focus:border-[#4d88e8]"
                  >
                    <option>Makati</option>
                    <option>Cebu</option>
                  </select>
                </label>
              </div>

              <fieldset className="border-0 p-0">
                <div className="flex items-center justify-between gap-3">
                  <legend className="text-[14px] font-medium text-[#a9bfd9]">
                    Assign technicians{" "}
                    <span className="text-[12px] text-[#7188a4]">
                      (optional)
                    </span>
                  </legend>
                  <button
                    type="button"
                    onClick={() =>
                      setTechnicians((current) => [...current, ""])
                    }
                    className="rounded-[8px] border border-[#4d88e8] px-3 py-2 text-[12px] font-semibold text-[#9fc4ff] hover:bg-[#1d3351]"
                  >
                    + Add technician
                  </button>
                </div>

                <div className="mt-2 grid gap-2">
                  {technicians.map((technician, index) => (
                    <div
                      className="flex items-center gap-2"
                      key={`technician-${index}`}
                    >
                      <select
                        name="technicians"
                        value={technician}
                        onChange={(event) =>
                          setTechnicians((current) =>
                            current.map((value, currentIndex) =>
                              currentIndex === index
                                ? event.target.value
                                : value,
                            ),
                          )
                        }
                        className="h-12 min-w-0 flex-1 rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none focus:border-[#4d88e8]"
                      >
                        <option value="" disabled>Select a technician</option>
                        {technicianOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                      {technicians.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Remove technician ${index + 1}`}
                          onClick={() =>
                            setTechnicians((current) =>
                              current.filter(
                                (_, currentIndex) => currentIndex !== index,
                              ),
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
              {formError && (
                <p
                  className="mb-5 mt-3 rounded-[6px] border border-[#8f3e3a] bg-[#3c2229] px-3 py-2 text-[12px] text-[#ffb3a8]"
                  role="alert"
                >
                  {formError}
                </p>
              )}
              <p className="mb-5 mt-2 flex items-center gap-2 text-[14px] text-[#27a567]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#27a567]" />
                {technicianOptions.length
                  ? `${technicianOptions.length} technician${technicianOptions.length === 1 ? "" : "s"} available on this date`
                  : "No technicians available on this date"}
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
                Work order number generated on save
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
                  disabled={isSaving}
                  className="h-[50px] rounded-[10px] bg-[#4d88e8] px-5 text-[14px] font-semibold text-white hover:bg-[#5b96f4] max-[420px]:flex-1"
                >
                  {isSaving ? "Saving..." : "Create job"}
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
