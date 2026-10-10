"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { CONSENT_FORMS, isCaseType } from "@/lib/consent-forms";
import { cookies } from "next/headers";
import {
  cancelCase,
  canTreat,
  checkInCase,
  completeClientForm,
  closeCase,
  createCaseFromConsent,
  emailConsent,
  getCase,
  recordDecision,
  recordPostVitals,
  recordPreVitals,
  resendDoctorRequest,
  saveAssessment,
  signConsent,
  startCase,
  type CaseRecord,
  type ConsentRecord,
  type OfficeUse,
} from "@/lib/cases";
import type { ConsentFormDef } from "@/lib/consent-forms";
import { KIOSK_COOKIE } from "@/lib/kiosk";
import { validIdPhoto, validSignature } from "@/lib/signature";
import { formToObject, type FieldErrors } from "@/lib/validation";
import { parseVitals } from "@/lib/vitals";

export type ConsentFormState = { errors?: FieldErrors; values?: Record<string, string> };

function parseHistory(def: ConsentFormDef, values: Record<string, string>, errors: FieldErrors) {
  const answers: CaseRecord["answers"] = {};
  for (const q of def.questions) {
    const a = values[`q_${q.id}`];
    if (a !== "yes" && a !== "no") errors[`q_${q.id}`] = "Please answer yes or no.";
    else answers[q.id] = a;
  }
  if (Object.values(answers).includes("yes") && def.detailFields.some((d) => d.id === "yesDetails") && !values.yesDetails?.trim()) {
    errors.yesDetails = "There is a yes answer above. Please give details.";
  }
  return answers;
}

function checkAcknowledgements(def: ConsentFormDef, values: Record<string, string>, errors: FieldErrors) {
  def.acknowledgements.forEach((_, i) => {
    if (values[`ack_${i}`] !== "on") errors[`ack_${i}`] = "Please tick to confirm.";
  });
}

function parseTreatment(def: ConsentFormDef, values: Record<string, string>, errors: FieldErrors) {
  const chosen = def.treatmentChoice?.options.filter((o) => values[`treatment_${o}`] === "on") ?? [];
  const treatment = [...chosen, values.treatmentOther?.trim()].filter(Boolean).join(", ");
  if (def.treatmentChoice && !treatment && def.type !== "LASER") errors.treatment = `Please fill in: ${def.treatmentChoice.label.toLowerCase()}.`;
  return treatment || (def.type === "LASER" ? "Laser" : undefined);
}

const patientDetails = z.object({
  firstName: z.string().trim().min(1, "Please enter your first name."),
  lastName: z.string().trim().min(1, "Please enter your surname."),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please enter your date of birth."),
  phone: z.string().trim().regex(/^\+?[\d\s()-]{7,20}$/, "Please enter a valid phone number."),
  email: z.email("Please enter a valid email address. We'll send your signed form here."),
  idNumber: z.string().trim().optional(),
  signedName: z.string().trim().min(1, "Please type your full name."),
});

export async function submitConsentAction(_prev: ConsentFormState, form: FormData): Promise<ConsentFormState> {
  const user = await requireUser();
  const values = formToObject(form);
  const type = values.formType;
  if (!type || !isCaseType(type)) return { errors: { form: "Unknown consent form." }, values };
  const def = CONSENT_FORMS[type];
  const errors: FieldErrors = {};

  const parsed = patientDetails.safeParse(values);
  if (!parsed.success) for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;

  const answers = parseHistory(def, values, errors);
  checkAcknowledgements(def, values, errors);
  const treatment = parseTreatment(def, values, errors);

  if (!validSignature(values.signature)) errors.signature = "Please sign in the box.";

  if (Object.keys(errors).length || !parsed.success) {
    return { errors: Object.keys(errors).length ? errors : { form: "Please check the form." }, values };
  }

  const consent: ConsentRecord = {
    formType: type,
    formVersion: def.version,
    patient: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      dateOfBirth: parsed.data.dateOfBirth,
      phone: parsed.data.phone,
      email: parsed.data.email,
      idNumber: parsed.data.idNumber || undefined,
    },
    treatment,
    answers,
    details: Object.fromEntries(def.detailFields.map((d) => [d.id, values[d.id]?.trim() ?? ""])),
    emergency: { name: values.emergencyName?.trim() || undefined, phone: values.emergencyPhone?.trim() || undefined },
    signedName: parsed.data.signedName,
    signature: values.signature,
    signedAt: new Date().toISOString(),
  };

  // Injections and laser: completing the form the client was handed after
  // check-in. Otherwise the self-service kiosk, which starts a new case.
  if (values.caseId) {
    if (!(await completeClientForm(values.caseId, consent))) return { errors: { form: "This form has already been completed." }, values };
    await audit(user, "consent-signed", "TreatmentCase", values.caseId);
    await emailConsent(values.caseId).catch(() => undefined);
    redirect(`/kiosk/case/${values.caseId}?signed=1`);
  }
  const created = await createCaseFromConsent(consent);
  await audit(user, "consent-signed", "TreatmentCase", created.id);
  // Saved first; the email is best-effort and can be resent from the case.
  await emailConsent(created.id).catch(() => undefined);
  redirect(values.mode === "kiosk" ? `/kiosk/case/${created.id}` : `/cases/${created.id}`);
}

