import "server-only";
import type { Patient } from "@prisma/client";
import { db } from "./db";
import { blindIndex, decryptJson, encryptJson, normaliseEmail, normaliseIdNumber, normalisePhone } from "./crypto";
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
  contactPreference: "sms" | "email" | "both";
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

export function decryptPatient(row: Patient): DecryptedPatient {
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

// Finds an existing patient by exact email, phone or ID number match, so
// reception can avoid creating duplicate records when someone returns.
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

// Names are encrypted, so text search decrypts and filters in memory. That's
// fine at clinic scale (thousands of records). Exact phone/email/ID matches
// use the blind index instead.
export async function searchPatients(query: string, limit = 50): Promise<DecryptedPatient[]> {
  const q = query.trim().toLowerCase();
  if (q) {
    const exact = await findExistingPatient({ email: q.includes("@") ? q : undefined, phone: /\d{7,}/.test(q) ? q : "", idNumber: q });
    if (exact) return [decryptPatient(exact)];
  }
  const rows = await db.patient.findMany({ orderBy: { updatedAt: "desc" } });
  const patients = rows.map(decryptPatient);
  const matches = q
    ? patients.filter((p) =>
        [p.firstName, p.lastName, p.preferredName, `${p.firstName} ${p.lastName}`]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q)),
      )
    : patients;
  return matches.slice(0, limit);
}
