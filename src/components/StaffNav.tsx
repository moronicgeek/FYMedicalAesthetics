"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function StaffNav({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-wrap">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="nav-link" aria-current={pathname === l.href || pathname.startsWith(`${l.href}/`) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
