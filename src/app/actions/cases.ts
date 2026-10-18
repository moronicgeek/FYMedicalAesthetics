"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { z } from "zod";
import { canSeeCase, canTreat } from "@/lib/access";
import { requireKioskUser, requireUser, type SessionUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { CONSENT_FORMS, isCaseType } from "@/lib/consent-forms";
import {
  cancelCase,
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
import { getIvDripNames } from "@/lib/settings";
import { isTabletLocked, lockTablet } from "@/lib/tablet";
import { validIdPhoto, validSignature } from "@/lib/signature";
import { echo, fieldErrors, formToObject, isoDate, optional, optionalPhone, phone, required, type FieldErrors } from "@/lib/validation";
import { parseVitals, type Vitals } from "@/lib/vitals";

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

// IV drips are chosen from the list an administrator keeps in Settings.
async function parseDrip(values: Record<string, string>, errors: FieldErrors) {
  const drip = values.treatmentOther?.trim();
  if (!drip) errors.treatment = "Please choose the drip from the list.";
  else if (!(await getIvDripNames()).includes(drip)) errors.treatment = `${drip} is not on the drip list. Please choose one from the list.`;
  return drip;
}

const patientDetails = z.object({
  firstName: required("your first name"),
  lastName: required("your surname"),
  dateOfBirth: isoDate("Please enter your date of birth."),
  phone,
  email: z.email("Please enter a valid email address. We'll send your signed form here."),
  idNumber: z.string().trim().optional(),
  signedName: z.string().trim().min(1, "Please type your full name."),
});

// Also used on a locked tablet.
export async function submitConsentAction(_prev: ConsentFormState, form: FormData): Promise<ConsentFormState> {
  const user = await requireKioskUser();
  const values = formToObject(form);
  const kiosk = values.mode === "kiosk" || (await isTabletLocked());
  const type = values.formType;
  if (!type || !isCaseType(type)) return { errors: { form: "Unknown consent form." }, values: echo(values) };
  const def = CONSENT_FORMS[type];
  const errors: FieldErrors = {};

  const parsed = patientDetails.safeParse(values);
  if (!parsed.success) Object.assign(errors, fieldErrors(parsed.error));

  const answers = parseHistory(def, values, errors);
  checkAcknowledgements(def, values, errors);
  // A client completing a checked-in form doesn't choose the treatment; the
  // doctor does when closing the case.
  const treatment = values.caseId ? undefined : parseTreatment(def, values, errors);

  if (!validSignature(values.signature)) errors.signature = "Please sign in the box.";

  if (Object.keys(errors).length || !parsed.success) {
    return { errors: Object.keys(errors).length ? errors : { form: "Please check the form." }, values: echo(values) };
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
    await loadOpenCase(values.caseId, user);
    if (!(await completeClientForm(values.caseId, consent))) return { errors: { form: "This form has already been completed." }, values: echo(values) };
    await audit(user, "consent-signed", "TreatmentCase", values.caseId);
    await emailConsent(values.caseId).catch(() => undefined);
    redirect(`/kiosk/case/${values.caseId}?signed=1`);
  }
  const created = await createCaseFromConsent(consent);
  await audit(user, "consent-signed", "TreatmentCase", created.id);
  // Saved first; the email is best-effort and can be resent from the case.
  await emailConsent(created.id).catch(() => undefined);
  redirect(kiosk ? `/kiosk/case/${created.id}` : `/cases/${created.id}`);
}

export type StepState = { errors?: FieldErrors; values?: Record<string, string>; message?: string };

// Loads a case the signed-in user is allowed to see. Practitioners never see
// injection or laser cases, so for them those don't exist.
async function loadOpenCase(id: string, user: SessionUser) {
  const c = await getCase(id);
  if (!c || !canSeeCase(user.role, c.type)) notFound();
  return c;
}

export async function preVitalsAction(_prev: StepState, form: FormData): Promise<StepState> {
  const user = await requireUser(["ADMIN", "DOCTOR", "PRACTITIONER"]);
  const values = formToObject(form);
  const c = await loadOpenCase(values.caseId, user);
  if (c.type !== "IV_DRIP" || c.status !== "CONSENTED") return { errors: { form: "This step has already been done." }, values: echo(values) };
  const { vitals, errors } = parseVitals(values);
  const allErrors: FieldErrors = { ...(errors ?? {}) };
  const doctor = await approvingDoctor(values.doctorId, allErrors);
  if (!vitals || !doctor || Object.keys(allErrors).length) return { errors: allErrors, values: echo(values) };
  return sendVitals(user, c.id, vitals, doctor);
}

// The doctor chosen to approve an IV drip. They need a mobile number, since
// the request goes to them on WhatsApp.
async function approvingDoctor(doctorId: string | undefined, errors: FieldErrors) {
  const doctor = doctorId ? await db.user.findFirst({ where: { id: doctorId, role: "DOCTOR", active: true } }) : null;
  if (!doctor) errors.doctorId = "Please choose the doctor to approve.";
  else if (!doctor.phone) errors.doctorId = `${doctor.name} has no mobile number saved. An administrator can add it on the Staff page.`;
  return doctor;
}

// Records the vitals before a drip, which sends them to the doctor (or refers
// the patient when a reading is out of range), and goes back to the case.
async function sendVitals(user: SessionUser, caseId: string, vitals: Vitals, doctor: Pick<User, "id" | "phone">): Promise<never> {
  const result = await recordPreVitals(caseId, user.id, vitals, doctor);
  if (result.status !== "already-done") await audit(user, result.status === "referred" ? "vitals-out-of-range" : "vitals-sent-to-doctor", "TreatmentCase", caseId);
  revalidatePath(`/cases/${caseId}`);
  redirect(`/cases/${caseId}${result.status === "sent" && !result.delivered ? "?undelivered=1" : ""}`);
}

export async function resendDoctorAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("caseId"));
  await loadOpenCase(id, user);
  const ok = await resendDoctorRequest(id);
  await audit(user, "doctor-request-resent", "TreatmentCase", id);
  redirect(`/cases/${id}${ok ? "?resent=1" : "?undelivered=1"}`);
}

