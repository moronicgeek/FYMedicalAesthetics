import "server-only";
import { randomInt } from "node:crypto";
import type { CaseOutcome, CaseStatus, TreatmentCase, User } from "@prisma/client";
import { db } from "./db";
import { decryptJson, encryptJson, decrypt, encrypt, normalisePhone, randomToken, sha256 } from "./crypto";
import { CONSENT_FORMS, type CaseType } from "./consent-forms";
import { createPatient, decryptPatient, findExistingPatient, updatePatient, type PatientRecord } from "./patients";
import { clinicName, sendEmail, sendWhatsApp, type WhatsAppMessage } from "./notify";
import { clinicInbox, getVitalRanges } from "./settings";
import { checkVitals, formatVitals, type Vitals } from "./vitals";
import { ageFrom } from "./time";
import { parseDoctorReply } from "./doctor-reply";

export type ConsentRecord = {
  formType: CaseType;
  formVersion: string;
  patient: { firstName: string; lastName: string; dateOfBirth: string; phone: string; email: string; idNumber?: string };
  treatment?: string;
  answers: Record<string, "yes" | "no">;
  details: Record<string, string>;
  emergency: { name?: string; phone?: string };
  signedName: string;
  signature: string; // PNG data URL
  signedAt: string;
};

export type OfficeUse = Record<string, string>;

export const OPEN_STATUSES: CaseStatus[] = ["CONSENTED", "AWAITING_DOCTOR", "IN_PROGRESS", "READY_TO_CLOSE", "REFERRED", "DECLINED"];

const DECISION_LINK_HOURS = 4;

async function uniqueCode() {
  for (let i = 0; i < 20; i++) {
    const code = String(randomInt(1000, 10000));
    const clash = await db.treatmentCase.findFirst({ where: { code, status: { in: OPEN_STATUSES } }, select: { id: true } });
    if (!clash) return code;
  }
  return String(randomInt(10000, 100000));
}

export async function createCaseFromConsent(consent: ConsentRecord) {
  const p = consent.patient;
  const existing = await findExistingPatient({ email: p.email, phone: p.phone, idNumber: p.idNumber });
  let patientId: string;
  if (existing) {
    const prev = decryptPatient(existing);
    const merged: PatientRecord = {
      ...prev,
      firstName: p.firstName,
      lastName: p.lastName,
      dateOfBirth: p.dateOfBirth,
      phone: p.phone,
      email: p.email,
      idNumber: p.idNumber || prev.idNumber,
      emergencyContact: consent.emergency.name || consent.emergency.phone ? consent.emergency : prev.emergencyContact,
      medical: { ...prev.medical, medications: consent.details.medications || prev.medical.medications },
    };
    const { id: _id, createdAt: _c, updatedAt: _u, ...record } = merged as PatientRecord & { id?: string; createdAt?: Date; updatedAt?: Date };
    await updatePatient(existing.id, record);
    patientId = existing.id;
  } else {
    const created = await createPatient({
      firstName: p.firstName,
      lastName: p.lastName,
      dateOfBirth: p.dateOfBirth,
      idNumber: p.idNumber,
      email: p.email,
      phone: p.phone,
      contactPreference: "both",
      emergencyContact: consent.emergency.name || consent.emergency.phone ? consent.emergency : undefined,
      medical: {
        medications: consent.details.medications,
        conditions: consent.details.yesDetails,
        previousTreatments: consent.details.previousTreatments,
        pregnantOrBreastfeeding: consent.answers.pregnant === "yes" ? "yes" : "na",
        smoker: "no",
      },
      consent: { dataProcessing: true, accuracy: true, marketing: false, signedName: consent.signedName, signedAt: consent.signedAt },
    });
    patientId = created.id;
  }

  return db.treatmentCase.create({
    data: { code: await uniqueCode(), type: consent.formType, patientId, consent: encryptJson(consent) },
  });
}

// Emails the signed consent to the patient and the clinic inbox.
export async function emailConsent(caseId: string) {
  const { buildConsentPdf } = await import("./consent-pdf");
  const row = await db.treatmentCase.findUniqueOrThrow({ where: { id: caseId } });
  const consent = decryptJson<ConsentRecord>(row.consent);
  const form = CONSENT_FORMS[consent.formType];
  const pdf = await buildConsentPdf(consent, row.code);
  const name = `${consent.patient.firstName} ${consent.patient.lastName}`;
  const filename = `Consent - ${form.shortName} - ${name} - ${consent.signedAt.slice(0, 10)}.pdf`.replace(/[^\w .,-]/g, "");
  const result = await sendEmail(
    [consent.patient.email, clinicInbox()],
    `Your signed consent form - ${clinicName()}`,
    `Hello ${consent.patient.firstName},\n\nThank you for visiting ${clinicName()}. A copy of the consent form you signed today is attached for your records.\n\n${form.postCare ? `Post-care advice: ${form.postCare}\n\n` : ""}${clinicName()}\nManaged by Lumiere Clinic, Robertsham, Johannesburg`,
    [{ filename, content: pdf }],
  );
  if (result.ok) await db.treatmentCase.update({ where: { id: caseId }, data: { consentEmailedAt: new Date() } });
  return result;
}

