import { describe, expect, it } from "vitest";
import { parseDoctorReply } from "../src/lib/doctor-reply";
import { checkVitals, DEFAULT_RANGES, parseVitals } from "../src/lib/vitals";

describe("doctor WhatsApp replies", () => {
  it("reads yes and no in the forms doctors actually type", () => {
    expect(parseDoctorReply("YES 4821")).toEqual({ approve: true, code: "4821" });
    expect(parseDoctorReply("yes")).toEqual({ approve: true, code: undefined });
    expect(parseDoctorReply("Y #4821")).toEqual({ approve: true, code: "4821" });
    expect(parseDoctorReply(" no 4821 ")).toEqual({ approve: false, code: "4821" });
    expect(parseDoctorReply("N")).toEqual({ approve: false, code: undefined });
  });

  it("ignores anything else", () => {
    expect(parseDoctorReply("maybe")).toBeNull();
    expect(parseDoctorReply("")).toBeNull();
    expect(parseDoctorReply("yesterday's case")).toBeNull();
  });
});

describe("vitals range check", () => {
  const ok = { systolic: 120, diastolic: 80, heartRate: 70, glucose: 5.5 };

  it("passes readings inside the ranges", () => {
    expect(checkVitals(ok, DEFAULT_RANGES).withinRange).toBe(true);
  });

  it("flags each reading outside its range", () => {
    const r = checkVitals({ ...ok, systolic: 165, glucose: 2.1 }, DEFAULT_RANGES);
    expect(r.withinRange).toBe(false);
    expect(r.outOfRange.map((o) => o.key).sort()).toEqual(["glucose", "systolic"]);
  });

  it("ignores optional readings that were not taken", () => {
    expect(checkVitals(ok, DEFAULT_RANGES).outOfRange).toHaveLength(0);
  });

  it("requires the four core readings", () => {
    expect(parseVitals({ systolic: "120" }).errors).toMatchObject({ diastolic: expect.any(String), heartRate: expect.any(String), glucose: expect.any(String) });
    expect(parseVitals({ systolic: "120", diastolic: "80", heartRate: "70", glucose: "5,5" }).vitals).toEqual({ systolic: 120, diastolic: 80, heartRate: 70, glucose: 5.5 });
  });

  it("rejects nonsense numbers", () => {
    expect(parseVitals({ systolic: "abc", diastolic: "80", heartRate: "70", glucose: "5.5" }).errors?.systolic).toBeTruthy();
  });
});
