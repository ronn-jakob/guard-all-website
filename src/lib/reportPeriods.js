// Shared period model for the printable reports.
//
// Weeks run Sunday-Saturday to match the Scheduling calendar. Every period is
// identified by a URL-safe key: a week by its Sunday ("2026-10-25"), a month by
// "2026-10" and a year by "2026". The helpers are pure so they can be tested
// without a DOM.

export const PERIOD_MODES = ["week", "month", "year"];

const pad = (value) => String(value).padStart(2, "0");

export function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Returns a Date only for a real calendar date; null otherwise, so an edited
// URL can never produce an impossible period.
export function parseDateKey(value) {
  const text = String(value ?? "");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function startOfWeek(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function monthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function currentPeriodValue(mode, today = new Date()) {
  if (mode === "week") return toDateKey(startOfWeek(today));
  if (mode === "year") return String(today.getFullYear());
  return monthKey(today);
}

export function formatPeriodLabel(mode, start, end) {
  const shortMonth = (date) =>
    date.toLocaleDateString("en-US", { month: "short" });
  if (mode === "week") {
    if (start.getMonth() === end.getMonth()) {
      return `${shortMonth(start)} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
    }
    if (start.getFullYear() === end.getFullYear()) {
      return `${shortMonth(start)} ${start.getDate()} – ${shortMonth(end)} ${end.getDate()}, ${start.getFullYear()}`;
    }
    return `${shortMonth(start)} ${start.getDate()}, ${start.getFullYear()} – ${shortMonth(end)} ${end.getDate()}, ${end.getFullYear()}`;
  }
  if (start.getMonth() === end.getMonth() && start.getDate() === 1) {
    return start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  return String(start.getFullYear());
}

// Range for a mode/value pair, without the neighbouring keys. Kept separate so
// shiftKey can work from a normalised key without recursing back into here.
function resolveRange(mode, value, today = new Date()) {
  const safeMode = PERIOD_MODES.includes(mode) ? mode : "month";
  let start;
  let end;

  if (safeMode === "week") {
    start = startOfWeek(parseDateKey(value) ?? today);
    end = addDays(start, 6);
  } else if (safeMode === "year") {
    const year = /^\d{4}$/.test(String(value ?? ""))
      ? Number(value)
      : today.getFullYear();
    start = new Date(year, 0, 1);
    end = new Date(year, 11, 31);
  } else {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(value ?? ""));
    const year = match ? Number(match[1]) : today.getFullYear();
    const month = match ? Number(match[2]) - 1 : today.getMonth();
    start = new Date(year, month, 1);
    end = new Date(year, month + 1, 0);
  }

  return {
    mode: safeMode,
    value:
      safeMode === "week"
        ? toDateKey(start)
        : safeMode === "year"
          ? String(start.getFullYear())
          : monthKey(start),
    start,
    end,
  };
}

// Pure calendar arithmetic from an already-normalised key.
function shiftKey(mode, value, delta) {
  if (mode === "week") {
    const start = parseDateKey(value) ?? new Date();
    return toDateKey(addDays(start, delta * 7));
  }
  if (mode === "year") {
    return String(Number(value) + delta);
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7)) - 1;
  const shifted = new Date(year, month + delta, 1);
  return monthKey(shifted);
}

// Resolves a mode/value pair to a concrete range, label, and the keys either
// side of it. Bad or missing values fall back to "now" rather than throwing.
export function resolvePeriod(mode, value, today = new Date()) {
  const range = resolveRange(mode, value, today);
  return {
    ...range,
    startKey: toDateKey(range.start),
    endKey: toDateKey(range.end),
    label: formatPeriodLabel(range.mode, range.start, range.end),
    previous: shiftKey(range.mode, range.value, -1),
    next: shiftKey(range.mode, range.value, 1),
  };
}

export function shiftPeriod(mode, value, delta, today = new Date()) {
  const range = resolveRange(mode, value, today);
  return shiftKey(range.mode, range.value, delta);
}

// ISO dates compare correctly as strings, and a timestamp is cut to its date.
export function isWithinPeriod(dateValue, period) {
  const key = String(dateValue ?? "").slice(0, 10);
  if (!period?.startKey || !key) return false;
  return key >= period.startKey && key <= period.endKey;
}

// Reads ?mode= and ?value= from the URL, falling back to the module's default
// period so a hand-edited or truncated link still renders a report.
export function periodFromSearchParams(
  params,
  today = new Date(),
  fallbackMode = "month",
) {
  const requestedMode = params?.get?.("mode") ?? "";
  const mode = PERIOD_MODES.includes(requestedMode) ? requestedMode : fallbackMode;
  const rawValue = String(params?.get?.("value") ?? "");
  const isValid =
    mode === "week"
      ? Boolean(parseDateKey(rawValue))
      : mode === "month"
        ? /^\d{4}-(0[1-9]|1[0-2])$/.test(rawValue)
        : /^\d{4}$/.test(rawValue);
  return {
    mode,
    value: isValid ? rawValue : currentPeriodValue(mode, today),
  };
}
