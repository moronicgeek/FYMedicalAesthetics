import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const metadata = { title: "You're checked in" };

// Shown on the tablet after an IV drip client checks themselves in. It shows
// no patient details.
export default async function KioskCheckedIn({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.treatmentCase.findUnique({ where: { id }, select: { id: true, code: true } });
  if (!c) notFound();
  return (
    <div className="mx-auto max-w-2xl space-y-6 text-center">
      <div className="card space-y-4 py-10">
        <svg aria-hidden="true" className="mx-auto" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#e6f4ea" /><path d="M19 33l9 9 17-19" stroke="#17693a" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <h1 className="page-title">Thank you, you&rsquo;re checked in</h1>
        <p className="text-lg">Please hand the tablet back to reception and take a seat. A practitioner will call you.</p>
        <p className="muted">Reference #{c.code}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link className="btn btn-primary btn-lg" href="/kiosk/checkin">Next client</Link>
        <Link className="btn btn-secondary btn-lg" href="/kiosk/exit?next=/cases">Staff: continue</Link>
      </div>
    </div>
  );
}
