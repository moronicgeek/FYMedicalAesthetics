"use server";

import { redirect } from "next/navigation";
import { requireKioskUser } from "@/lib/auth";
import { isTabletLocked } from "@/lib/tablet";
import { audit } from "@/lib/audit";
import { canSeePatient, createPatient, findByIdNumber, findSamePatient, getPatient, IdNumberTaken, idNumberOwner, idOwnerPrompt, patientRecord, toRecord, updatePatient, type IdOwner } from "@/lib/patients";
import { keepIdentity, mergePatientRecord } from "@/lib/patient-match";
import { fieldErrors, formToObject, patientSchema, type FieldErrors } from "@/lib/validation";

export type PatientFormState = { errors?: FieldErrors; values?: Record<string, string>; idOwner?: IdOwner };

export async function savePatientAction(_prev: PatientFormState, form: FormData): Promise<PatientFormState> {
  // Also the tablet's "Register your details" form. A locked tablet can only
  // register, never edit a record by its ID.
  const user = await requireKioskUser();
  const values = formToObject(form);
  const parsed = patientSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const locked = await isTabletLocked();
  const patientId = locked ? undefined : values.patientId;
  const kiosk = values.mode === "kiosk" || locked;
  const record = toRecord(parsed.data);

  try {
    if (patientId) {
      const existing = await getPatient(patientId);
      if (!existing || !(await canSeePatient(user.role, patientId))) return { errors: { form: "That patient record no longer exists." }, values };
      // Each ID number belongs to one record only.
      const owner = await findByIdNumber(record.idNumber);
      if (owner && owner.id !== patientId) return { errors: { idNumber: (await idOwnerPrompt(user.role, owner, { confirmable: false })).error }, values };
      await updatePatient(patientId, record);
      await audit(user, "update", "Patient", patientId);
      redirect(`/patients/${patientId}?saved=1`);
    }

    // A returning patient filling in the form again updates their record
    // rather than creating a duplicate. Blank answers keep what is on file.
    // The record holding the ID number comes first; on the tablet a different
    // name stops the save, since there's no visit for staff to check later.
    const { owner, check } = await idNumberOwner(record, { confirmedPatientId: values.confirmIdOwner });
    if (check === "ask") {
      if (kiosk) return { errors: { idNumber: "We couldn't save your details. Please ask reception for help." }, values };
      const prompt = await idOwnerPrompt(user.role, owner!);
      return { errors: { idNumber: prompt.error }, values, idOwner: prompt.idOwner };
    }
    const match = owner ?? (await findSamePatient(record));
    if (match) {
      const prev = patientRecord(match);
      await updatePatient(match.id, mergePatientRecord(prev, check === "confirmed" ? keepIdentity(prev, record) : record));
      await audit(user, "intake-update", "Patient", match.id);
      redirect(kiosk ? "/kiosk/register/done?returning=1" : `/intake/done?returning=1&patient=${match.id}`);
    }

    const created = await createPatient(record);
    await audit(user, "intake-create", "Patient", created.id);
    redirect(kiosk ? "/kiosk/register/done" : `/intake/done?patient=${created.id}`);
  } catch (e) {
    if (e instanceof IdNumberTaken) return { errors: { idNumber: e.message }, values };
    throw e;
  }
}