export type DecryptedCase = Omit<TreatmentCase, "consent" | "preVitals" | "postVitals" | "officeUse" | "closingNotes" | "practitionerSignature"> & {
  consent: ConsentRecord;
  preVitals?: Vitals;
  postVitals?: Vitals;
  officeUse: OfficeUse;
  closingNotes?: string;
  practitionerSignature?: string;
};

export function decryptCase(row: TreatmentCase): DecryptedCase {
  return {
    ...row,
    consent: decryptJson<ConsentRecord>(row.consent),
    preVitals: row.preVitals ? decryptJson<Vitals>(row.preVitals) : undefined,
    postVitals: row.postVitals ? decryptJson<Vitals>(row.postVitals) : undefined,
    officeUse: row.officeUse ? decryptJson<OfficeUse>(row.officeUse) : {},
    closingNotes: row.closingNotes ? decrypt(row.closingNotes) : undefined,
    practitionerSignature: row.practitionerSignature ? decrypt(row.practitionerSignature) : undefined,
  };
}

export async function getCase(id: string) {
  const row = await db.treatmentCase.findUnique({
    where: { id },
    include: { doctor: { select: { id: true, name: true, phone: true } }, practitioner: { select: { id: true, name: true } } },
  });
  if (!row) return null;
  const { doctor, practitioner, ...rest } = row;
  return { ...decryptCase(rest), doctor, practitioner };
}

function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function doctorRequestMessage(c: { code: string; consent: ConsentRecord; preVitals: Vitals }, link: string): WhatsAppMessage {
  const p = c.consent.patient;
  const patient = `${p.firstName} ${p.lastName.charAt(0).toUpperCase()}., ${ageFrom(p.dateOfBirth)}y`;
  const drip = c.consent.treatment || "Not specified";
  const vitals = formatVitals(c.preVitals);
  return {
    template: "doctorApproval",
    variables: [c.code, patient, drip, vitals, link],
    fallbackText: [
      `${clinicName()}: IV drip approval #${c.code}`,
      `Patient: ${patient}`,
      `Drip: ${drip}`,
      `Vitals: ${vitals}`,
      `Reply YES ${c.code} to approve or NO ${c.code} to decline.`,
      `Or open: ${link}`,
    ].join("\n"),
  };
}

export type PreVitalsResult = { status: "referred"; outOfRange: ReturnType<typeof checkVitals>["outOfRange"] } | { status: "sent"; delivered: boolean };

export async function recordPreVitals(caseId: string, practitionerId: string, vitals: Vitals, doctor: Pick<User, "id" | "phone">): Promise<PreVitalsResult> {
  const check = checkVitals(vitals, await getVitalRanges());
  if (!check.withinRange) {
    // Out of range: the practitioner must not proceed, and nothing goes to the doctor.
    await db.treatmentCase.update({
      where: { id: caseId },
      data: { practitionerId, preVitals: encryptJson(vitals), preVitalsAt: new Date(), vitalsWithinRange: false, status: "REFERRED" },
    });
    return { status: "referred", outOfRange: check.outOfRange };
  }

  const token = randomToken(24);
  const row = await db.treatmentCase.update({
    where: { id: caseId },
    data: {
      practitionerId,
      doctorId: doctor.id,
      preVitals: encryptJson(vitals),
      preVitalsAt: new Date(),
      vitalsWithinRange: true,
      status: "AWAITING_DOCTOR",
      doctorRequestedAt: new Date(),
      decisionTokenHash: sha256(token),
      decisionTokenExpires: new Date(Date.now() + DECISION_LINK_HOURS * 3_600_000),
    },
  });
  const delivered = await sendDoctorRequest(row.id, token, doctor.phone);
  return { status: "sent", delivered };
}

async function sendDoctorRequest(caseId: string, token: string, phone: string | null) {
  if (!phone) return false;
  const c = await getCase(caseId);
  if (!c?.preVitals) return false;
  const result = await sendWhatsApp(normalisePhone(phone), doctorRequestMessage({ ...c, preVitals: c.preVitals }, `${appUrl()}/d/${token}`));
  return result.ok;
}

// Sends the approval request again with a fresh link (e.g. the doctor didn't get it).
export async function resendDoctorRequest(caseId: string) {
  const c = await db.treatmentCase.findUnique({ where: { id: caseId }, include: { doctor: true } });
  if (!c || c.status !== "AWAITING_DOCTOR" || !c.doctor) return false;
  const token = randomToken(24);
  await db.treatmentCase.update({
    where: { id: caseId },
    data: { decisionTokenHash: sha256(token), decisionTokenExpires: new Date(Date.now() + DECISION_LINK_HOURS * 3_600_000), doctorRequestedAt: new Date() },
  });
  return sendDoctorRequest(caseId, token, c.doctor.phone);
}

