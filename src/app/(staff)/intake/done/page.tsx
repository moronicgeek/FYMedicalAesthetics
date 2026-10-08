import Link from "next/link";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Thank you" };

export default async function IntakeDone({ searchParams }: { searchParams: Promise<{ patient?: string; returning?: string }> }) {
  await requireUser();
  const { patient, returning } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl space-y-6 text-center">
      <div className="card space-y-4 py-10">
        <svg aria-hidden="true" className="mx-auto" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#e6f4ea" /><path d="M19 33l9 9 17-19" stroke="#17693a" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <h1 className="page-title">Thank you</h1>
        <p className="text-lg">{returning ? "Welcome back. We've updated your details." : "Your details have been saved securely."}</p>
        <p className="text-lg">Please hand the device back to our reception team.</p>
      </div>
      <div className="card space-y-3">
        <p className="label">For reception</p>
        <div className="flex flex-wrap justify-center gap-3">
          {patient && <Link className="btn btn-primary" href={`/appointments/new?patientId=${patient}`}>Book an appointment</Link>}
          {patient && <Link className="btn btn-secondary" href={`/patients/${patient}`}>View patient record</Link>}
          <Link className="btn btn-secondary" href="/intake">Start another intake</Link>
        </div>
      </div>
    </div>
  );
}
