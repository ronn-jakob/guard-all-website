// Interval helpers for technician availability. The scheduler now allows more
// than one job per technician per day as long as the windows do not overlap;
// these helpers drive the form's live warning and are unit-tested.

export function toMinutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value ?? "").slice(0, 5));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

// Half-open windows: 09:00-10:00 and 10:00-11:00 do not overlap.
export function rangesOverlap(startA, endA, startB, endB) {
  if ([startA, endA, startB, endB].some((value) => typeof value !== "number")) {
    return false;
  }
  if (startA >= endA || startB >= endB) return false;
  return startA < endB && startB < endA;
}

export function bookingLabel(booking) {
  if (!booking?.start || !booking?.end) return "";
  return `${booking.start}–${booking.end}`;
}

export function conflictsForWindow(bookings, startTime, endTime) {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start === null || end === null || end <= start) return [];

  return (bookings ?? []).filter((booking) => {
    const bookingStart = booking.startMinutes ?? toMinutes(booking.start);
    const bookingEnd = booking.endMinutes ?? toMinutes(booking.end);
    return rangesOverlap(start, end, bookingStart, bookingEnd);
  });
}

// Names of the selected technicians who cannot take the current window.
export function unavailableTechnicianNames(technicians, selectedIds) {
  return (technicians ?? [])
    .filter(
      (technician) =>
        selectedIds.includes(technician.id) && technician.available === false,
    )
    .map((technician) => technician.name);
}
