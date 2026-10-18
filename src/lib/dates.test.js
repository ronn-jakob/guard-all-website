import { describe, expect, it } from "vitest";
import { dateParamKey } from "./dates.js";

describe("dateParamKey", () => {
  it("accepts a real calendar date", () => {
    expect(dateParamKey("2026-10-20")).toBe("2026-10-20");
  });

  it("accepts a leap day", () => {
    expect(dateParamKey("2028-02-29")).toBe("2028-02-29");
  });

  it("rejects an impossible day", () => {
    expect(dateParamKey("2026-02-31")).toBeNull();
  });

  it("rejects a non-leap 29 February", () => {
    expect(dateParamKey("2026-02-29")).toBeNull();
  });

  it("rejects an impossible month", () => {
    expect(dateParamKey("2026-13-01")).toBeNull();
  });

  it("rejects an unpadded date", () => {
    expect(dateParamKey("2026-2-3")).toBeNull();
  });

  it("rejects empty, missing, and junk values", () => {
    expect(dateParamKey("")).toBeNull();
    expect(dateParamKey(null)).toBeNull();
    expect(dateParamKey(undefined)).toBeNull();
    expect(dateParamKey("garbage")).toBeNull();
    expect(dateParamKey("2026-10-20T00:00:00Z")).toBeNull();
  });
});
