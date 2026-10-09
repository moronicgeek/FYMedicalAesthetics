import Link from "next/link";
import { startCaseAction } from "@/app/actions/cases";
import type { DecryptedCase } from "@/lib/cases";
import { CONSENT_FORMS } from "@/lib/consent-forms";
import { formatTime } from "@/lib/time";

// Clients who have checked in and are waiting for a practitioner, oldest first.
export function WaitingList({ cases, canStart }: { cases: DecryptedCase[]; canStart: boolean }) {
  return (
    <section className="card" aria-labelledby="waiting-heading">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 id="waiting-heading" className="section-title">Waiting ({cases.length})</h2>
        <Link href="/checkin" className="btn btn-secondary">Check in a client</Link>
      </div>
      {cases.length === 0 ? (
        <p className="muted">Nobody is waiting.</p>
      ) : (
        <ul className="divide-y divide-line">
          {cases.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <Link href={`/cases/${c.id}`} className="text-lg font-bold underline underline-offset-4">
                  {c.consent.patient.firstName} {c.consent.patient.lastName}
                </Link>
                <p className="muted">{CONSENT_FORMS[c.type].shortName} · checked in {formatTime(c.createdAt)}{c.patientId ? " · returning" : ""}</p>
              </div>
              {canStart && (
                <form action={startCaseAction}>
                  <input type="hidden" name="caseId" value={c.id} />
                  <button type="submit" className="btn btn-primary">Start</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
