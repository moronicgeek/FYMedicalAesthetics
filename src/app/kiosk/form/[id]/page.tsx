import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canSeeCase, getCase } from "@/lib/cases";
import { dateOfBirthFromSaId } from "@/lib/sa-id";
import { ConsentForm } from "@/components/ConsentForm";

export const metadata = { title: "Your consent form" };

// Injections and laser: the tablet is locked to this client's form, which
// starts from the check-in details.
export default async function KioskClientForm({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const c = await getCase(id);
  if (!c || c.type === "IV_DRIP" || !canSeeCase(user.role, c.type)) notFound();
  if (c.status !== "QUEUED") redirect(`/kiosk/case/${id}?signed=1`);
  const p = c.consent.patient;
  // Only what was entered at check-in. A returning client's stored details are
  // not shown here: whoever holds the tablet could have typed someone else's ID.
  const initial: Record<string, string> = {
    firstName: p.firstName,
    lastName: p.lastName,
    idNumber: p.idNumber ?? "",
    phone: p.phone ?? "",
    dateOfBirth: dateOfBirthFromSaId(p.idNumber) || "",
    emergencyName: c.consent.emergency.name ?? "",
    emergencyPhone: c.consent.emergency.phone ?? "",
    signedName: `${p.firstName} ${p.lastName}`,
  };
  return <ConsentForm type={c.type} kiosk caseId={c.id} initial={initial} />;
}
