import Link from "next/link";
import { ExitForm } from "./ExitForm";

export const metadata = { title: "Staff sign in" };

export default async function KioskExit({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="card mx-auto max-w-md space-y-4">
      <h1 className="page-title">Staff only</h1>
      <p className="muted">{next ? "Sign in to open this patient's case." : "Sign in to leave patient check-in mode."}</p>
      <ExitForm next={next} />
      <Link href="/kiosk" className="underline">Back to check-in</Link>
    </div>
  );
}
