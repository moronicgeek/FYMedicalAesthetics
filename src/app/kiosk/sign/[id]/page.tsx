import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canSeeCase, getCase } from "@/lib/cases";
import { SignConsentForm } from "@/components/SignConsentForm";

export const metadata = { title: "Please read and sign" };

// The tablet is locked to this screen while the patient reads and signs.
export default async function KioskSign({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const c = await getCase(id);
  if (!c || !canSeeCase(user.role, c.type)) notFound();
  if (c.status !== "AWAITING_SIGNATURE") redirect(`/kiosk/case/${id}?signed=1`);
  const p = c.consent.patient;
  return <SignConsentForm caseId={c.id} type={c.type} patientName={`${p.firstName} ${p.lastName}`} treatment={c.consent.treatment} />;
}
