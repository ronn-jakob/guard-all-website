// Accepts a ?date=YYYY-MM-DD prefill from Scheduling, but only if it is a real
// calendar date — <input type="date"> silently blanks impossible ones such as
// 2026-02-31.
export function dateParamKey(value) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [year, month, day] = text.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return text;
}