// Fallback when the doctor phones in their answer instead of replying. Staff
// name the doctor who answered, and a YES needs a reason, which is kept with
// the case so nobody can quietly approve a drip themselves.
export async function manualDecisionAction(form: FormData) {
  const user = await requireUser(["ADMIN", "DOCTOR", "PRACTITIONER"]);
  const id = String(form.get("caseId"));
  await loadOpenCase(id, user);
  const approve = form.get("decision") === "yes";
  const reason = String(form.get("reason") ?? "").trim();
  const doctor = await db.user.findFirst({ where: { id: String(form.get("doctorId") ?? ""), role: "DOCTOR", active: true }, select: { id: true } });
  if (!doctor || (approve && !reason) || reason.length > 200) redirect(`/cases/${id}?decisionmissing=1`);
  if (await recordDecision(id, approve, `by phone, recorded by ${user.name}`, { doctorId: doctor.id, note: reason })) {
    await audit(user, approve ? "doctor-approve-recorded" : "doctor-decline-recorded", "TreatmentCase", id);
  }
  redirect(`/cases/${id}`);
}

function officeUseFrom(values: Record<string, string>, type: keyof typeof CONSENT_FORMS): OfficeUse {
  return Object.fromEntries(CONSENT_FORMS[type].officeUse.map((f) => [f.id, values[`office_${f.id}`]?.trim() ?? ""]));
}

// Whether this visit included a retail sale, and what was sold (typed in).
function salesFrom(values: Record<string, string>): OfficeUse {
  return { retail: values.retail === "on" ? "Yes" : "", productsSold: values.productsSold?.trim().slice(0, 500) ?? "" };
}

export async function postVitalsAction(_prev: StepState, form: FormData): Promise<StepState> {
  const user = await requireUser(["ADMIN", "DOCTOR", "PRACTITIONER"]);
  const values = formToObject(form);
  const c = await loadOpenCase(values.caseId, user);
  if (c.status !== "IN_PROGRESS") return { errors: { form: "This step isn't available." }, values: echo(values) };
  const { vitals, errors } = parseVitals(values);
  if (!vitals) return { errors, values: echo(values) };
  await recordPostVitals(c.id, vitals, officeUseFrom(values, c.type));
  await audit(user, "post-vitals", "TreatmentCase", c.id);
  redirect(`/cases/${c.id}`);
}

