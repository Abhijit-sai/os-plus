// Match the India business-day boundary used by the operational listing RPC,
// independently of the server/browser timezone. Delivery columns are dates.
export function deliveryDayOffset(value: string | null, now = new Date()): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) => parts.find(entry => entry.type === name)?.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const due = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(due) ? (due - Date.parse(`${today}T00:00:00Z`)) / 86_400_000 : null;
}
