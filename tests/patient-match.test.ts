import { describe, expect, it } from "vitest";
import { checkIdOwner, keepIdentity, mergePatientRecord, samePerson } from "../src/lib/patient-match";
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

describe("an ID number already on file", () => {
  const owner = { ...mother, id: "rec1" };
  const typo = { firstName: "Tandi", lastName: "Nkosi", dateOfBirth: "", idNumber: mother.idNumber };

  it("is a new client when nobody holds the ID number", () => {
    expect(checkIdOwner(null, typo)).toBe("none");
  });

  it("uses the record when the details are the same person", () => {
    expect(checkIdOwner(owner, { ...typo, firstName: "thandi" })).toBe("same");
  });

  it("asks staff before using the record when the name differs", () => {
    expect(checkIdOwner(owner, typo)).toBe("ask");
  });

  it("uses the record once staff confirmed that record", () => {
    expect(checkIdOwner(owner, typo, { confirmedPatientId: "rec1" })).toBe("confirmed");
    expect(checkIdOwner(owner, typo, { confirmedPatientId: "rec2" })).toBe("ask");
  });

  it("flags the client's own tablet form instead of asking them", () => {
    expect(checkIdOwner(owner, typo, { client: true })).toBe("flag");
  });

  it("keeps the name and date of birth on file once confirmed", () => {
    const kept = keepIdentity(mother, { ...typo, lastName: "Nkosy", dateOfBirth: "1975-03-20", phone: "+27820000000" });
    expect(kept).toEqual({ ...mother, phone: "+27820000000" });
  });
});

describe("a returning client who types their name wrong but their ID number right", () => {
  const onFile: PatientRecord & { id: string } = {
    id: "rec1",
    firstName: "Thandi",
    lastName: "Nkosi",
    dateOfBirth: "1975-03-02",
    idNumber: "7503020123085",
    phone: "+27821234567",
    contactPreference: "both",
    medical: { allergies: "Penicillin", pregnantOrBreastfeeding: "no", smoker: "no" },
    consent: { dataProcessing: true, accuracy: true, marketing: false, signedName: "Thandi Nkosi", signedAt: "2026-01-01T00:00:00.000Z" },
  };
  const typed: PatientRecord = { ...onFile, firstName: "Tandi", phone: "+27820000000", medical: { allergies: "", pregnantOrBreastfeeding: "no", smoker: "no" } };

  it("is never given a second record: staff are asked, and the tablet flags the visit", () => {
    expect(checkIdOwner(onFile, typed)).toBe("ask");
    expect(checkIdOwner(onFile, typed, { client: true })).toBe("flag");
  });

  it("keeps their name on file and takes today's new details once staff confirm", () => {
    expect(checkIdOwner(onFile, typed, { confirmedPatientId: onFile.id })).toBe("confirmed");
    const saved = mergePatientRecord(onFile, keepIdentity(onFile, typed));
    expect(saved.firstName).toBe("Thandi");
    expect(saved.idNumber).toBe("7503020123085");
    expect(saved.phone).toBe("+27820000000");
    expect(saved.medical.allergies).toBe("Penicillin");
  });

  it("is matched straight away when only the case or spacing of the name differs", () => {
    expect(checkIdOwner(onFile, { ...typed, firstName: " thandi" })).toBe("same");
  });
});