export type StepState = { errors?: FieldErrors; values?: Record<string, string>; message?: string };

async function loadOpenCase(id: string) {
  const c = await getCase(id);
  if (!c) throw new Error("Case not found");
  return c;
}

export async function preVitalsAction(_prev: StepState, form: FormData): Promise<StepState> {
  const user = await requireUser(["ADMIN", "DOCTOR", "PRACTITIONER"]);
  const values = formToObject(form);
  const c = await loadOpenCase(values.caseId);
  if (c.type !== "IV_DRIP" || c.status !== "CONSENTED") return { errors: { form: "This step has already been done." }, values };
  const { vitals, errors } = parseVitals(values);
  const doctor = await db.user.findFirst({ where: { id: values.doctorId, role: "DOCTOR", active: true } });
  const allErrors: FieldErrors = { ...(errors ?? {}) };
  if (!doctor) allErrors.doctorId = "Please choose the doctor to approve.";
  else if (!doctor.phone) allErrors.doctorId = `${doctor.name} has no mobile number saved. An administrator can add it on the Staff page.`;
  if (!vitals || Object.keys(allErrors).length) return { errors: allErrors, values };

  const result = await recordPreVitals(c.id, user.id, vitals, doctor!);
  await audit(user, result.status === "referred" ? "vitals-out-of-range" : "vitals-sent-to-doctor", "TreatmentCase", c.id);
  revalidatePath(`/cases/${c.id}`);
  redirect(`/cases/${c.id}${result.status === "sent" && !result.delivered ? "?undelivered=1" : ""}`);
}

export async function resendDoctorAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("caseId"));
  const ok = await resendDoctorRequest(id);
  await audit(user, "doctor-request-resent", "TreatmentCase", id);
  redirect(`/cases/${id}${ok ? "?resent=1" : "?undelivered=1"}`);
}

// Fallback when the doctor phones in their answer instead of replying.
export async function manualDecisionAction(form: FormData) {
  const user = await requireUser(["ADMIN", "DOCTOR", "PRACTITIONER"]);
  const id = String(form.get("caseId"));
  const approve = form.get("decision") === "yes";
  if (await recordDecision(id, approve, `recorded by ${user.name}`)) {
    await audit(user, approve ? "doctor-approve-recorded" : "doctor-decline-recorded", "TreatmentCase", id);
  }
  redirect(`/cases/${id}`);
}

function officeUseFrom(values: Record<string, string>, type: keyof typeof CONSENT_FORMS): OfficeUse {
  return Object.fromEntries(CONSENT_FORMS[type].officeUse.map((f) => [f.id, values[`office_${f.id}`]?.trim() ?? ""]));
}

export async function postVitalsAction(_prev: StepState, form: FormData): Promise<StepState> {
  const user = await requireUser(["ADMIN", "DOCTOR", "PRACTITIONER"]);
  const values = formToObject(form);
  const c = await loadOpenCase(values.caseId);
  if (c.status !== "IN_PROGRESS") return { errors: { form: "This step isn't available." }, values };
  const { vitals, errors } = parseVitals(values);
  if (!vitals) return { errors, values };
  await recordPostVitals(c.id, vitals, officeUseFrom(values, c.type));
  await audit(user, "post-vitals", "TreatmentCase", c.id);
  redirect(`/cases/${c.id}`);
}

