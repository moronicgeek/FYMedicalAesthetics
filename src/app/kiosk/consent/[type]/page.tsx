import Link from "next/link";
import { notFound } from "next/navigation";
import { requireKioskUser } from "@/lib/auth";
import { canSeeCase } from "@/lib/access";
import { ConsentForm } from "@/components/ConsentForm";
import { isCaseType } from "@/lib/consent-forms";

export const metadata = { title: "Consent form" };

// Injections and laser: the client fills in and signs their form straight from
// the start screen. IV drip consent is only signed with the practitioner.
export default async function KioskConsent({ params }: { params: Promise<{ type: string }> }) {
  const user = await requireKioskUser();
  const type = (await params).type.toUpperCase();
  if (!isCaseType(type) || type === "IV_DRIP" || !canSeeCase(user.role, type)) notFound();
  return (
    <div className="space-y-6">
      <Link href="/kiosk" className="underline">‹ Choose a different treatment</Link>
      <ConsentForm type={type} kiosk />
    </div>
  );
}
