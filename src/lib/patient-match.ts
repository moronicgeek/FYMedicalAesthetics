import type { PatientRecord } from "./patients";
import { normaliseIdNumber } from "./crypto";
import { dateOfBirthFromSaId } from "./sa-id";

export type Identity = Pick<PatientRecord, "firstName" | "lastName" | "dateOfBirth" | "idNumber">;

function normaliseName(name: string | undefined) {
  return (name ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
}

function birthDate(p: Identity) {
  return p.dateOfBirth || dateOfBirthFromSaId(p.idNumber) || "";
}

// Whether two sets of details are the same person. A shared phone number or
// email isn't enough: families often share one, and matching on it alone let
// one person's details overwrite another's. The first name must match, and
// the date of birth too when both are known (else the surname, so a married
// name change still matches on the date of birth). Two different ID numbers
// are never the same person.
export function samePerson(a: Identity, b: Identity) {
  const idA = a.idNumber ? normaliseIdNumber(a.idNumber) : "";
  const idB = b.idNumber ? normaliseIdNumber(b.idNumber) : "";
  if (idA && idB && idA !== idB) return false;
  if (normaliseName(a.firstName) !== normaliseName(b.firstName)) return false;
  const dobA = birthDate(a);
  const dobB = birthDate(b);
  if (dobA && dobB) return dobA === dobB;
  return normaliseName(a.lastName) === normaliseName(b.lastName);
}

function fill<T extends string | undefined>(next: T, prev: T): T {
  return next?.trim() ? next : prev;
}

// A returning patient's new form updates their record without wiping what is
// already on file: anything left blank keeps the stored value.
export function mergePatientRecord(prev: PatientRecord, next: PatientRecord): PatientRecord {
  const emergency = { ...prev.emergencyContact };
  for (const [k, v] of Object.entries(next.emergencyContact ?? {})) {
    emergency[k as keyof typeof emergency] = fill(v, emergency[k as keyof typeof emergency]);
  }
  return {
    ...next,
    firstName: fill(next.firstName, prev.firstName),
    lastName: fill(next.lastName, prev.lastName),
    preferredName: fill(next.preferredName, prev.preferredName),
    dateOfBirth: fill(next.dateOfBirth, prev.dateOfBirth),
    gender: fill(next.gender, prev.gender),
    idNumber: fill(next.idNumber, prev.idNumber),
    email: fill(next.email, prev.email),
    phone: fill(next.phone, prev.phone),
    address: fill(next.address, prev.address),
    treatmentInterest: fill(next.treatmentInterest, prev.treatmentInterest),
    emergencyContact: Object.values(emergency).some(Boolean) ? emergency : undefined,
    medical: {
      ...next.medical,
      conditions: fill(next.medical.conditions, prev.medical.conditions),
      medications: fill(next.medical.medications, prev.medical.medications),
      allergies: fill(next.medical.allergies, prev.medical.allergies),
      previousTreatments: fill(next.medical.previousTreatments, prev.medical.previousTreatments),
    },
  };
}
