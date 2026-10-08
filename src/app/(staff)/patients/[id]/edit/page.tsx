import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getPatient } from "@/lib/patients";
import { PatientForm } from "@/components/PatientForm";

export const metadata = { title: "Edit patient" };

export default async function EditPatient({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const p = await getPatient(id);
  if (!p) notFound();
  await audit(user, "view-edit", "Patient", id);

  const initial: Record<string, string> = {
    firstName: p.firstName,
    lastName: p.lastName,
    preferredName: p.preferredName ?? "",
    dateOfBirth: p.dateOfBirth,
    gender: p.gender ?? "",
    idNumber: p.idNumber ?? "",
    email: p.email ?? "",
    phone: p.phone,
    address: p.address ?? "",
    contactPreference: p.contactPreference,
    emergencyName: p.emergencyContact?.name ?? "",
    emergencyPhone: p.emergencyContact?.phone ?? "",
    emergencyRelationship: p.emergencyContact?.relationship ?? "",
    conditions: p.medical.conditions ?? "",
    medications: p.medical.medications ?? "",
    allergies: p.medical.allergies ?? "",
    previousTreatments: p.medical.previousTreatments ?? "",
    pregnantOrBreastfeeding: p.medical.pregnantOrBreastfeeding,
    smoker: p.medical.smoker,
    treatmentInterest: p.treatmentInterest ?? "",
    consentData: "on",
    consentAccuracy: "on",
    consentMarketing: p.consent.marketing ? "on" : "",
    signedName: p.consent.signedName,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <p className="muted"><Link href={`/patients/${id}`} className="underline">Back to record</Link></p>
      <h1 className="page-title">Edit {p.firstName} {p.lastName}</h1>
      <PatientForm patientId={id} initial={initial} submitLabel="Save changes" />
    </div>
  );
}