export async function recordDecision(caseId: string, approve: boolean, via: string) {
  // Only a case still waiting can be decided, so a late or duplicate reply is ignored.
  const updated = await db.treatmentCase.updateMany({
    where: { id: caseId, status: "AWAITING_DOCTOR" },
    data: {
      doctorDecision: approve,
      doctorDecisionAt: new Date(),
      doctorDecisionVia: via,
      status: approve ? "IN_PROGRESS" : "DECLINED",
      decisionTokenHash: null,
      decisionTokenExpires: null,
    },
  });
  return updated.count === 1;
}

export async function findCaseByDecisionToken(token: string) {
  const row = await db.treatmentCase.findUnique({ where: { decisionTokenHash: sha256(token) }, include: { doctor: { select: { name: true } } } });
  if (!row || !row.decisionTokenExpires || row.decisionTokenExpires < new Date() || row.status !== "AWAITING_DOCTOR") return null;
  return row;
}

export async function handleDoctorReply(fromPhone: string, body: string): Promise<string> {
  const reply = parseDoctorReply(body);
  if (!reply) return "Please reply YES or NO followed by the case number, e.g. YES 4821.";
  const from = normalisePhone(fromPhone.replace(/^whatsapp:/, ""));
  const doctors = (await db.user.findMany({ where: { role: "DOCTOR", active: true, phone: { not: null } } })).filter((d) => normalisePhone(d.phone!) === from);
  if (doctors.length === 0) return "This number isn't registered to a doctor at the clinic.";
  const pending = await db.treatmentCase.findMany({
    where: { doctorId: { in: doctors.map((d) => d.id) }, status: "AWAITING_DOCTOR", ...(reply.code ? { code: reply.code } : {}) },
    orderBy: { doctorRequestedAt: "desc" },
  });
  if (pending.length === 0) return reply.code ? `No case #${reply.code} is waiting for your approval.` : "No case is waiting for your approval.";
  if (pending.length > 1) return `More than one case is waiting. Please reply with the number, e.g. YES ${pending[0].code}.`;
  const c = pending[0];
  await recordDecision(c.id, reply.approve, "WhatsApp");
  await db.auditLog.create({ data: { userId: doctors[0].id, action: reply.approve ? "doctor-approve" : "doctor-decline", entity: "TreatmentCase", entityId: c.id } });
  return reply.approve ? `Thank you. #${c.code} approved; the practitioner can proceed.` : `Thank you. #${c.code} declined; the practitioner will not proceed.`;
}

export async function recordPostVitals(caseId: string, vitals: Vitals, officeUse: OfficeUse) {
  await db.treatmentCase.updateMany({
    where: { id: caseId, status: "IN_PROGRESS" },
    data: { postVitals: encryptJson(vitals), postVitalsAt: new Date(), officeUse: encryptJson(officeUse), status: "READY_TO_CLOSE" },
  });
}

export function outcomeFor(status: CaseStatus): CaseOutcome | null {
  if (status === "READY_TO_CLOSE" || status === "CONSENTED") return "COMPLETED";
  if (status === "REFERRED") return "REFERRED_VITALS";
  if (status === "DECLINED") return "DOCTOR_DECLINED";
  return null;
}

export async function closeCase(caseId: string, practitionerId: string, notes: string | undefined, signature: string, officeUse?: OfficeUse) {
  const row = await db.treatmentCase.findUniqueOrThrow({ where: { id: caseId } });
  const outcome = row.type === "IV_DRIP" ? (row.status === "CONSENTED" ? null : outcomeFor(row.status)) : outcomeFor(row.status);
  if (!outcome) return false;
  await db.treatmentCase.update({
    where: { id: caseId },
    data: {
      status: "CLOSED",
      outcome,
      closedAt: new Date(),
      practitionerId: row.practitionerId ?? practitionerId,
      closingNotes: notes ? encrypt(notes) : null,
      practitionerSignature: encrypt(signature),
      ...(officeUse ? { officeUse: encryptJson({ ...(row.officeUse ? decryptJson<OfficeUse>(row.officeUse) : {}), ...officeUse }) } : {}),
    },
  });
  return true;
}

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  CONSENTED: "Consent signed: waiting for practitioner",
  AWAITING_DOCTOR: "Waiting for doctor's approval",
  IN_PROGRESS: "Approved: treatment in progress",
  READY_TO_CLOSE: "Ready to close",
  REFERRED: "Vitals out of range: refer to doctor",
  DECLINED: "Doctor said no: refer to doctor",
  CLOSED: "Closed",
};

export const OUTCOME_LABEL: Record<CaseOutcome, string> = {
  COMPLETED: "Completed",
  REFERRED_VITALS: "Not treated: vitals out of range, referred to doctor",
  DOCTOR_DECLINED: "Not treated: doctor declined, referred to doctor",
};

