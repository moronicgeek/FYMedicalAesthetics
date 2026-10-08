"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { findCaseByDecisionToken, recordDecision } from "@/lib/cases";

// Doctors open the link from their WhatsApp message without signing in; the
// single-use, time-limited token is the credential.
export async function doctorDecisionAction(form: FormData) {
  const token = String(form.get("token") ?? "");
  const approve = form.get("decision") === "yes";
  const c = await findCaseByDecisionToken(token);
  if (!c) redirect(`/d/${encodeURIComponent(token)}`);
  if (await recordDecision(c.id, approve, "link")) {
    await db.auditLog.create({ data: { userId: c.doctorId, action: approve ? "doctor-approve" : "doctor-decline", entity: "TreatmentCase", entityId: c.id } });
  }
  redirect(`/d/done?decision=${approve ? "yes" : "no"}&code=${c.code}`);
}
