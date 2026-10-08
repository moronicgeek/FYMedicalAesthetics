"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { CONSENT_FORMS, isCaseType } from "@/lib/consent-forms";
import { closeCase, createCaseFromConsent, emailConsent, getCase, recordDecision, recordPostVitals, recordPreVitals, resendDoctorRequest, type ConsentRecord, type OfficeUse } from "@/lib/cases";
import { validSignature } from "@/lib/signature";
import { formToObject, type FieldErrors } from "@/lib/validation";
import { parseVitals } from "@/lib/vitals";

export type ConsentFormState = { errors?: FieldErrors; values?: Record<string, string> };

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

  const answers: ConsentRecord["answers"] = {};
  for (const q of def.questions) {
    const a = values[`q_${q.id}`];
    if (a !== "yes" && a !== "no") errors[`q_${q.id}`] = "Please answer yes or no.";
    else answers[q.id] = a;
  }
  def.acknowledgements.forEach((_, i) => {
    if (values[`ack_${i}`] !== "on") errors[`ack_${i}`] = "Please tick to confirm.";
  });
  if (Object.values(answers).includes("yes") && def.detailFields.some((d) => d.id === "yesDetails") && !values.yesDetails?.trim()) {
    errors.yesDetails = "You answered yes to a question above. Please give details.";
  }

  const chosen = def.treatmentChoice?.options.filter((o) => values[`treatment_${o}`] === "on") ?? [];
  const other = values.treatmentOther?.trim();
  const treatment = [...chosen, other].filter(Boolean).join(", ");
  if (def.treatmentChoice && !treatment && type !== "LASER") errors.treatment = `Please fill in: ${def.treatmentChoice.label.toLowerCase()}.`;

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
    treatment: treatment || (type === "LASER" ? "Laser" : undefined),
    answers,
    details: Object.fromEntries(def.detailFields.map((d) => [d.id, values[d.id]?.trim() ?? ""])),
    emergency: { name: values.emergencyName?.trim() || undefined, phone: values.emergencyPhone?.trim() || undefined },
    signedName: parsed.data.signedName,
    signature: values.signature,
    signedAt: new Date().toISOString(),
  };

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
