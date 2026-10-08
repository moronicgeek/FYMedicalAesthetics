import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { TextSize } from "@/components/TextSize";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Logo />
        <TextSize />
      </header>
      <main id="main" className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="card w-full max-w-md shadow-sm">
          <h1 className="page-title mb-2">Staff sign in</h1>
          <p className="muted mb-6">Sign in to manage patient intake and appointments.</p>
          <LoginForm />
          <p className="hint mt-6">Forgotten your password? Please ask the practice administrator to reset it.</p>
        </div>
      </main>
    </div>
  );
}
