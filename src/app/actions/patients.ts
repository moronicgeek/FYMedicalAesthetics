"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createPatient, findExistingPatient, getPatient, toRecord, updatePatient } from "@/lib/patients";
import { fieldErrors, formToObject, patientSchema, type FieldErrors } from "@/lib/validation";

export type PatientFormState = { errors?: FieldErrors; values?: Record<string, string> };

export async function savePatientAction(_prev: PatientFormState, form: FormData): Promise<PatientFormState> {
  const user = await requireUser();
  const values = formToObject(form);
  const parsed = patientSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const patientId = values.patientId;
  const kiosk = values.mode === "kiosk";
  const record = toRecord(parsed.data);

  if (patientId) {
    const existing = await getPatient(patientId);
    if (!existing) return { errors: { form: "That patient record no longer exists." }, values };
    await updatePatient(patientId, record);
    await audit(user, "update", "Patient", patientId);
    redirect(`/patients/${patientId}?saved=1`);
  }

  // A returning patient filling in the form again updates their record
  // rather than creating a duplicate.
  const match = await findExistingPatient(record);
  if (match) {
    await updatePatient(match.id, record);
    await audit(user, "intake-update", "Patient", match.id);
    redirect(kiosk ? "/kiosk/register/done?returning=1" : `/intake/done?returning=1&patient=${match.id}`);
  }

  const created = await createPatient(record);
  await audit(user, "intake-create", "Patient", created.id);
  redirect(kiosk ? "/kiosk/register/done" : `/intake/done?patient=${created.id}`);
}
