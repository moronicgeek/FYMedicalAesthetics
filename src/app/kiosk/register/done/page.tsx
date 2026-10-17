import Link from "next/link";
import { SuccessTick } from "@/components/SuccessTick";

export const metadata = { title: "Thank you" };

export default async function KioskDone({ searchParams }: { searchParams: Promise<{ returning?: string }> }) {
  const { returning } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl space-y-6 text-center">
      <div className="card space-y-4 py-10">
        <SuccessTick />
        <h1 className="page-title">Thank you</h1>
        <p className="text-lg">{returning ? "Welcome back. We've updated your details." : "Your details have been saved securely."}</p>
        <p className="text-lg">Please hand the device back to our reception team.</p>
      </div>
      <Link className="btn btn-secondary btn-lg" href="/kiosk">Start the next patient</Link>
    </div>
  );
}
