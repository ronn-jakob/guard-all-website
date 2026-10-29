import { describe, expect, it } from "vitest";
import {
  bookingLabel,
  conflictsForWindow,
  rangesOverlap,
  toMinutes,
  unavailableTechnicianNames,
} from "./scheduleAvailability.js";

describe("toMinutes", () => {
  it("parses HH:MM time strings", () => {
    expect(toMinutes("09:00")).toBe(540);
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("23:59")).toBe(1439);
    expect(toMinutes("09:00:00")).toBe(540);
  });

  it("rejects malformed or out-of-range values", () => {
    expect(toMinutes("")).toBeNull();
    expect(toMinutes("9:00")).toBeNull();
    expect(toMinutes("24:00")).toBeNull();
    expect(toMinutes("09:60")).toBeNull();
    expect(toMinutes(null)).toBeNull();
  });
});

describe("rangesOverlap", () => {
  it("detects a real overlap", () => {
    expect(rangesOverlap(540, 600, 570, 630)).toBe(true);
    expect(rangesOverlap(570, 630, 540, 600)).toBe(true);
    expect(rangesOverlap(540, 600, 550, 590)).toBe(true);
  });

  it("allows touching and separate windows", () => {
    expect(rangesOverlap(540, 600, 600, 660)).toBe(false);
    expect(rangesOverlap(600, 660, 540, 600)).toBe(false);
    expect(rangesOverlap(540, 600, 700, 760)).toBe(false);
  });

  it("treats a zero-length window as non-conflicting", () => {
    expect(rangesOverlap(540, 540, 500, 600)).toBe(false);
  });

  it("returns false for missing values", () => {
    expect(rangesOverlap(null, 600, 500, 600)).toBe(false);
  });
});

describe("conflictsForWindow", () => {
  const bookings = [
    { jobNumber: "WO-1", start: "09:00", end: "10:00" },
    { jobNumber: "WO-2", start: "13:00", end: "15:00" },
  ];

  it("returns only the overlapping bookings", () => {
    expect(conflictsForWindow(bookings, "10:00", "12:00").map((b) => b.jobNumber)).toEqual([]);
    expect(conflictsForWindow(bookings, "09:30", "11:00").map((b) => b.jobNumber)).toEqual(["WO-1"]);
    expect(conflictsForWindow(bookings, "14:00", "16:00").map((b) => b.jobNumber)).toEqual(["WO-2"]);
  });

  it("returns nothing for an invalid window", () => {
    expect(conflictsForWindow(bookings, "11:00", "10:00")).toEqual([]);
    expect(conflictsForWindow(bookings, "", "")).toEqual([]);
  });
});

describe("bookingLabel", () => {
  it("formats a booking window", () => {
    expect(bookingLabel({ start: "09:00", end: "10:00" })).toBe("09:00–10:00");
    expect(bookingLabel({})).toBe("");
  });
});

describe("unavailableTechnicianNames", () => {
  it("names only the selected technicians who are not available", () => {
    const technicians = [
      { id: "t1", name: "Albert", available: false },
      { id: "t2", name: "Boy", available: true },
      { id: "t3", name: "Victor", available: false },
    ];

    expect(unavailableTechnicianNames(technicians, ["t1", "t2"])).toEqual(["Albert"]);
    expect(unavailableTechnicianNames(technicians, [])).toEqual([]);
  });
});
