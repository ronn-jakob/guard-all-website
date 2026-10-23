// Profile photo preparation and initials. The server is the authority on the
// stored file; these helpers only validate and shrink the browser's copy.

export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function initialsFor(firstName, lastName, fallback = "") {
  const first = String(firstName ?? "").trim();
  const last = String(lastName ?? "").trim();
  const letters = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  if (letters) return letters;
  const text = String(fallback ?? "").trim();
  return text ? text.slice(0, 2).toUpperCase() : "";
}

// Square centre crop, then downscale to maxEdge. Returns a JPEG File; falls back
// to the original when the browser cannot decode it.
export async function prepareProfilePhoto(file, { maxEdge = 512 } = {}) {
  if (!file) throw new Error("Choose an image file.");
  if (!PROFILE_PHOTO_TYPES.includes(String(file.type))) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  if (file.size > PROFILE_PHOTO_MAX_BYTES) {
    throw new Error("The photo must be 5 MB or smaller.");
  }

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const edge = Math.min(bitmap.width, bitmap.height);
    if (!edge) {
      bitmap.close?.();
      return file;
    }
    const scale = Math.min(1, maxEdge / edge);
    const size = Math.max(1, Math.round(edge * scale));
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close?.();
      return file;
    }
    context.drawImage(
      bitmap,
      (bitmap.width - edge) / 2,
      (bitmap.height - edge) / 2,
      edge,
      edge,
      0,
      0,
      size,
      size,
    );
    bitmap.close?.();
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) return file;
    const name = `${String(file.name || "avatar").replace(/\.[^.]+$/, "")}.jpg`;
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
