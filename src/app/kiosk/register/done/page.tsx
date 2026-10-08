import Link from "next/link";

export const metadata = { title: "Thank you" };

export default async function KioskDone({ searchParams }: { searchParams: Promise<{ returning?: string }> }) {
  const { returning } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl space-y-6 text-center">
      <div className="card space-y-4 py-10">
        <svg aria-hidden="true" className="mx-auto" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#e6f4ea" /><path d="M19 33l9 9 17-19" stroke="#17693a" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <h1 className="page-title">Thank you</h1>
        <p className="text-lg">{returning ? "Welcome back. We've updated your details." : "Your details have been saved securely."}</p>
        <p className="text-lg">Please hand the device back to our reception team.</p>
      </div>
      <Link className="btn btn-secondary btn-lg" href="/kiosk">Start the next patient</Link>
    </div>
  );
}
