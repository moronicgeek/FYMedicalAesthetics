// All times are stored in UTC and shown in the clinic's timezone, so staff
// and patients see the same wall-clock time whatever server runs the app.
export function clinicTimeZone() {
  return process.env.CLINIC_TIMEZONE || "Africa/Johannesburg";
}

function offsetMinutes(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return (asUtc - date.getTime()) / 60_000;
}

// Converts a wall-clock date and time in the clinic timezone to a UTC Date.
export function zonedToUtc(date: string, time: string, timeZone = clinicTimeZone()): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  let result = new Date(naive - offsetMinutes(new Date(naive), timeZone) * 60_000);
  // Second pass corrects for a DST change between the guess and the answer.
  result = new Date(naive - offsetMinutes(result, timeZone) * 60_000);
  return result;
}

// Returns the UTC instants for the start and end of a clinic-local day.
export function clinicDayRange(date: string, timeZone = clinicTimeZone()) {
  const start = zonedToUtc(date, "00:00", timeZone);
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return { start, end: zonedToUtc(next, "00:00", timeZone) };
}

export function clinicDateString(date = new Date(), timeZone = clinicTimeZone()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function formatDate(date: Date, timeZone = clinicTimeZone()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function formatTime(date: Date, timeZone = clinicTimeZone()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }).format(date);
}

export function formatDateTime(date: Date, timeZone = clinicTimeZone()) {
  return `${formatDate(date, timeZone)} at ${formatTime(date, timeZone)}`;
}

export function ageFrom(dateOfBirth: string, now = new Date()) {
  const dob = new Date(dateOfBirth);
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}
