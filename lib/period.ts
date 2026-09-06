// Day / week / month period helpers for the tracker + dashboard.
// Weeks start Monday (matches the JHG monthly tracker).

export type Period = "day" | "week" | "month";

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}

export function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0);
  return x;
}

function daysInMonth(anchor: Date): number {
  return new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
}

// How many days the period spans (used for target scaling).
export function periodDays(period: Period, anchor: Date): number {
  if (period === "day") return 1;
  if (period === "week") return 7;
  return daysInMonth(anchor);
}

// Inclusive [start, end] as YYYY-MM-DD strings for the given period + anchor date.
export function rangeYmd(period: Period, anchor: Date): { start: string; end: string } {
  if (period === "day") return { start: ymd(anchor), end: ymd(anchor) };
  if (period === "week") {
    const m = mondayOf(anchor);
    return { start: ymd(m), end: ymd(addDays(m, 6)) };
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { start: ymd(first), end: ymd(last) };
}

// Millisecond [start, end) for filtering createdAt timestamps by period.
export function rangeMs(period: Period, anchor: Date): { start: number; end: number } {
  const r = rangeYmd(period, anchor);
  return { start: new Date(r.start + "T00:00:00").getTime(), end: new Date(r.end + "T23:59:59.999").getTime() };
}

export function shift(period: Period, anchor: Date, dir: -1 | 1): Date {
  if (period === "day") return addDays(anchor, dir);
  if (period === "week") return addDays(anchor, 7 * dir);
  return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
}

export function periodLabel(period: Period, anchor: Date): string {
  if (period === "day")
    return anchor.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (period === "week") {
    const m = mondayOf(anchor); const e = addDays(m, 6);
    const f = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${f(m)} – ${f(e)}`;
  }
  return anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

// ----- target conversion: one canonical WEEKLY base, shown/edited per period -----
// A job-search week is 5 WORKDAYS: a daily target is weekly / 5, so a 5/wk default
// reads as 1/day (not 1 for both 5/wk and 8/wk, as a 7-day split gave).
// Months stay calendar-based (daysInMonth / 7 weeks in the month).
export const WORKDAYS_PER_WEEK = 5;

// Scale a weekly target down/up to the selected period (for display).
export function scaleTarget(weeklyTarget: number, period: Period, anchor: Date): number {
  if (period === "week") return Math.round(weeklyTarget);
  if (period === "day") return Math.round(weeklyTarget / WORKDAYS_PER_WEEK);
  return Math.round((weeklyTarget * periodDays(period, anchor)) / 7);
}
// Convert a value entered in the current period back to the weekly base (for storage).
export function toWeekly(entered: number, period: Period, anchor: Date): number {
  if (period === "week") return Math.max(0, Math.round(entered));
  if (period === "day") return Math.max(0, Math.round(entered * WORKDAYS_PER_WEEK));
  return Math.max(0, Math.round((entered * 7) / periodDays(period, anchor)));
}

export function inRange(loggedOn: string, r: { start: string; end: string }): boolean {
  return loggedOn >= r.start && loggedOn <= r.end;
}

// Firestore Timestamp | number | null -> ms
export function tsMs(v: any): number {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  return 0;
}

// ----- RAG (red / amber / green) status for actual vs target -----
export type Rag = "green" | "amber" | "red" | "none";
export function rag(actual: number, target: number): Rag {
  if (target <= 0) return actual > 0 ? "green" : "none";
  const r = actual / target;
  if (r >= 1) return "green";
  if (r >= 0.5) return "amber";
  return "red";
}
export const RAG_BAR: Record<Rag, string> = {
  green: "bg-rb-green-dark", amber: "bg-rb-orange", red: "bg-jh-red", none: "bg-jh-line-2",
};
export const RAG_TEXT: Record<Rag, string> = {
  green: "text-rb-green-dark", amber: "text-rb-orange", red: "text-jh-red", none: "text-jh-mute-2",
};
export const RAG_SOFT: Record<Rag, string> = {
  green: "bg-rb-green-dark/10", amber: "bg-rb-orange/10", red: "bg-jh-red/10", none: "bg-jh-mist",
};
