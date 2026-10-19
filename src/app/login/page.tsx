import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LogoMark } from "@/components/Logo";
import { FingerprintSignIn } from "@/components/Passkey";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

// ?mode=kiosk asks for a staff sign-in and then locks the device to the
// patient check-in screens, so the kiosk never opens without a staff member.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const lock = (await searchParams).mode === "kiosk";
  if (!lock && (await getCurrentUser())) redirect("/dashboard");
  return (
    <div className="flex min-h-screen flex-col border-t-4 border-accent">
      <main id="main" className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
        <LogoMark />
        <div className="card w-full max-w-md shadow-sm">
          <h1 className="page-title mb-2">{lock ? "Start check-in mode" : "Staff sign in"}</h1>
          <p className="muted mb-6">
            {lock
              ? "A staff member signs in to put this tablet into patient check-in mode. It then shows only the patient screens until staff sign in again."
              : "Sign in to manage patient intake and appointments."}
          </p>
          <div className="space-y-6">
            <FingerprintSignIn lock={lock} />
            <LoginForm key={lock ? "lock" : "staff"} lock={lock} />
          </div>
          <p className="hint mt-6">Forgotten your password? Please ask the practice administrator to reset it.</p>
        </div>
        <Link href={lock ? "/login" : "/login?mode=kiosk"} className="text-sm muted underline">
          {lock ? "Back to staff sign in" : "Put this tablet into check-in mode"}
        </Link>
      </main>
    </div>
  );
}
