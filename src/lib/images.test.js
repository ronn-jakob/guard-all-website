import { describe, expect, it } from "vitest";
import {
  PROFILE_PHOTO_MAX_BYTES,
  initialsFor,
  prepareProfilePhoto,
} from "./images.js";

describe("initialsFor", () => {
  it("takes the first letter of each name", () => {
    expect(initialsFor("Maria", "Santos")).toBe("MS");
    expect(initialsFor("juan", "dela cruz")).toBe("JD");
  });

  it("handles a missing last name", () => {
    expect(initialsFor("Maria", "")).toBe("M");
  });

  it("falls back to the role or a placeholder", () => {
    expect(initialsFor("", "", "Admin")).toBe("AD");
    expect(initialsFor("", "", "")).toBe("");
  });
});

describe("prepareProfilePhoto validation", () => {
  const image = (overrides = {}) =>
    new File([new Uint8Array(8)], "photo.png", { type: "image/png", ...overrides });

  it("rejects a non-image file", async () => {
    const file = new File(["text"], "notes.txt", { type: "text/plain" });
    await expect(prepareProfilePhoto(file)).rejects.toThrow(/JPEG, PNG, or WebP/);
  });

  it("rejects a file over 5 MB", async () => {
    const file = image();
    Object.defineProperty(file, "size", { value: PROFILE_PHOTO_MAX_BYTES + 1 });
    await expect(prepareProfilePhoto(file)).rejects.toThrow(/5 MB or smaller/);
  });

  it("rejects an empty selection", async () => {
    await expect(prepareProfilePhoto(null)).rejects.toThrow(/Choose an image/);
  });
});