export async function closeCaseAction(_prev: StepState, form: FormData): Promise<StepState> {
  const user = await requireUser(["ADMIN", "DOCTOR", "PRACTITIONER"]);
  const values = formToObject(form);
  const c = await loadOpenCase(values.caseId);
  if (!canTreat(user.role, c.type)) return { errors: { form: "Only a doctor can close an injection or laser case." }, values };
  const notes = values.notes?.trim();
  const errors: FieldErrors = {};
  if (notes && notes.length > 200) errors.notes = "Please keep notes to 200 characters.";
  if (!validSignature(values.signature)) errors.signature = "Please sign in the box.";
  if (Object.keys(errors).length) return { errors, values };
  const officeUse = c.type === "IV_DRIP" ? undefined : officeUseFrom(values, c.type);
  if (!(await closeCase(c.id, user.id, notes, values.signature, officeUse))) return { errors: { form: "This case can't be closed yet." }, values };
  await audit(user, "case-closed", "TreatmentCase", c.id);
  redirect(`/cases/${c.id}?closed=1`);
}

export async function resendConsentAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("caseId"));
  const result = await emailConsent(id);
  await audit(user, "consent-resent", "TreatmentCase", id);
  redirect(`/cases/${id}?${result.ok ? "emailed=1" : "emailfail=1"}`);
}

// --- Practitioner-led intake ----------------------------------------------

const phoneNumber = z.string().trim().regex(/^\+?[\d\s()-]{7,20}$/, "Please enter a valid phone number.");
const optionalPhone = z.union([z.literal(""), phoneNumber]).optional().transform((v) => v || undefined);

const checkInSchema = z.object({
  firstName: z.string().trim().min(1, "Please enter the first name."),
  lastName: z.string().trim().min(1, "Please enter the surname."),
  idNumber: z.string().trim().min(5, "Please enter the ID or passport number."),
  phone: phoneNumber,
  emergencyName: z.string().trim().optional().transform((v) => v || undefined),
  emergencyPhone: optionalPhone,
});

export async function checkInAction(_prev: ConsentFormState, form: FormData): Promise<ConsentFormState> {
  const user = await requireUser();
  const values = formToObject(form);
  const errors: FieldErrors = {};
  const parsed = checkInSchema.safeParse(values);
  if (!parsed.success) for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
  if (!values.formType || !isCaseType(values.formType)) errors.formType = "Please choose the treatment.";
  if (Object.keys(errors).length || !parsed.success) return { errors, values };

  const type = values.formType as keyof typeof CONSENT_FORMS;
  const startNow = values.intent === "start";
  const iv = type === "IV_DRIP";
  if (startNow && iv && !canTreat(user.role, type)) return { errors: { form: "Only a practitioner or doctor can start an IV drip. Add the client to the waiting list instead." }, values };
  const created = await checkInCase({ type, ...parsed.data }, startNow && iv ? user : undefined);
  await audit(user, startNow && iv ? "case-started" : "checked-in", "TreatmentCase", created.id);
  if (!startNow) redirect(`/cases?checkedin=1`);
  if (iv) redirect(`/cases/${created.id}`);
  await lockTablet();
  await audit(user, "handed-to-patient", "TreatmentCase", created.id);
  redirect(`/kiosk/form/${created.id}`);
}

async function lockTablet() {
  (await cookies()).set(KIOSK_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}

// Injections and laser: the client fills in their own details, medical history
// and signature on the tablet, which locks to their form.
export async function handToClientAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("caseId"));
  const c = await loadOpenCase(id);
  if (c.status !== "QUEUED" || c.type === "IV_DRIP") redirect(`/cases/${id}`);
  await lockTablet();
  await audit(user, "handed-to-patient", "TreatmentCase", id);
  redirect(`/kiosk/form/${id}`);
}

export async function startCaseAction(form: FormData) {
  const user = await requireUser(["ADMIN", "DOCTOR", "PRACTITIONER"]);
  const id = String(form.get("caseId"));
  const c = await loadOpenCase(id);
  if (!canTreat(user.role, c.type) || c.type !== "IV_DRIP") redirect(`/cases/${id}`);
  await startCase(id, user.id);
  await audit(user, "case-started", "TreatmentCase", id);
  redirect(`/cases/${id}`);
}

export async function cancelCaseAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("caseId"));
  if (await cancelCase(id)) await audit(user, "case-cancelled", "TreatmentCase", id);
  redirect("/cases");
}

const assessmentDetails = z.object({
  firstName: z.string().trim().min(1, "Please enter the first name."),
  lastName: z.string().trim().min(1, "Please enter the surname."),
  idNumber: z.string().trim().min(5, "Please enter the ID or passport number."),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please enter the date of birth."),
  phone: phoneNumber,
  email: z.email("Please enter a valid email address. The signed form is sent here."),
});

