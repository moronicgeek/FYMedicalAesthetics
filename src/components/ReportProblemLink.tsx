"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Carries only the path (no query string) to the report form.
export function ReportProblemLink() {
  const pathname = usePathname();
  if (pathname === "/report") return null;
  return (
    <Link href={`/report?from=${encodeURIComponent(pathname)}`} className="btn btn-secondary">
      Report a problem
    </Link>
  );
}
