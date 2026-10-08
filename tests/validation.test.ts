import { describe, expect, it } from "vitest";
import { patientSchema } from "../src/lib/validation";

const valid = {
  firstName: "Amina",
  lastName: "Patel",
  dateOfBirth: "1958-04-12",
  phone: "+27 82 123 4567",
  contactPreference: "sms",
  consentData: "on",
  consentAccuracy: "on",
  signedName: "Amina Patel",
};

describe("patient intake validation", () => {
  it("accepts a minimal valid form", () => {
    expect(patientSchema.safeParse(valid).success).toBe(true);
  });

  it("requires consent", () => {
    const r = patientSchema.safeParse({ ...valid, consentData: undefined });
    expect(r.success).toBe(false);
  });

  it("requires an email when reminders go by email", () => {
    const r = patientSchema.safeParse({ ...valid, contactPreference: "email" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["email"]);
  });

  it("treats blank optional fields as missing", () => {
    const r = patientSchema.safeParse({ ...valid, email: "", preferredName: "" });
    expect(r.success && r.data.email).toBe(undefined);
  });
});
