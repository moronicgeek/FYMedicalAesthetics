import { doctorDecisionAction } from "@/app/actions/decision";
import { decryptCase, findCaseByDecisionToken } from "@/lib/cases";
import { CONSENT_FORMS } from "@/lib/consent-forms";
import { Logo } from "@/components/Logo";
import { ageFrom, formatTime } from "@/lib/time";
import { VITAL_FIELDS } from "@/lib/vitals";

export const metadata = { title: "IV drip approval" };

export default async function DoctorDecision({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await findCaseByDecisionToken(token);
  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <Logo />
      <main id="main" className="card space-y-5">
        {!row ? (
          <>
            <h1 className="page-title">This link is no longer active</h1>
            <p>The case has already been decided, or the link has expired. Please contact the clinic if you need to change a decision.</p>
          </>
        ) : (
          (() => {
            const c = decryptCase(row);
            const p = c.consent.patient;
            const yes = CONSENT_FORMS.IV_DRIP.questions.filter((q) => c.consent.answers[q.id] === "yes");
            return (
              <>
                <h1 className="page-title">Approve IV drip #{c.code}?</h1>
                <p className="text-lg">
                  {p.firstName} {p.lastName.charAt(0).toUpperCase()}., {ageFrom(p.dateOfBirth)} years{c.consent.treatment ? ` · ${c.consent.treatment}` : ""}
                </p>
                <dl className="grid grid-cols-2 gap-3">
                  {VITAL_FIELDS.filter((f) => c.preVitals?.[f.key] !== undefined).map((f) => (
                    <div key={f.key}>
                      <dt className="hint">{f.label.replace("Blood pressure: ", "BP ")}</dt>
                      <dd className="text-xl font-bold">{c.preVitals![f.key]} {f.unit}</dd>
                    </div>
                  ))}
                </dl>
                <p className="muted">Measured at {c.preVitalsAt ? formatTime(c.preVitalsAt) : ""} by the practitioner. All readings are within the clinic&rsquo;s ranges.</p>
                {yes.length > 0 && (
                  <div className="alert alert-error">
                    <p className="font-bold">Patient answered YES to</p>
                    <ul className="list-disc pl-6">{yes.map((q) => <li key={q.id}>{q.text}</li>)}</ul>
                    {c.consent.details.yesDetails && <p>Details: {c.consent.details.yesDetails}</p>}
                  </div>
                )}
                {c.consent.details.medications && <p><span className="font-bold">Medications:</span> {c.consent.details.medications}</p>}
                <div className="grid gap-3 sm:grid-cols-2">
                  <form action={doctorDecisionAction}>
                    <input type="hidden" name="token" value={token} />
                    <input type="hidden" name="decision" value="yes" />
                    <button type="submit" className="btn btn-primary btn-lg w-full">YES, continue</button>
                  </form>
                  <form action={doctorDecisionAction}>
                    <input type="hidden" name="token" value={token} />
                    <input type="hidden" name="decision" value="no" />
                    <button type="submit" className="btn btn-danger btn-lg w-full">NO, do not continue</button>
                  </form>
                </div>
              </>
            );
          })()
        )}
      </main>
    </div>
  );
}
