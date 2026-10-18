import { describe, expect, it } from "vitest";
import { buildAllocationPrefill } from "./allocation.js";

const stock = (overrides) => ({
  stock_id: "s1",
  part_id: "p1",
  quantity_on_hand: 10,
  quantity_reserved: 0,
  ...overrides,
});

describe("buildAllocationPrefill", () => {
  it("selects a quoted line at its quoted quantity", () => {
    const result = buildAllocationPrefill({
      items: [stock({})],
      quotedParts: [{ partId: "p1", description: "Camera", quantity: 4 }],
    });

    expect(result.selected).toEqual({ s1: true });
    expect(result.quantities).toEqual({ s1: "4" });
    expect(result.quotedByStock).toEqual({ s1: 4 });
    expect(result.unavailable).toEqual([]);
    expect(result.quotedCount).toBe(1);
  });

  it("clamps to what the branch actually holds and flags the shortfall", () => {
    const result = buildAllocationPrefill({
      items: [stock({ quantity_on_hand: 5, quantity_reserved: 4 })],
      quotedParts: [{ partId: "p1", description: "Camera", quantity: 9 }],
    });

    expect(result.quantities).toEqual({ s1: "1" });
    expect(result.quotedByStock).toEqual({ s1: 9 });
    expect(result.unavailable.map((line) => line.reason)).toEqual([
      "Branch stock is short",
    ]);
  });

  it("reports a quoted part the branch does not carry", () => {
    const result = buildAllocationPrefill({
      items: [stock({ part_id: "p2", stock_id: "s2" })],
      quotedParts: [{ partId: "p1", description: "Camera", quantity: 2 }],
    });

    expect(result.selected).toEqual({});
    expect(result.unavailable.map((line) => line.reason)).toEqual([
      "No stock record at this branch",
    ]);
  });

  it("reports a part with nothing available", () => {
    const result = buildAllocationPrefill({
      items: [stock({ quantity_on_hand: 3, quantity_reserved: 3 })],
      quotedParts: [{ partId: "p1", description: "Camera", quantity: 2 }],
    });

    expect(result.selected).toEqual({});
    expect(result.unavailable.map((line) => line.reason)).toEqual([
      "Nothing available at this branch",
    ]);
  });

  it("returns an empty prefill for a job without part lines", () => {
    const result = buildAllocationPrefill({ items: [], quotedParts: [] });

    expect(result.selected).toEqual({});
    expect(result.quantities).toEqual({});
    expect(result.unavailable).toEqual([]);
    expect(result.quotedCount).toBe(0);
  });

  it("ignores quoted lines without a part id", () => {
    const result = buildAllocationPrefill({
      items: [stock({})],
      quotedParts: [{ partId: "", description: "Nonsense", quantity: 3 }],
    });

    expect(result.quotedCount).toBe(0);
    expect(result.selected).toEqual({});
  });

  it("handles several lines at once, mixing matches and gaps", () => {
    const result = buildAllocationPrefill({
      items: [
        stock({ stock_id: "s1", part_id: "p1", quantity_on_hand: 6 }),
        stock({ stock_id: "s2", part_id: "p2", quantity_on_hand: 1 }),
      ],
      quotedParts: [
        { partId: "p1", description: "Camera", quantity: 2 },
        { partId: "p2", description: "Cable", quantity: 5 },
        { partId: "p3", description: "Bracket", quantity: 1 },
      ],
    });

    expect(result.selected).toEqual({ s1: true, s2: true });
    expect(result.quantities).toEqual({ s1: "2", s2: "1" });
    expect(result.unavailable.map((line) => line.reason)).toEqual([
      "Branch stock is short",
      "No stock record at this branch",
    ]);
    expect(result.quotedCount).toBe(3);
  });
});
