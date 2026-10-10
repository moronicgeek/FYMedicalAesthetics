import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCase } from "@/lib/cases";
import { db } from "@/lib/db";
import { decryptPatient } from "@/lib/patients";
import { dateOfBirthFromSaId } from "@/lib/sa-id";
import { ConsentForm } from "@/components/ConsentForm";

export const metadata = { title: "Your consent form" };

// Injections and laser: the tablet is locked to this client's form, which
// starts from what reception took at check-in.
export default async function KioskClientForm({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const c = await getCase(id);
  if (!c || c.type === "IV_DRIP") notFound();
  if (c.status !== "QUEUED") redirect(`/kiosk/case/${id}?signed=1`);
  const p = c.consent.patient;
  const known = c.patientId ? await db.patient.findUnique({ where: { id: c.patientId } }) : null;
  const prev = known ? decryptPatient(known) : undefined;
  const initial: Record<string, string> = {
    firstName: p.firstName,
    lastName: p.lastName,
    idNumber: p.idNumber ?? "",
    phone: p.phone || prev?.phone || "",
    email: prev?.email ?? "",
    dateOfBirth: prev?.dateOfBirth || dateOfBirthFromSaId(p.idNumber) || "",
    emergencyName: c.consent.emergency.name || prev?.emergencyContact?.name || "",
    emergencyPhone: c.consent.emergency.phone || prev?.emergencyContact?.phone || "",
    medications: prev?.medical.medications ?? "",
    signedName: `${p.firstName} ${p.lastName}`,
  };
  return <ConsentForm type={c.type} kiosk caseId={c.id} initial={initial} />;
}
