"use server";

import { redirect } from "next/navigation";
import { requireKioskUser } from "@/lib/auth";
import { isTabletLocked, KIOSK_BUSY_MESSAGE, tooManyKioskForms } from "@/lib/tablet";
import { audit } from "@/lib/audit";
import { canSeePatient, createPatient, findSamePatient, getPatient, patientRecord, toRecord, updatePatient } from "@/lib/patients";
import { mergePatientRecord } from "@/lib/patient-match";
import { fieldErrors, formToObject, patientSchema, tooLong, type FieldErrors } from "@/lib/validation";

export type PatientFormState = { errors?: FieldErrors; values?: Record<string, string> };

export async function savePatientAction(_prev: PatientFormState, form: FormData): Promise<PatientFormState> {
  // Also the tablet's "Register your details" form. A locked tablet can only
  // register, never edit a record by its ID.
  const user = await requireKioskUser();
  const values = formToObject(form);
  const long = tooLong(values);
  if (long) return long;
  const locked = await isTabletLocked();
  if (locked && (await tooManyKioskForms(user))) return { errors: { form: KIOSK_BUSY_MESSAGE }, values };
  const parsed = patientSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const patientId = locked ? undefined : values.patientId;
  const kiosk = values.mode === "kiosk" || locked;
  const record = toRecord(parsed.data);

  if (patientId) {
    const existing = await getPatient(patientId);
    if (!existing || !(await canSeePatient(user.role, patientId))) return { errors: { form: "That patient record no longer exists." }, values };
    await updatePatient(patientId, record);
    await audit(user, "update", "Patient", patientId);
    redirect(`/patients/${patientId}?saved=1`);
  }

  // A returning patient filling in the form again updates their record
  // rather than creating a duplicate. Blank answers keep what is on file.
  const match = await findSamePatient(record);
  if (match) {
    await updatePatient(match.id, mergePatientRecord(patientRecord(match), record));
    await audit(user, "intake-update", "Patient", match.id);
    redirect(kiosk ? "/kiosk/register/done?returning=1" : `/intake/done?returning=1&patient=${match.id}`);
  }

  const created = await createPatient(record);
  await audit(user, "intake-create", "Patient", created.id);
  redirect(kiosk ? "/kiosk/register/done" : `/intake/done?patient=${created.id}`);
}
