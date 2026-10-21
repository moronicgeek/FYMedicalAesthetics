"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { encryptJson } from "@/lib/crypto";
import { db } from "@/lib/db";
import { paperEntrySchema, toPaperEntry } from "@/lib/paper-history";
import { canSeePatient } from "@/lib/patients";
import { fieldErrors, formToObject, type FieldErrors } from "@/lib/validation";

export type PaperHistoryFormState = { errors?: FieldErrors; values?: Record<string, string> };

export async function savePaperHistoryAction(_prev: PaperHistoryFormState, form: FormData): Promise<PaperHistoryFormState> {
  const user = await requireUser(["RECEPTION", "ADMIN"]);
  const values = formToObject(form);
  const { patientId, entryId } = values;
  const patient = patientId ? await db.patient.findUnique({ where: { id: patientId }, select: { id: true } }) : null;
  if (!patient || !(await canSeePatient(user.role, patient.id))) return { errors: { form: "That patient record no longer exists." }, values };

  const parsed = paperEntrySchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const data = encryptJson(toPaperEntry(parsed.data));

  if (entryId) {
    const { count } = await db.paperHistoryEntry.updateMany({ where: { id: entryId, patientId }, data: { data, updatedById: user.id } });
    if (count === 0) return { errors: { form: "That entry has been removed. Please go back to the patient record." }, values };
    await audit(user, "paper-history-edit", "Patient", patientId);
    redirect(`/patients/${patientId}?paper=saved#paper-history`);
  }

  await db.paperHistoryEntry.create({ data: { patientId, data, enteredById: user.id } });
  await audit(user, "paper-history-add", "Patient", patientId);
  // Copying a whole file is several entries in a row.
  if (values.next === "another") redirect(`/patients/${patientId}/paper-history/new?added=1`);
  redirect(`/patients/${patientId}?paper=added#paper-history`);
}

export async function removePaperHistoryAction(form: FormData) {
  const admin = await requireUser(["ADMIN"]);
  const patientId = String(form.get("patientId"));
  const entryId = String(form.get("entryId"));
  const { count } = await db.paperHistoryEntry.deleteMany({ where: { id: entryId, patientId } });
  if (count > 0) await audit(admin, "paper-history-remove", "Patient", patientId);
  redirect(`/patients/${patientId}?paper=removed#paper-history`);
}
