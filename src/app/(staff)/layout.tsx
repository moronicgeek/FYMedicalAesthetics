import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "../actions/auth";
import { Logo } from "@/components/Logo";
import { StaffNav } from "@/components/StaffNav";
import { ReportProblemLink } from "@/components/ReportProblemLink";

const ROLE_LABEL = { ADMIN: "Administrator", DOCTOR: "Doctor", PRACTITIONER: "Practitioner", RECEPTION: "Reception" } as const;

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const links = [
    { href: "/dashboard", label: "Today" },
    { href: "/checkin", label: "Check in" },
    { href: "/cases", label: "Treatments" },
    { href: "/intake", label: "New patient" },
    { href: "/patients", label: "Patients" },
    { href: "/appointments", label: "Appointments" },
    ...(user.role === "ADMIN"
      ? [
          { href: "/overview", label: "Overview" },
          { href: "/staff", label: "Staff" },
          { href: "/settings", label: "Settings" },
          { href: "/audit", label: "Access log" },
          { href: "/problems", label: "Problem reports" },
        ]
      : []),
    { href: "/account", label: "My account" },
  ];
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-t-4 border-accent bg-header">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo compact />
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/account" className="text-sm underline-offset-2 hover:underline">
              <span className="font-bold">{user.name}</span> <span className="muted">· {ROLE_LABEL[user.role]}</span>
            </Link>
            <ReportProblemLink />
            <form action={logoutAction}>
              <button type="submit" className="btn btn-secondary">Sign out</button>
            </form>
          </div>
        </div>
        <div className="bg-nav">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <StaffNav links={links} />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-line bg-header py-4 text-center text-sm muted">
        Confidential patient information. Do not share your sign-in.
      </footer>
    </div>
  );
}
