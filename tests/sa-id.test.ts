import { describe, expect, it } from "vitest";
import { dateOfBirthFromSaId } from "../src/lib/sa-id";

describe("date of birth from a South African ID number", () => {
  const now = new Date("2026-10-09T00:00:00Z");

  it("reads the date from a valid ID number", () => {
    expect(dateOfBirthFromSaId("8001015009087", now)).toBe("1980-01-01");
    expect(dateOfBirthFromSaId("800101 5009 087", now)).toBe("1980-01-01");
  });

  it("puts two-digit years after this year in the 1900s", () => {
    expect(dateOfBirthFromSaId("0507145800086", now)).toBe("2005-07-14");
    expect(dateOfBirthFromSaId("4502280123085", now)).toBe("1945-02-28");
  });

  it("gives nothing for passports, typos and impossible dates", () => {
    expect(dateOfBirthFromSaId("A12345678", now)).toBeUndefined();
    expect(dateOfBirthFromSaId("8001015009088", now)).toBeUndefined();
    expect(dateOfBirthFromSaId("8002305009084", now)).toBeUndefined();
    expect(dateOfBirthFromSaId(undefined, now)).toBeUndefined();
  });
});
