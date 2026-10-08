import { describe, expect, it } from "vitest";
import { ageFrom, clinicDateString, clinicDayRange, formatTime, zonedToUtc } from "../src/lib/time";

describe("clinic timezone helpers", () => {
  it("converts clinic wall time to UTC", () => {
    expect(zonedToUtc("2026-10-08", "09:30", "Africa/Johannesburg").toISOString()).toBe("2026-10-08T07:30:00.000Z");
    expect(zonedToUtc("2026-07-01", "09:00", "Europe/London").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(zonedToUtc("2026-01-15", "09:00", "Europe/London").toISOString()).toBe("2026-01-15T09:00:00.000Z");
  });

  it("formats back to the same wall time", () => {
    expect(formatTime(zonedToUtc("2026-10-08", "14:15", "Africa/Johannesburg"), "Africa/Johannesburg")).toBe("14:15");
  });

  it("gives the clinic-local day boundaries", () => {
    const { start, end } = clinicDayRange("2026-10-08", "Africa/Johannesburg");
    expect(start.toISOString()).toBe("2026-10-07T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-08T22:00:00.000Z");
    expect(clinicDateString(new Date("2026-10-07T23:00:00Z"), "Africa/Johannesburg")).toBe("2026-10-08");
  });

  it("calculates age", () => {
    expect(ageFrom("1950-10-09", new Date("2026-10-08T12:00:00Z"))).toBe(75);
    expect(ageFrom("1950-10-08", new Date("2026-10-08T12:00:00Z"))).toBe(76);
  });
});
