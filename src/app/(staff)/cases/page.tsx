import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { caseStatusLabel, decryptCase, OPEN_STATUSES, OUTCOME_LABEL } from "@/lib/cases";
import { CONSENT_FORMS } from "@/lib/consent-forms";
import { clinicDateString, clinicDayRange, formatTime } from "@/lib/time";
import { AutoRefresh } from "@/components/AutoRefresh";
import { DoctorQueue, WaitingList, waitingForDoctor } from "@/components/WaitingList";

export const metadata = { title: "Treatments" };

export default async function CasesPage({ searchParams }: { searchParams: Promise<{ checkedin?: string }> }) {
  const user = await requireUser();
  const { checkedin } = await searchParams;
  const { start } = clinicDayRange(clinicDateString());
  const rows = await db.treatmentCase.findMany({
    where: { OR: [{ status: { in: OPEN_STATUSES } }, { closedAt: { gte: start } }] },
    orderBy: { createdAt: "asc" },
  });
  const cases = rows.map(decryptCase);
  const waiting = cases.filter((c) => c.status === "QUEUED");
  const doctorCases = cases.filter(waitingForDoctor);
  const open = cases.filter((c) => c.status !== "CLOSED" && c.status !== "QUEUED" && !waitingForDoctor(c));
  const closed = cases.filter((c) => c.status === "CLOSED");
  const urgent = new Set(["REFERRED", "DECLINED"]);

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={15} />
      {checkedin && <div className="alert alert-success" role="status">Checked in. The client is on the waiting list.</div>}
      <div>
        <h1 className="page-title">Treatments</h1>
        <p className="muted">Today&rsquo;s clients from check-in to closing. This list updates by itself.</p>
      </div>

      <WaitingList cases={waiting} role={user.role} />
      <DoctorQueue cases={doctorCases} />

      <section className="card" aria-labelledby="open-heading">
        <h2 id="open-heading" className="section-title mb-2">In progress ({open.length})</h2>
        {open.length === 0 ? <p className="muted">No open treatments.</p> : (
          <ul className="divide-y divide-line">
            {open.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <Link href={`/cases/${c.id}`} className="text-lg font-bold text-brand-dark underline underline-offset-4">{c.consent.patient.firstName} {c.consent.patient.lastName}</Link>
                  <p className="muted">{CONSENT_FORMS[c.type].shortName} · #{c.code} · checked in {formatTime(c.createdAt)}</p>
                </div>
                <span className={`badge ${urgent.has(c.status) ? "bg-danger-soft text-danger" : ["AWAITING_DOCTOR", "AWAITING_SIGNATURE"].includes(c.status) ? "badge-CHECKED_IN" : "badge-BOOKED"}`}>{caseStatusLabel(c)}</span>
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
