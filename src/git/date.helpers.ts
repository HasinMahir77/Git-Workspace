const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;
const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "always" });

const UNITS: [number, Intl.RelativeTimeFormatUnit][] = [
  [YEAR_MS, "year"], [MONTH_MS, "month"], [WEEK_MS, "week"], [DAY_MS, "day"], [HOUR_MS, "hour"], [MINUTE_MS, "minute"],
];

/** "3 hours ago" for an ISO timestamp. An unreadable date is returned as written. */
export function commitAge(date: string, now: number): string {
  const time = Date.parse(date);
  if (Number.isNaN(time)) return date;
  const elapsed = Math.max(0, now - time);
  const unit = UNITS.find(([size]) => elapsed >= size);
  if (!unit) return "just now";
  return relativeTime.format(-Math.floor(elapsed / unit[0]), unit[1]);
}

/** The exact local date and time, for a hover title. */
export function commitDateTitle(date: string): string {
  const time = Date.parse(date);
  return Number.isNaN(time) ? date : new Date(time).toLocaleString("en", { dateStyle: "full", timeStyle: "short" });
}