export async function assessmentAction(_prev: StepState, form: FormData): Promise<StepState> {
  const user = await requireUser(["ADMIN", "DOCTOR", "PRACTITIONER"]);
  const values = formToObject(form);
  const c = await loadOpenCase(values.caseId);
  if (c.status !== "ASSESSMENT") return { errors: { form: "This step has already been done." }, values };
  if (!canTreat(user.role, c.type)) return { errors: { form: "Only a doctor can take on this treatment." }, values };
  const def = CONSENT_FORMS[c.type];
  const errors: FieldErrors = {};

  const parsed = assessmentDetails.safeParse(values);
  if (!parsed.success) for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
  const answers = parseHistory(def, values, errors);
  const treatment = parseTreatment(def, values, errors);
  const idPhoto = values.idPhoto || undefined;
  if (idPhoto && !validIdPhoto(idPhoto)) errors.idPhoto = "The ID photo couldn't be read. Please take it again.";

  const iv = c.type === "IV_DRIP";
  const vitalsResult = iv ? parseVitals(values) : {};
  if (vitalsResult.errors) Object.assign(errors, vitalsResult.errors);
  const doctor = iv ? await db.user.findFirst({ where: { id: values.doctorId, role: "DOCTOR", active: true } }) : null;
  if (iv && !doctor) errors.doctorId = "Please choose the doctor to approve.";
  else if (iv && !doctor!.phone) errors.doctorId = `${doctor!.name} has no mobile number saved. An administrator can add it on the Staff page.`;

  if (Object.keys(errors).length || !parsed.success) {
    // The photo is kept in the browser; don't send it back with the form.
    const { idPhoto: _photo, ...rest } = values;
    return { errors: Object.keys(errors).length ? errors : { form: "Please check the form." }, values: rest };
  }

  const record: CaseRecord = {
    ...c.consent,
    formVersion: def.version,
    patient: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      idNumber: parsed.data.idNumber,
      dateOfBirth: parsed.data.dateOfBirth,
      phone: parsed.data.phone,
      email: parsed.data.email,
    },
    treatment,
    answers,
    details: Object.fromEntries(def.detailFields.map((d) => [d.id, values[d.id]?.trim() ?? ""])),
    emergency: { name: values.emergencyName?.trim() || undefined, phone: values.emergencyPhone?.trim() || undefined },
  };
  await saveAssessment(c.id, record, idPhoto, user);
  await audit(user, "assessment-saved", "TreatmentCase", c.id);

  if (!iv) redirect(`/cases/${c.id}`);
  const result = await recordPreVitals(c.id, user.id, vitalsResult.vitals!, doctor!);
  await audit(user, result.status === "referred" ? "vitals-out-of-range" : "vitals-sent-to-doctor", "TreatmentCase", c.id);
  revalidatePath(`/cases/${c.id}`);
  redirect(`/cases/${c.id}${result.status === "sent" && !result.delivered ? "?undelivered=1" : ""}`);
}

// Locks the tablet to this patient's signing screen. A staff member signs in
// again to take it back, so the patient can't reach anything else.
export async function handToPatientAction(form: FormData) {
  const user = await requireUser(["ADMIN", "DOCTOR", "PRACTITIONER"]);
  const id = String(form.get("caseId"));
  const c = await loadOpenCase(id);
  if (c.status !== "AWAITING_SIGNATURE") redirect(`/cases/${id}`);
  await lockTablet();
  await audit(user, "handed-to-patient", "TreatmentCase", id);
  redirect(`/kiosk/sign/${id}`);
}

export async function signConsentAction(_prev: ConsentFormState, form: FormData): Promise<ConsentFormState> {
  const user = await requireUser();
  const values = formToObject(form);
  const c = await loadOpenCase(values.caseId);
  const def = CONSENT_FORMS[c.type];
  const errors: FieldErrors = {};
  checkAcknowledgements(def, values, errors);
  if (!values.signedName?.trim()) errors.signedName = "Please type your full name.";
  if (!validSignature(values.signature)) errors.signature = "Please sign in the box.";
  if (Object.keys(errors).length) return { errors, values };
  if (!(await signConsent(c.id, values.signedName.trim(), values.signature))) return { errors: { form: "This form has already been signed." }, values };
  await audit(user, "consent-signed", "TreatmentCase", c.id);
  // Saved first; the email is best-effort and can be resent from the case.
  await emailConsent(c.id).catch(() => undefined);
  redirect(`/kiosk/case/${c.id}?signed=1`);
}
