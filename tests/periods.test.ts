import { describe, expect, it } from "vitest";
import { addMonths, clinicParts, earliestDate, resolvePeriod } from "../src/lib/periods";

const TZ = "Africa/Johannesburg";
const now = new Date("2026-10-10T10:00:00Z"); // Saturday 10 October, 12:00 in Johannesburg

describe("overview periods", () => {
  it("runs weeks Monday to Sunday in clinic time", () => {
    const p = resolvePeriod("week", "2026-10-08", now, TZ);
    expect([p.from, p.to]).toEqual(["2026-10-05", "2026-10-11"]);
    expect(p.start.toISOString()).toBe("2026-10-04T22:00:00.000Z");
    expect(p.end.toISOString()).toBe("2026-10-11T22:00:00.000Z");
    expect(p.label).toBe("5 to 11 Oct 2026");
    expect(p.next).toBeNull();
    expect(p.previous.start.toISOString()).toBe("2026-09-27T22:00:00.000Z");
    // Still running, so compared with last week up to the same point.
    expect(p.previous.end.toISOString()).toBe("2026-10-03T10:00:00.000Z");
    expect(p.previous.label).toBe("the same point last week");
    expect(resolvePeriod("week", "2026-09-30", now, TZ).previous.end.toISOString()).toBe("2026-09-27T22:00:00.000Z");
  });

  it("covers whole calendar months", () => {
    const p = resolvePeriod("month", "2026-09-15", now, TZ);
    expect([p.from, p.to, p.label]).toEqual(["2026-09-01", "2026-09-30", "September 2026"]);
    expect(p.next).toBe("2026-10-10");
  });

  it("goes back three months and no further", () => {
    expect(earliestDate("2026-10-10")).toBe("2026-07-10");
    expect(resolvePeriod("day", "2026-01-01", now, TZ).from).toBe("2026-07-10");
    expect(resolvePeriod("day", "2026-07-10", now, TZ).prev).toBeNull();
    expect(resolvePeriod("month", "2026-07-20", now, TZ).prev).toBeNull();
    expect(resolvePeriod("month", "2026-08-20", now, TZ).prev).toBe("2026-07-20");
    expect(resolvePeriod("week", "2026-07-14", now, TZ).prev).toBe("2026-07-10");
  });

  it("never shows the future and ignores bad dates", () => {
    expect(resolvePeriod("day", "2027-01-01", now, TZ).from).toBe("2026-10-10");
    expect(resolvePeriod("day", "nonsense", now, TZ).from).toBe("2026-10-10");
  });

  it("keeps month-end dates valid", () => {
    expect(addMonths("2026-05-31", 1)).toBe("2026-06-30");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("reads clinic-local hour and weekday", () => {
    expect(clinicParts(new Date("2026-10-04T22:30:00Z"), TZ)).toEqual({ date: "2026-10-05", hour: 0, weekday: 0 });
  });
});
