import "server-only";
import type { Patient, Role } from "@prisma/client";
import { db } from "./db";
import { blindIndex, decrypt, decryptJson, encryptJson, normaliseEmail, normaliseIdNumber, normalisePhone } from "./crypto";
import { samePerson, type Identity } from "./patient-match";
import { canSeeService } from "./access";
import type { PatientInput } from "./validation";

export type PatientRecord = {
  firstName: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth: string;
  gender?: string;
  idNumber?: string;
  email?: string;
  phone: string;
  address?: string;
  contactPreference: "whatsapp" | "email" | "both";
  emergencyContact?: { name?: string; phone?: string; relationship?: string };
  medical: {
    conditions?: string;
    medications?: string;
    allergies?: string;
    previousTreatments?: string;
    pregnantOrBreastfeeding: "yes" | "no" | "na";
    smoker: "yes" | "no";
  };
  treatmentInterest?: string;
  consent: { dataProcessing: true; accuracy: true; marketing: boolean; signedName: string; signedAt: string };
};

export type DecryptedPatient = PatientRecord & { id: string; createdAt: Date; updatedAt: Date };

export function toRecord(input: PatientInput, signedAt = new Date()): PatientRecord {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    preferredName: input.preferredName,
    dateOfBirth: input.dateOfBirth,
    gender: input.gender,
    idNumber: input.idNumber,
    email: input.email,
    phone: input.phone,
    address: input.address,
    contactPreference: input.contactPreference,
    emergencyContact:
      input.emergencyName || input.emergencyPhone
        ? { name: input.emergencyName, phone: input.emergencyPhone, relationship: input.emergencyRelationship }
        : undefined,
    medical: {
      conditions: input.conditions,
      medications: input.medications,
      allergies: input.allergies,
      previousTreatments: input.previousTreatments,
      pregnantOrBreastfeeding: input.pregnantOrBreastfeeding,
      smoker: input.smoker,
    },
    treatmentInterest: input.treatmentInterest,
    consent: {
      dataProcessing: true,
      accuracy: true,
      marketing: input.consentMarketing === "on",
      signedName: input.signedName,
      signedAt: signedAt.toISOString(),
    },
  };
}

export function lookupHashes(record: Pick<PatientRecord, "email" | "phone" | "idNumber">) {
  return {
    emailHash: record.email ? blindIndex(normaliseEmail(record.email)) : null,
    phoneHash: record.phone ? blindIndex(normalisePhone(record.phone)) : null,
    idNumberHash: record.idNumber ? blindIndex(normaliseIdNumber(record.idNumber)) : null,
  };
}

// Just the stored details, without the row's id and timestamps: what to
// change and pass back to updatePatient.
export function patientRecord(row: Pick<Patient, "data">): PatientRecord {
  return decryptJson<PatientRecord>(row.data);
}

export function decryptPatient(row: Pick<Patient, "id" | "data" | "createdAt" | "updatedAt">): DecryptedPatient {
  return { ...decryptJson<PatientRecord>(row.data), id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

export function displayName(p: Pick<PatientRecord, "firstName" | "lastName" | "preferredName">) {
  return p.preferredName ? `${p.preferredName} ${p.lastName}` : `${p.firstName} ${p.lastName}`;
}

export async function createPatient(record: PatientRecord) {
  return db.patient.create({
    data: { data: encryptJson(record), consentAt: new Date(record.consent.signedAt), ...lookupHashes(record) },
  });
}

export async function updatePatient(id: string, record: PatientRecord) {
  return db.patient.update({ where: { id }, data: { data: encryptJson(record), ...lookupHashes(record) } });
}

export async function getPatient(id: string) {
  const row = await db.patient.findUnique({ where: { id } });
  return row ? decryptPatient(row) : null;
}

// Finds a patient by exact email, phone or ID number, for staff searching the
// patient list. Use findSamePatient before saving a form to a record.
export async function findExistingPatient(record: Pick<PatientRecord, "email" | "phone" | "idNumber">) {
  const hashes = lookupHashes(record);
  const or = [
    hashes.idNumberHash && { idNumberHash: hashes.idNumberHash },
    hashes.emailHash && { emailHash: hashes.emailHash },
    hashes.phoneHash && { phoneHash: hashes.phoneHash },
  ].filter(Boolean) as object[];
  if (or.length === 0) return null;
  return db.patient.findFirst({ where: { OR: or } });
}

// Finds the stored record for a returning patient: one sharing their ID
// number, email or phone that is also the same person by name and date of
// birth (see samePerson). An ID number match wins over a contact match.
export async function findSamePatient(record: Identity & Pick<PatientRecord, "email" | "phone">) {
  const hashes = lookupHashes(record);
  const or = [
    hashes.idNumberHash && { idNumberHash: hashes.idNumberHash },
    hashes.emailHash && { emailHash: hashes.emailHash },
    hashes.phoneHash && { phoneHash: hashes.phoneHash },
  ].filter(Boolean) as object[];
  if (or.length === 0) return null;
  const rows = await db.patient.findMany({ where: { OR: or }, orderBy: { updatedAt: "desc" } });
  const same = rows.filter((row) => samePerson(decryptPatient(row), record));
  return same.find((row) => hashes.idNumberHash && row.idNumberHash === hashes.idNumberHash) ?? same[0] ?? null;
}

// Names are encrypted, so text search decrypts and filters in memory. That's
// fine at clinic scale (thousands of records). Exact phone/email/ID matches
// use the blind index instead.
export async function searchPatients(query: string, role: Role, limit = 50): Promise<DecryptedPatient[]> {
  const q = query.trim().toLowerCase();
  if (q) {
    const exact = await findExistingPatient({ email: q.includes("@") ? q : undefined, phone: /\d{7,}/.test(q) ? q : "", idNumber: q });
    if (exact) return visiblePatients(role, [decryptPatient(exact)]);
  }
  const rows = await db.patient.findMany({ orderBy: { updatedAt: "desc" } });
  const patients = await visiblePatients(role, rows.map(decryptPatient));
  const matches = q
    ? patients.filter((p) =>
        [p.firstName, p.lastName, p.preferredName, `${p.firstName} ${p.lastName}`]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q)),
      )
    : patients;
  return matches.slice(0, limit);
}

// Practitioners only do IV drips, so clients who have only come in for
// injections or laser (cases or doctor-only bookings) are hidden from them.
// Anyone who has had an IV drip, and anyone with no visits yet, stays visible.
async function hiddenFromPractitioners(patientId?: string): Promise<Set<string>> {
  const [cases, appointments] = await Promise.all([
    db.treatmentCase.findMany({ where: { patientId: patientId ?? { not: null } }, select: { patientId: true, type: true } }),
    db.appointment.findMany({ where: patientId ? { patientId } : {}, select: { patientId: true, service: true } }),
  ]);
  const hidden = new Set<string>();
  for (const c of cases) if (c.type !== "IV_DRIP") hidden.add(c.patientId!);
  for (const a of appointments) if (!canSeeService("PRACTITIONER", decrypt(a.service))) hidden.add(a.patientId);
  for (const c of cases) if (c.type === "IV_DRIP") hidden.delete(c.patientId!);
  return hidden;
}

export async function canSeePatient(role: Role, patientId: string) {
  return role !== "PRACTITIONER" || !(await hiddenFromPractitioners(patientId)).has(patientId);
}

export async function visiblePatients<T extends { id: string }>(role: Role, patients: T[]): Promise<T[]> {
  if (role !== "PRACTITIONER") return patients;
  const hidden = await hiddenFromPractitioners();
  return patients.filter((p) => !hidden.has(p.id));
}
