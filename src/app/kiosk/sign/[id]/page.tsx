import { notFound, redirect } from "next/navigation";
import { requireKioskUser } from "@/lib/auth";
import { kioskMayOpenCase } from "@/lib/tablet";
import { FormClosed } from "@/components/FormClosed";
import { canSeeCase } from "@/lib/access";
import { getCase } from "@/lib/cases";
import { SignConsentForm } from "@/components/SignConsentForm";

export const metadata = { title: "Please read and sign" };

// The tablet is locked to this screen while the patient reads and signs.
export default async function KioskSign({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireKioskUser();
  const { id } = await params;
  if (!(await kioskMayOpenCase(id))) return <FormClosed />;
  const c = await getCase(id);
  if (!c || !canSeeCase(user.role, c.type)) notFound();
  if (c.status !== "AWAITING_SIGNATURE") redirect(`/kiosk/case/${id}?signed=1`);
  const p = c.consent.patient;
  return <SignConsentForm caseId={c.id} type={c.type} patientName={`${p.firstName} ${p.lastName}`} treatment={c.consent.treatment} />;
}
