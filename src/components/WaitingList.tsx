import Link from "next/link";
import { handToClientAction, startCaseAction } from "@/app/actions/cases";
import type { SessionUser } from "@/lib/auth";
import { canTreat, type DecryptedCase } from "@/lib/cases";
import { CONSENT_FORMS } from "@/lib/consent-forms";
import { formatTime } from "@/lib/time";

function Name({ c }: { c: DecryptedCase }) {
  return (
    <Link href={`/cases/${c.id}`} className="text-lg font-bold underline underline-offset-4">
      {c.consent.patient.firstName} {c.consent.patient.lastName}
    </Link>
  );
}

// Clients who have checked in, oldest first. IV drip clients wait for a
// practitioner; injection and laser clients are handed the tablet to fill in
// their own form.
export function WaitingList({ cases, role }: { cases: DecryptedCase[]; role: SessionUser["role"] }) {
  return (
    <section className="card" aria-labelledby="waiting-heading">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 id="waiting-heading" className="section-title">Checked in ({cases.length})</h2>
        <Link href="/checkin" className="btn btn-secondary">Check in a client</Link>
      </div>
      {cases.length === 0 ? (
        <p className="muted">Nobody is waiting.</p>
      ) : (
        <ul className="divide-y divide-line">
          {cases.map((c) => {
            const iv = c.type === "IV_DRIP";
            return (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Name c={c} />
                  <p className="muted">
                    {CONSENT_FORMS[c.type].shortName} · checked in {formatTime(c.createdAt)}{c.patientId ? " · returning" : ""} · {iv ? "waiting for a practitioner" : "to fill in their form"}
                  </p>
                </div>
                {iv && canTreat(role, c.type) && (
                  <form action={startCaseAction}>
                    <input type="hidden" name="caseId" value={c.id} />
                    <button type="submit" className="btn btn-primary">Start</button>
                  </form>
                )}
                {!iv && (
                  <form action={handToClientAction}>
                    <input type="hidden" name="caseId" value={c.id} />
                    <button type="submit" className="btn btn-primary">Hand tablet to client</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Injection and laser clients who have signed their form and wait for the doctor.
export function DoctorQueue({ cases }: { cases: DecryptedCase[] }) {
  if (cases.length === 0) return null;
  return (
    <section className="card" aria-labelledby="doctor-queue-heading">
      <h2 id="doctor-queue-heading" className="section-title mb-2">Waiting for the doctor ({cases.length})</h2>
      <ul className="divide-y divide-line">
        {cases.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <Name c={c} />
              <p className="muted">{CONSENT_FORMS[c.type].shortName}{c.consent.treatment ? `: ${c.consent.treatment}` : ""} · form signed{c.consent.signedAt ? ` ${formatTime(new Date(c.consent.signedAt))}` : ""}</p>
            </div>
            <Link href={`/cases/${c.id}`} className="btn btn-secondary">Open</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function waitingForDoctor(c: DecryptedCase) {
  return c.type !== "IV_DRIP" && c.status === "CONSENTED";
}
