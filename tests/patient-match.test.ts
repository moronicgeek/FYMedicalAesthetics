import { describe, expect, it } from "vitest";
import { mergePatientRecord, samePerson } from "../src/lib/patient-match";
import type { PatientRecord } from "../src/lib/patients";

const mother = { firstName: "Thandi", lastName: "Nkosi", dateOfBirth: "1975-03-02", idNumber: "7503020123085" };

describe("matching a returning patient", () => {
  it("does not treat family members who share contact details as the same person", () => {
    expect(samePerson(mother, { firstName: "Lerato", lastName: "Nkosi", dateOfBirth: "2001-06-11" })).toBe(false);
  });

  it("does not treat twins as the same person", () => {
    expect(samePerson(mother, { firstName: "Zanele", lastName: "Nkosi", dateOfBirth: "1975-03-02" })).toBe(false);
  });

  it("matches the same person regardless of case, spacing and accents", () => {
    expect(samePerson({ firstName: "Zoë ", lastName: "du  Plessis", dateOfBirth: "" }, { firstName: "zoe", lastName: "Du Plessis", dateOfBirth: "" })).toBe(true);
  });

  it("still matches after a surname change when the date of birth agrees", () => {
    expect(samePerson(mother, { firstName: "Thandi", lastName: "Mokoena", dateOfBirth: "1975-03-02" })).toBe(true);
  });

  it("reads the date of birth from an SA ID number when none was typed", () => {
    expect(samePerson(mother, { firstName: "Thandi", lastName: "Mokoena", dateOfBirth: "", idNumber: "7503020123085" })).toBe(true);
  });

  it("never matches two different ID numbers", () => {
    expect(samePerson(mother, { ...mother, idNumber: "8001015009087" })).toBe(false);
  });

  it("does not match someone else's ID number typed with a different name", () => {
    expect(samePerson(mother, { firstName: "Sipho", lastName: "Dlamini", dateOfBirth: "", idNumber: mother.idNumber })).toBe(false);
  });
});

describe("updating a returning patient's record", () => {
  const stored: PatientRecord = {
    firstName: "Thandi",
    lastName: "Nkosi",
    dateOfBirth: "1975-03-02",
    idNumber: "7503020123085",
    email: "thandi@example.com",
    phone: "+27821234567",
    address: "12 Main Rd",
    contactPreference: "both",
    emergencyContact: { name: "Sipho", phone: "+27829876543", relationship: "Husband" },
    medical: { allergies: "Penicillin", medications: "Metformin", pregnantOrBreastfeeding: "no", smoker: "no" },
    consent: { dataProcessing: true, accuracy: true, marketing: true, signedName: "Thandi Nkosi", signedAt: "2026-01-01T00:00:00.000Z" },
  };

  it("keeps stored answers the new form left blank", () => {
    const merged = mergePatientRecord(stored, {
      ...stored,
      email: undefined,
      address: "",
      emergencyContact: { phone: "+27820000000" },
      medical: { allergies: "", medications: "Insulin", pregnantOrBreastfeeding: "no", smoker: "no" },
      consent: { ...stored.consent, marketing: false, signedAt: "2026-10-17T00:00:00.000Z" },
    });
    expect(merged.email).toBe("thandi@example.com");
    expect(merged.address).toBe("12 Main Rd");
    expect(merged.medical.allergies).toBe("Penicillin");
    expect(merged.medical.medications).toBe("Insulin");
    expect(merged.emergencyContact).toEqual({ name: "Sipho", phone: "+27820000000", relationship: "Husband" });
    expect(merged.consent).toEqual({ ...stored.consent, marketing: false, signedAt: "2026-10-17T00:00:00.000Z" });
  });
});
