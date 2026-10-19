import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { decryptJson } from "@/lib/crypto";
import { db } from "@/lib/db";
import { setProblemStatusAction } from "@/app/actions/problems";
import type { ProblemDetails } from "@/lib/problem-reports";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Problem reports" };

const ROLE = { ADMIN: "Administrator", DOCTOR: "Doctor", PRACTITIONER: "Practitioner", RECEPTION: "Reception" } as const;

export default async function ProblemsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const admin = await requireUser(["ADMIN"]);
  const { show } = await searchParams;
  const status = show === "fixed" ? "FIXED" : "OPEN";
  const [reports, openCount] = await Promise.all([
    db.problemReport.findMany({ where: { status }, orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { name: true } } } }),
    db.problemReport.count({ where: { status: "OPEN" } }),
  ]);
  await audit(admin, "view", "ProblemReport");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Problem reports</h1>
        <p className="muted">Problems staff have reported with this system. {openCount === 1 ? "1 is open." : `${openCount} are open.`}</p>
      </div>
      <nav aria-label="Filter" className="flex gap-3">
        <a href="/problems" className={status === "OPEN" ? "btn btn-primary" : "btn btn-secondary"} aria-current={status === "OPEN" ? "page" : undefined}>Open</a>
        <a href="/problems?show=fixed" className={status === "FIXED" ? "btn btn-primary" : "btn btn-secondary"} aria-current={status === "FIXED" ? "page" : undefined}>Fixed</a>
      </nav>
      {reports.length === 0 ? (
        <p className="card muted">{status === "OPEN" ? "Nothing open. Well done." : "No fixed reports yet."}</p>
      ) : (
        <ul className="space-y-4">
          {reports.map((r) => {
            const d = decryptJson<ProblemDetails>(r.details);
            return (
              <li key={r.id} className="card space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{r.user?.name ?? "Former staff member"} <span className="muted font-normal">· {ROLE[r.role]}</span></p>
                    <p className="muted">{formatDateTime(r.createdAt)} · Screen <code>{r.path}</code>{r.device ? ` · ${r.device}` : ""}</p>
                  </div>
                  <form action={setProblemStatusAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value={r.status === "OPEN" ? "FIXED" : "OPEN"} />
                    <button type="submit" className="btn btn-secondary">{r.status === "OPEN" ? "Mark as fixed" : "Reopen"}</button>
                  </form>
                </div>
                <div>
                  <p className="label">What went wrong</p>
                  <p className="whitespace-pre-wrap">{d.whatHappened}</p>
                </div>
                {d.expected && (
                  <div>
                    <p className="label">What they expected</p>
                    <p className="whitespace-pre-wrap">{d.expected}</p>
                  </div>
                )}
                {r.fixedAt && <p className="text-success font-bold">Fixed {formatDateTime(r.fixedAt)}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
