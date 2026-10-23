// Category names and item codes. The Edge Function generates the authoritative
// code; these helpers drive the preview and keep the form's validation in step.

const MAX_NAME_LENGTH = 40;
const PREFIX_PATTERN = /^[A-Z0-9]{2,6}$/;

export function normaliseCategoryName(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_NAME_LENGTH);
}

export function normalisePrefix(value) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidPrefix(value) {
  // Mirrors the server check: case is normalised, punctuation is not forgiven.
  return PREFIX_PATTERN.test(String(value ?? "").trim().toUpperCase());
}

// Initials for a multi-word name ("Door Magnetic Contact" → DMC), the first
// three letters for a single one ("Access" → ACC). Collisions gain a numeric
// suffix. It is only a suggestion — the prefix stays editable.
export function suggestPrefix(name, taken = []) {
  const text = normaliseCategoryName(name);
  if (!text) return "";
  const words = text.split(" ").filter(Boolean);
  const letters = words.map((word) => word.replace(/[^a-z0-9]/gi, ""));
  let base =
    words.length > 1
      ? letters.map((word) => word.charAt(0)).join("")
      : (letters[0] ?? "").slice(0, 3);
  base = base.toUpperCase().slice(0, 6);
  if (base.length < 2) base = `${base}${base}`.slice(0, 2);

  const used = new Set((taken ?? []).map((value) => normalisePrefix(value)));
  if (!used.has(base)) return base;
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const text = String(suffix);
    const candidate = `${base.slice(0, Math.max(2, 6 - text.length))}${text}`;
    if (!used.has(candidate)) return candidate;
  }
  return base;
}

export function formatSku(prefix, number) {
  const clean = normalisePrefix(prefix);
  const value = Math.max(1, Math.floor(Number(number) || 1));
  return `${clean}-${String(value).padStart(3, "0")}`;
}

// Highest suffix already used for the prefix, archived codes included, so a
// reactivated part is never handed a duplicate.
export function nextSku(existingSkus = [], prefix) {
  const clean = normalisePrefix(prefix);
  if (!clean) return "";
  const pattern = new RegExp(`^${clean}-(\\d+)$`, "i");
  let highest = 0;
  for (const sku of existingSkus) {
    const match = pattern.exec(String(sku ?? ""));
    if (!match) continue;
    highest = Math.max(highest, Number(match[1]));
  }
  return formatSku(clean, highest + 1);
}

export function isCategoryNameTaken(name, categories = [], excludeId = "") {
  const target = normaliseCategoryName(name).toLowerCase();
  return categories.some(
    (category) =>
      category.id !== excludeId &&
      String(category.name ?? "").trim().toLowerCase() === target,
  );
}

export function isPrefixTaken(prefix, categories = [], excludeId = "") {
  const target = normalisePrefix(prefix);
  return categories.some(
    (category) =>
      category.id !== excludeId &&
      normalisePrefix(category.prefix) === target,
  );
}
