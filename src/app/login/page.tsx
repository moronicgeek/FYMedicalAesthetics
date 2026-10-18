import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LogoMark } from "@/components/Logo";
import { FingerprintSignIn } from "@/components/Passkey";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div className="flex min-h-screen flex-col border-t-4 border-accent">
      <main id="main" className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
        <LogoMark />
        <div className="card w-full max-w-md shadow-sm">
          <h1 className="page-title mb-2">Staff sign in</h1>
          <p className="muted mb-6">Sign in to manage patient intake and appointments.</p>
          <div className="space-y-6">
            <FingerprintSignIn />
            <LoginForm />
          </div>
          <p className="hint mt-6">Forgotten your password? Please ask the practice administrator to reset it.</p>
        </div>
      </main>
    </div>
  );
}
