import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CASE_STATUS_LABEL, decryptCase, OPEN_STATUSES, OUTCOME_LABEL } from "@/lib/cases";
import { CASE_TYPES, CONSENT_FORMS } from "@/lib/consent-forms";
import { clinicDateString, clinicDayRange, formatTime } from "@/lib/time";
import { AutoRefresh } from "@/components/AutoRefresh";

export const metadata = { title: "Treatments" };

export default async function CasesPage() {
  await requireUser();
  const { start } = clinicDayRange(clinicDateString());
  const rows = await db.treatmentCase.findMany({
    where: { OR: [{ status: { in: OPEN_STATUSES } }, { closedAt: { gte: start } }] },
    orderBy: { createdAt: "asc" },
  });
  const cases = rows.map(decryptCase);
  const open = cases.filter((c) => c.status !== "CLOSED");
  const closed = cases.filter((c) => c.status === "CLOSED");
  const urgent = new Set(["REFERRED", "DECLINED"]);

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={15} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Treatments</h1>
          <p className="muted">Patients who have signed a consent form. This list updates by itself.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {CASE_TYPES.map((t) => <Link key={t} href={`/cases/new/${t.toLowerCase()}`} className="btn btn-secondary">New {CONSENT_FORMS[t].shortName.toLowerCase()} consent</Link>)}
        </div>
      </div>

      <section className="card" aria-labelledby="open-heading">
        <h2 id="open-heading" className="section-title mb-2">Open ({open.length})</h2>
        {open.length === 0 ? <p className="muted">No open treatments.</p> : (
          <ul className="divide-y divide-line">
            {open.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <Link href={`/cases/${c.id}`} className="text-lg font-bold text-brand-dark underline underline-offset-4">{c.consent.patient.firstName} {c.consent.patient.lastName}</Link>
                  <p className="muted">{CONSENT_FORMS[c.type].shortName} · #{c.code} · signed {formatTime(c.createdAt)}</p>
                </div>
                <span className={`badge ${urgent.has(c.status) ? "bg-danger-soft text-danger" : c.status === "AWAITING_DOCTOR" ? "badge-CHECKED_IN" : "badge-BOOKED"}`}>{CASE_STATUS_LABEL[c.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="closed-heading">
        <h2 id="closed-heading" className="section-title mb-2">Closed today ({closed.length})</h2>
        {closed.length === 0 ? <p className="muted">None yet.</p> : (
          <ul className="divide-y divide-line">
            {closed.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <Link href={`/cases/${c.id}`} className="font-bold text-brand-dark underline underline-offset-4">{c.consent.patient.firstName} {c.consent.patient.lastName}</Link>
                <span className="muted">{CONSENT_FORMS[c.type].shortName} · {c.outcome ? OUTCOME_LABEL[c.outcome] : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
