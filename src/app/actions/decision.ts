"use server";

import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { findCaseByDecisionToken, recordDecision } from "@/lib/cases";

// Doctors open the link from their WhatsApp message without signing in; the
// single-use, time-limited token is the credential.
export async function doctorDecisionAction(form: FormData) {
  const token = String(form.get("token") ?? "");
  const approve = form.get("decision") === "yes";
  const c = await findCaseByDecisionToken(token);
  if (!c) redirect(`/d/${encodeURIComponent(token)}`);
  if (await recordDecision(c.id, approve, "link")) {
    await audit(c.doctorId ? { id: c.doctorId } : null, approve ? "doctor-approve" : "doctor-decline", "TreatmentCase", c.id);
  }
  redirect(`/d/done?decision=${approve ? "yes" : "no"}&code=${c.code}`);
}