export async function closeCaseAction(_prev: StepState, form: FormData): Promise<StepState> {
  const user = await requireUser(["ADMIN", "DOCTOR", "PRACTITIONER"]);
  const values = formToObject(form);
  const c = await loadOpenCase(values.caseId, user);
  if (!canTreat(user.role, c.type)) return { errors: { form: "Only a doctor can close an injection or laser case." }, values: echo(values) };
  const notes = values.notes?.trim();
  const errors: FieldErrors = {};
  if (notes && notes.length > 200) errors.notes = "Please keep notes to 200 characters.";
  if (!validSignature(values.signature)) errors.signature = "Please sign in the box.";
  // Injections and laser: the doctor records which treatment was given.
  const treatment = c.type === "IV_DRIP" ? undefined : parseTreatment(CONSENT_FORMS[c.type], values, errors);
  if (Object.keys(errors).length) return { errors, values: echo(values) };
  const officeUse = { ...(c.type === "IV_DRIP" ? {} : officeUseFrom(values, c.type)), ...salesFrom(values) };
  if (!(await closeCase(c.id, user.id, notes, values.signature, officeUse, treatment))) return { errors: { form: "This case can't be closed yet." }, values: echo(values) };
  await audit(user, "case-closed", "TreatmentCase", c.id);
  // Back to Today so the next client can be picked up.
  redirect("/dashboard?closed=1");
}

export async function resendConsentAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("caseId"));
  await loadOpenCase(id, user);
  const result = await emailConsent(id);
  await audit(user, "consent-resent", "TreatmentCase", id);
  redirect(`/cases/${id}?${result.ok ? "emailed=1" : "emailfail=1"}`);
}

// --- Practitioner-led intake ----------------------------------------------

const checkInSchema = z.object({
  firstName: required("the first name"),
  lastName: required("the surname"),
  idNumber: z.string().trim().min(5, "Please enter the ID or passport number."),
  phone,
  emergencyName: optional,
  emergencyPhone: optionalPhone,
});

// Also used on a locked tablet, where it can only check a client in.
export async function checkInAction(_prev: ConsentFormState, form: FormData): Promise<ConsentFormState> {
  const user = await requireKioskUser();
  const values = formToObject(form);
  const kiosk = values.mode === "kiosk" || (await isTabletLocked());
  const errors: FieldErrors = {};
  const parsed = checkInSchema.safeParse(values);
  if (!parsed.success) Object.assign(errors, fieldErrors(parsed.error));
  if (!values.formType || !isCaseType(values.formType)) errors.formType = "Please choose the treatment.";
  if (Object.keys(errors).length || !parsed.success) return { errors, values: echo(values) };

  const type = values.formType as keyof typeof CONSENT_FORMS;
  if (!canSeeCase(user.role, type)) return { errors: { formType: "Injections and laser are checked in by reception or a doctor." }, values: echo(values) };
  const iv = type === "IV_DRIP";
  // An IV client may pick a drip; the practitioner can change it later.
  const drip = iv && values.drip ? values.drip : undefined;
  if (drip && !(await getIvDripNames()).includes(drip)) return { errors: { drip: "Please choose a drip from the list." }, values: echo(values) };
  // The client checking themselves in on the tablet: IV drip clients join
  // the waiting list; injection and laser clients go on to their form.
  if (kiosk) {
    const created = await checkInCase({ type, ...parsed.data, drip });
    await audit(user, "checked-in-on-tablet", "TreatmentCase", created.id);
    redirect(iv ? `/kiosk/checked-in/${created.id}` : `/kiosk/form/${created.id}`);
  }
  const startNow = values.intent === "start";
  if (startNow && iv && !canTreat(user.role, type)) return { errors: { form: "Only a practitioner or doctor can start an IV drip. Add the client to the waiting list instead." }, values: echo(values) };
  const created = await checkInCase({ type, ...parsed.data, drip }, startNow && iv ? user : undefined);
  await audit(user, startNow && iv ? "case-started" : "checked-in", "TreatmentCase", created.id);
  if (!startNow) redirect(`/cases?checkedin=1`);
  if (iv) redirect(`/cases/${created.id}`);
  await lockTablet();
  await audit(user, "handed-to-patient", "TreatmentCase", created.id);
  redirect(`/kiosk/form/${created.id}`);
}

// Reception hands the tablet to the client to check themselves in.
export async function handCheckInToClientAction() {
  const user = await requireUser();
  await lockTablet();
  await audit(user, "tablet-check-in", "Device");
  redirect("/kiosk/checkin");
}

// Injections and laser: the client fills in their own details, medical history
// and signature on the tablet, which locks to their form.
export async function handToClientAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("caseId"));
  const c = await loadOpenCase(id, user);
  if (c.status !== "QUEUED" || c.type === "IV_DRIP") redirect(`/cases/${id}`);
  await lockTablet();
  await audit(user, "handed-to-patient", "TreatmentCase", id);
  redirect(`/kiosk/form/${id}`);
}

