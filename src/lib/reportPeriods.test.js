import { describe, expect, it } from "vitest";
import {
  currentPeriodValue,
  isWithinPeriod,
  parseDateKey,
  periodFromSearchParams,
  resolvePeriod,
  shiftPeriod,
  toDateKey,
} from "./reportPeriods.js";

const at = (year, month, day) => new Date(year, month - 1, day);

describe("toDateKey / parseDateKey", () => {
  it("round-trips real dates", () => {
    expect(toDateKey(at(2026, 10, 25))).toBe("2026-10-25");
    expect(toDateKey(parseDateKey("2026-10-25"))).toBe("2026-10-25");
  });

  it("rejects impossible or malformed dates", () => {
    expect(parseDateKey("2026-02-31")).toBeNull();
    expect(parseDateKey("2026-2-3")).toBeNull();
    expect(parseDateKey("")).toBeNull();
    expect(parseDateKey(null)).toBeNull();
  });
});

describe("currentPeriodValue", () => {
  it("uses the Sunday of the current week", () => {
    // 28 Oct 2026 is a Wednesday; the week starts Sunday 25 Oct.
    expect(currentPeriodValue("week", at(2026, 10, 28))).toBe("2026-10-25");
  });

  it("uses the month and year keys", () => {
    expect(currentPeriodValue("month", at(2026, 10, 28))).toBe("2026-10");
    expect(currentPeriodValue("year", at(2026, 10, 28))).toBe("2026");
  });
});

describe("resolvePeriod", () => {
  it("resolves a week to Sunday-Saturday and normalises the key", () => {
    const period = resolvePeriod("week", "2026-10-28");

    expect(period.value).toBe("2026-10-25");
    expect(period.startKey).toBe("2026-10-25");
    expect(period.endKey).toBe("2026-10-31");
    expect(period.label).toBe("Oct 25 – 31, 2026");
    expect(period.previous).toBe("2026-10-18");
    expect(period.next).toBe("2026-11-01");
  });

  it("labels a week that spans two years", () => {
    const period = resolvePeriod("week", "2026-01-01");

    expect(period.startKey).toBe("2025-12-28");
    expect(period.endKey).toBe("2026-01-03");
    expect(period.label).toBe("Dec 28, 2025 – Jan 3, 2026");
    expect(period.previous).toBe("2025-12-21");
    expect(period.next).toBe("2026-01-04");
  });

  it("resolves months, including February in a leap year", () => {
    expect(resolvePeriod("month", "2026-02").endKey).toBe("2026-02-28");
    expect(resolvePeriod("month", "2028-02").endKey).toBe("2028-02-29");
    expect(resolvePeriod("month", "2026-10").label).toBe("October 2026");
  });

  it("steps months and years across their boundaries", () => {
    expect(resolvePeriod("month", "2026-01").previous).toBe("2025-12");
    expect(resolvePeriod("month", "2026-12").next).toBe("2027-01");
    expect(resolvePeriod("year", "2026").previous).toBe("2025");
    expect(resolvePeriod("year", "2026").next).toBe("2027");
  });

  it("falls back to the current period for bad values", () => {
    const period = resolvePeriod("month", "2026-13", at(2026, 10, 29));
    expect(period.value).toBe("2026-10");
    expect(period.label).toBe("October 2026");
  });

  it("falls back to a month for an unknown mode", () => {
    const period = resolvePeriod("quarter", "", at(2026, 10, 29));
    expect(period.mode).toBe("month");
    expect(period.value).toBe("2026-10");
  });
});

describe("shiftPeriod", () => {
  it("moves by weeks, months, and years", () => {
    expect(shiftPeriod("week", "2026-10-25", 1)).toBe("2026-11-01");
    expect(shiftPeriod("month", "2026-12", 1)).toBe("2027-01");
    expect(shiftPeriod("year", "2026", -1)).toBe("2025");
  });
});

describe("isWithinPeriod", () => {
  const period = resolvePeriod("month", "2026-10");

  it("includes the first and last day", () => {
    expect(isWithinPeriod("2026-10-01", period)).toBe(true);
    expect(isWithinPeriod("2026-10-31", period)).toBe(true);
  });

  it("excludes days on either side and blanks", () => {
    expect(isWithinPeriod("2026-09-30", period)).toBe(false);
    expect(isWithinPeriod("2026-11-01", period)).toBe(false);
    expect(isWithinPeriod("", period)).toBe(false);
    expect(isWithinPeriod(null, period)).toBe(false);
  });

  it("cuts timestamps down to their date", () => {
    expect(isWithinPeriod("2026-10-31T23:59:00+08:00", period)).toBe(true);
  });
});

describe("periodFromSearchParams", () => {
  const params = (entries) => new URLSearchParams(entries);

  it("defaults to the current month", () => {
    expect(periodFromSearchParams(params({}), at(2026, 10, 29))).toEqual({
      mode: "month",
      value: "2026-10",
    });
  });

  it("keeps valid inputs", () => {
    expect(periodFromSearchParams(params({ mode: "week", value: "2026-10-25" }))).toEqual({
      mode: "week",
      value: "2026-10-25",
    });
    expect(periodFromSearchParams(params({ mode: "year", value: "2025" }))).toEqual({
      mode: "year",
      value: "2025",
    });
  });

  it("uses the module's fallback mode when the URL is empty", () => {
    expect(periodFromSearchParams(params({}), at(2026, 10, 29), "week")).toEqual({
      mode: "week",
      value: "2026-10-25",
    });
  });

  it("replaces invalid values with the current period", () => {    expect(periodFromSearchParams(params({ mode: "month", value: "2026-13" }), at(2026, 10, 29))).toEqual({
      mode: "month",
      value: "2026-10",
    });
    expect(periodFromSearchParams(params({ mode: "week", value: "2026-02-31" }), at(2026, 10, 29))).toEqual({
      mode: "week",
      value: "2026-10-25",
    });
    expect(periodFromSearchParams(params({ mode: "fortnight" }), at(2026, 10, 29))).toEqual({
      mode: "month",
      value: "2026-10",
    });
  });
});
