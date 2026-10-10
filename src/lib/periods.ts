// Reporting periods for the admin overview: a day, a week (Monday to Sunday)
// or a calendar month in the clinic's timezone, browsable up to three months
// back from today.
import { clinicDateString, clinicDayRange, clinicTimeZone } from "./time";

export type PeriodView = "day" | "week" | "month";
export const PERIOD_VIEWS: PeriodView[] = ["day", "week", "month"];
export const MONTHS_BACK = 3;

export type Period = {
  view: PeriodView;
  // First and last clinic-local dates in the period (inclusive), YYYY-MM-DD.
  from: string;
  to: string;
  start: Date;
  end: Date;
  label: string;
  // Anchor dates for the previous and next periods, or null past the limits.
  prev: string | null;
  next: string | null;
  // The same-length period just before, for comparisons.
  // The period before, for comparisons: cut to the same length so far while
  // this period is still running.
  previous: { start: Date; end: Date; label: string };
};

export function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function addMonths(date: string, months: number) {
  const [y, m, d] = date.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay))).toISOString().slice(0, 10);
}

function weekStart(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(date, -dow);
}

function bounds(view: PeriodView, date: string) {
  if (view === "day") return { from: date, to: date };
  if (view === "week") {
    const from = weekStart(date);
    return { from, to: addDays(from, 6) };
  }
  const from = `${date.slice(0, 7)}-01`;
  return { from, to: addDays(addMonths(from, 1), -1) };
}

function step(view: PeriodView, date: string, n: number) {
  return view === "day" ? addDays(date, n) : view === "week" ? addDays(date, 7 * n) : addMonths(date, n);
}

function labelFor(view: PeriodView, from: string, to: string) {
  const fmt = (date: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts }).format(new Date(`${date}T12:00:00Z`));
  if (view === "day") return fmt(from, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (view === "month") return fmt(from, { month: "long", year: "numeric" });
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  return `${fmt(from, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" })} to ${fmt(to, { day: "numeric", month: "short", year: "numeric" })}`;
}

// The earliest date the overview goes back to.
export function earliestDate(today: string) {
  return addMonths(today, -MONTHS_BACK);
}

export function parseView(value: string | undefined): PeriodView {
  return PERIOD_VIEWS.includes(value as PeriodView) ? (value as PeriodView) : "week";
}

export function resolvePeriod(view: PeriodView, anchor: string | undefined, now = new Date(), timeZone = clinicTimeZone()): Period {
  const today = clinicDateString(now, timeZone);
  const earliest = earliestDate(today);
  let date = anchor && /^\d{4}-\d{2}-\d{2}$/.test(anchor) && !Number.isNaN(Date.parse(anchor)) ? anchor : today;
  if (date > today) date = today;
  if (date < earliest) date = earliest;

  const { from, to } = bounds(view, date);
  const start = clinicDayRange(from, timeZone).start;
  const end = clinicDayRange(to, timeZone).end;
  const prevDate = step(view, date, -1);
  const nextDate = step(view, date, 1);
  const prevBounds = bounds(view, prevDate);
  const nextBounds = bounds(view, nextDate);
  // While the period is still running, compare with the same stretch of the
  // one before (e.g. the first ten days of last month), not all of it.
  const prevStart = clinicDayRange(prevBounds.from, timeZone).start;
  const unit = view === "day" ? "day" : view === "week" ? "week" : "month";
  const prevEnd = clinicDayRange(prevBounds.to, timeZone).end;
  const previous =
    end > now
      ? {
          start: prevStart,
          end: new Date(Math.min(prevEnd.getTime(), prevStart.getTime() + Math.max(0, now.getTime() - start.getTime()))),
          label: view === "day" ? "this time yesterday" : `the same point last ${unit}`,
        }
      : { start: prevStart, end: prevEnd, label: `the ${unit} before` };
  return {
    view,
    from,
    to,
    start,
    end,
    label: labelFor(view, from, to),
    // A period is reachable while any part of it is inside the window.
    prev: prevBounds.to >= earliest ? (prevDate < earliest ? earliest : prevDate) : null,
    next: nextBounds.from <= today ? (nextDate > today ? today : nextDate) : null,
    previous,
  };
}

// Every clinic-local date in a period, in order.
export function datesIn(from: string, to: string) {
  const dates: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
  return dates;
}

// Clinic-local date, hour and weekday (Monday = 0) of an instant.
export function clinicParts(date: Date, timeZone = clinicTimeZone()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short" })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), weekday };
}