export async function startCaseAction(form: FormData) {
  const user = await requireUser(["ADMIN", "DOCTOR", "PRACTITIONER"]);
  const id = String(form.get("caseId"));
  const c = await loadOpenCase(id, user);
  if (!canTreat(user.role, c.type) || c.type !== "IV_DRIP") redirect(`/cases/${id}`);
  await startCase(id, user.id);
  await audit(user, "case-started", "TreatmentCase", id);
  redirect(`/cases/${id}`);
}

export async function cancelCaseAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("caseId"));
  await loadOpenCase(id, user);
  if (await cancelCase(id)) await audit(user, "case-cancelled", "TreatmentCase", id);
  redirect("/cases");
}

// The check-in details plus what the practitioner adds.
const assessmentDetails = checkInSchema.pick({ firstName: true, lastName: true, idNumber: true, phone: true }).extend({
  dateOfBirth: isoDate("Please enter the date of birth."),
  email: z.email("Please enter a valid email address. The signed form is sent here."),
});

export async function assessmentAction(_prev: StepState, form: FormData): Promise<StepState> {
  const user = await requireUser(["ADMIN", "DOCTOR", "PRACTITIONER"]);
  const values = formToObject(form);
  const c = await loadOpenCase(values.caseId, user);
  if (c.status !== "ASSESSMENT") return { errors: { form: "This step has already been done." }, values: echo(values) };
  if (!canTreat(user.role, c.type)) return { errors: { form: "Only a doctor can take on this treatment." }, values: echo(values) };
  const def = CONSENT_FORMS[c.type];
  const errors: FieldErrors = {};

  const parsed = assessmentDetails.safeParse(values);
  if (!parsed.success) Object.assign(errors, fieldErrors(parsed.error));
  const answers = parseHistory(def, values, errors);
  const iv = c.type === "IV_DRIP";
  const treatment = iv ? await parseDrip(values, errors) : parseTreatment(def, values, errors);
  const idPhoto = values.idPhoto || undefined;
  if (idPhoto && !validIdPhoto(idPhoto)) errors.idPhoto = "The ID photo couldn't be read. Please take it again.";

  const vitalsResult = iv ? parseVitals(values) : {};
  if (vitalsResult.errors) Object.assign(errors, vitalsResult.errors);
  const doctor = iv ? await approvingDoctor(values.doctorId, errors) : null;

  if (Object.keys(errors).length || !parsed.success) {
    return { errors: Object.keys(errors).length ? errors : { form: "Please check the form." }, values: echo(values) };
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
  return sendVitals(user, c.id, vitalsResult.vitals!, doctor!);
}

// Locks the tablet to this patient's signing screen. A staff member signs in
// again to take it back, so the patient can't reach anything else.
export async function handToPatientAction(form: FormData) {
  const user = await requireUser(["ADMIN", "DOCTOR", "PRACTITIONER"]);
  const id = String(form.get("caseId"));
  const c = await loadOpenCase(id, user);
  if (c.status !== "AWAITING_SIGNATURE") redirect(`/cases/${id}`);
  await lockTablet();
  await audit(user, "handed-to-patient", "TreatmentCase", id);
  redirect(`/kiosk/sign/${id}`);
}

// Used on the locked tablet.
export async function signConsentAction(_prev: ConsentFormState, form: FormData): Promise<ConsentFormState> {
  const user = await requireKioskUser();
  const values = formToObject(form);
  const c = await loadOpenCase(values.caseId, user);
  const def = CONSENT_FORMS[c.type];
  const errors: FieldErrors = {};
  checkAcknowledgements(def, values, errors);
  if (!values.signedName?.trim()) errors.signedName = "Please type your full name.";
  if (!validSignature(values.signature)) errors.signature = "Please sign in the box.";
  if (Object.keys(errors).length) return { errors, values: echo(values) };
  if (!(await signConsent(c.id, values.signedName.trim(), values.signature))) return { errors: { form: "This form has already been signed." }, values: echo(values) };
  await audit(user, "consent-signed", "TreatmentCase", c.id);
  // Saved first; the email is best-effort and can be resent from the case.
  await emailConsent(c.id).catch(() => undefined);
  redirect(`/kiosk/case/${c.id}?signed=1`);
}
