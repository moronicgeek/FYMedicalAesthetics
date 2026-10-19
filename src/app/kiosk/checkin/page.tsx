import Link from "next/link";
import { requireKioskUser } from "@/lib/auth";
import { CheckInForm } from "@/components/CheckInForm";
import { getIvDrips } from "@/lib/settings";

export const metadata = { title: "Check in for an IV drip" };

// IV drip clients give their basic details and the drip they'd like, then wait
// for a practitioner. They sign their consent later, with the practitioner.
export default async function KioskCheckIn() {
  await requireKioskUser();
  const drips = await getIvDrips();
  return (
    <div className="space-y-6">
      <Link href="/kiosk" className="underline">‹ Choose a different treatment</Link>
      <div>
        <h1 className="page-title">IV drip: your details</h1>
        <p className="muted mt-2 text-lg">Please enter your details and choose your drip. You will sign your consent form with your practitioner.</p>
      </div>
      <div className="card">
        <CheckInForm kiosk fixedType="IV_DRIP" drips={drips} />
      </div>
    </div>
  );
}
