import { describe, expect, it } from "vitest";
import {
  formatSku,
  isCategoryNameTaken,
  isPrefixTaken,
  isValidPrefix,
  nextSku,
  normaliseCategoryName,
  normalisePrefix,
  suggestPrefix,
} from "./inventoryCategories.js";

describe("normaliseCategoryName", () => {
  it("trims and collapses whitespace", () => {
    expect(normaliseCategoryName("  Door   Magnetic  Contact ")).toBe("Door Magnetic Contact");
  });

  it("caps the length and tolerates empty input", () => {
    expect(normaliseCategoryName("x".repeat(60))).toHaveLength(40);
    expect(normaliseCategoryName(null)).toBe("");
  });
});

describe("normalisePrefix / isValidPrefix", () => {
  it("uppercases and strips punctuation", () => {
    expect(normalisePrefix(" dmp-1 ")).toBe("DMP1");
  });

  it("accepts 2–6 alphanumerics only", () => {
    expect(isValidPrefix("DMP")).toBe(true);
    expect(isValidPrefix("CCTV")).toBe(true);
    expect(isValidPrefix("A1")).toBe(true);
    expect(isValidPrefix("D")).toBe(false);
    expect(isValidPrefix("TOOLONG")).toBe(false);
    expect(isValidPrefix("D-MP")).toBe(false);
  });
});

describe("suggestPrefix", () => {
  it("takes initials for a multi-word name", () => {
    expect(suggestPrefix("Door Magnetic Contact")).toBe("DMC");
  });

  it("uses the first three letters for a single-word name", () => {
    expect(suggestPrefix("CCTV")).toBe("CCT");
    expect(suggestPrefix("Access")).toBe("ACC");
    expect(suggestPrefix("Intrusion")).toBe("INT");
  });

  it("adds a suffix when the suggestion is taken", () => {
    expect(suggestPrefix("Intrusion", ["INT"])).toBe("INT2");
    expect(suggestPrefix("Intrusion", ["INT", "INT2"])).toBe("INT3");
  });

  it("pads single letters and handles empty input", () => {
    expect(suggestPrefix("A")).toBe("AA");
    expect(suggestPrefix("")).toBe("");
  });
});

describe("formatSku", () => {
  it("pads to three digits", () => {
    expect(formatSku("dmp", 7)).toBe("DMP-007");
    expect(formatSku("DMP", 1000)).toBe("DMP-1000");
  });

  it("never produces a zero index", () => {
    expect(formatSku("DMP", 0)).toBe("DMP-001");
  });
});

describe("nextSku", () => {
  it("continues after the highest suffix, leaving gaps filled", () => {
    expect(nextSku(["DMP-001", "DMP-002", "DMP-004"], "DMP")).toBe("DMP-005");
  });

  it("includes archived and other-prefix codes safely", () => {
    expect(nextSku(["MTR-009", "DMP-006"], "DMP")).toBe("DMP-007");
    expect(nextSku(["sample"], "DMP")).toBe("DMP-001");
  });

  it("is case-insensitive on the stored code", () => {
    expect(nextSku(["dmp-003"], "DMP")).toBe("DMP-004");
  });

  it("returns an empty string without a prefix", () => {
    expect(nextSku(["DMP-001"], "")).toBe("");
  });
});

describe("isCategoryNameTaken / isPrefixTaken", () => {
  const categories = [
    { id: "1", name: "Access", prefix: "ACC" },
    { id: "2", name: "Intrusion", prefix: "INT" },
  ];

  it("matches names case-insensitively", () => {
    expect(isCategoryNameTaken("access", categories)).toBe(true);
    expect(isCategoryNameTaken("CCTV", categories)).toBe(false);
  });

  it("ignores the category being edited", () => {
    expect(isCategoryNameTaken("Access", categories, "1")).toBe(false);
    expect(isPrefixTaken("ACC", categories, "1")).toBe(false);
  });

  it("matches prefixes after normalisation", () => {
    expect(isPrefixTaken("int", categories)).toBe(true);
  });
});
