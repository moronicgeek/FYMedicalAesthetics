import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { TextSize } from "@/components/TextSize";

// Patient-facing check-in screens: no staff navigation and no way to reach
// other patients' records from here.
export default async function KioskLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-header">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo />
          <TextSize />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="py-4 text-center">
        <Link href="/kiosk/exit" className="text-sm muted underline">Staff: exit check-in mode</Link>
      </footer>
    </div>
  );
}
