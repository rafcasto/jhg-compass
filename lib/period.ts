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

/** Monday–Friday. The 5-workday week means a weekend day carries no daily share of a target. */
export function isWorkday(d: Date): boolean {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

export type TargetUnit = "day" | "week" | "month";
export interface DisplayTarget {
  /** The figure to show. Never 0 for a row that has a weekly target. */
  value: number;
  /** The unit the figure is in — may differ from the period (a 1/wk row in Day view shows "1 / wk"). */
  unit: TargetUnit;
  /** True when the figure is computed from the weekly base rather than the base itself. */
  derived: boolean;
}

// What the TARGET cell shows for the selected period. Targets are stored and edited
// per WEEK; day and month figures are derived for display only (the lossy reverse
// conversion was how a "1 / day" tap used to write 5 / wk). Rules:
//   • week  → the stored figure.
//   • day   → weekly / 5 workdays when that is ≥ 1 and the day is a workday;
//             otherwise the weekly figure itself, with its unit, so a 1 / wk row
//             never reads as "0" (or as having no target at all).
//   • month → weekly × days-in-month / 7.
export function displayTarget(weekly: number, period: Period, anchor: Date): DisplayTarget {
  const w = Math.max(0, Math.round(weekly));
  if (period === "week") return { value: w, unit: "week", derived: false };
  if (period === "month") return { value: scaleTarget(w, "month", anchor), unit: "month", derived: true };
  if (w >= WORKDAYS_PER_WEEK && isWorkday(anchor)) return { value: scaleTarget(w, "day", anchor), unit: "day", derived: true };
  return { value: w, unit: "week", derived: false };
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
