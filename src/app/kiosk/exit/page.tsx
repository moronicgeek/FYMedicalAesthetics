import Link from "next/link";
import { ExitForm } from "./ExitForm";

export const metadata = { title: "Exit check-in mode" };

export default function KioskExit() {
  return (
    <div className="card mx-auto max-w-md space-y-4">
      <h1 className="page-title">Staff only</h1>
      <p className="muted">Enter your password to leave patient check-in mode.</p>
      <ExitForm />
      <Link href="/kiosk" className="underline">Back to check-in</Link>
    </div>
  );
}
