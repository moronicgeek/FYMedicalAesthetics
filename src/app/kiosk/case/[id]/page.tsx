import Link from "next/link";
import { db } from "@/lib/db";
import { CONSENT_FORMS } from "@/lib/consent-forms";

export const metadata = { title: "Thank you" };

// Shown on the tablet after the patient signs. It shows no patient details,
// only what to do next, and stays open for the practitioner.
export default async function KioskCase({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ signed?: string }> }) {
  const { id } = await params;
  // Signed after the practitioner handed the tablet over, rather than at the
  // self-service check-in.
  const handedOver = Boolean((await searchParams).signed);
  const c = await db.treatmentCase.findUnique({ where: { id }, select: { id: true, code: true, type: true, consentEmailedAt: true } });
  if (!c) return <p>Not found.</p>;
  const staff = c.type === "IV_DRIP" ? "practitioner" : "reception";
  return (
    <div className="mx-auto max-w-2xl space-y-6 text-center">
      <div className="card space-y-4 py-10">
        <svg aria-hidden="true" className="mx-auto" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#e6f4ea" /><path d="M19 33l9 9 17-19" stroke="#17693a" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <h1 className="page-title">Thank you, your form is signed</h1>
        <p className="text-lg">{c.consentEmailedAt ? "A copy has been emailed to you." : "A copy will be emailed to you."}</p>
        <p className="text-lg">{handedOver ? `Please hand the tablet back to ${staff}.` : "Your practitioner will be with you shortly."}</p>
        <p className="muted">{CONSENT_FORMS[c.type].shortName} · reference #{c.code}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link className="btn btn-primary btn-lg" href={`/kiosk/exit?next=/cases/${c.id}`}>Staff: continue</Link>
        {!handedOver && <Link className="btn btn-secondary btn-lg" href="/kiosk">Next patient</Link>}
        {handedOver && c.type !== "IV_DRIP" && <Link className="btn btn-secondary btn-lg" href="/kiosk/checkin">Next client</Link>}
      </div>
    </div>
  );
}
