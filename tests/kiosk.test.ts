import { describe, expect, it } from "vitest";
import { KIOSK_FORM_HOURS, kioskLockedCase, kioskLockValue } from "../src/lib/kiosk";

describe("tablet handed over for one case", () => {
  const now = Date.UTC(2026, 9, 19, 8, 0);

  it("opens only the case it was handed over for", () => {
    expect(kioskLockedCase(kioskLockValue("cm1abc", now), now + 60_000)).toBe("cm1abc");
  });

  it("opens no case from the start screen lock", () => {
    expect(kioskLockValue()).toBe("1");
    expect(kioskLockedCase("1", now)).toBeNull();
    expect(kioskLockedCase(undefined, now)).toBeNull();
  });

  it("closes the form once the handover is too old", () => {
    const value = kioskLockValue("cm1abc", now);
    expect(kioskLockedCase(value, now + KIOSK_FORM_HOURS * 3_600_000)).toBeNull();
  });

  it("ignores a handover time in the future", () => {
    expect(kioskLockedCase(kioskLockValue("cm1abc", now + 60_000), now)).toBeNull();
  });
});
