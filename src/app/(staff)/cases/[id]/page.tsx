import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { canSeeCase, canTreat, caseStatusLabel, getCase, getIdPhoto, isSigned, OUTCOME_LABEL } from "@/lib/cases";
import { CONSENT_FORMS } from "@/lib/consent-forms";
import { db } from "@/lib/db";
import { decryptPatient } from "@/lib/patients";
import { listDoctors } from "@/lib/queries";
import { dateOfBirthFromSaId } from "@/lib/sa-id";
import { getOnCallDoctorId, getVitalRanges } from "@/lib/settings";
import { ageFrom, formatDateTime, formatTime } from "@/lib/time";
import { checkVitals, formatVitals, VITAL_FIELDS, type Vitals } from "@/lib/vitals";
import { cancelCaseAction, handToClientAction, handToPatientAction, manualDecisionAction, resendConsentAction, resendDoctorAction, startCaseAction } from "@/app/actions/cases";
import { AssessmentForm } from "@/components/AssessmentForm";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CloseCaseForm, PostVitalsForm, PreVitalsForm } from "@/components/CaseForms";

export const metadata = { title: "Treatment case" };

type Step = { label: string; state: "done" | "current" | "todo" | "stopped" };

function Stepper({ steps }: { steps: Step[] }) {
  return (
    <ol className={`grid gap-2 sm:grid-cols-3 ${steps.length > 4 ? "lg:grid-cols-6" : "lg:grid-cols-4"}`} aria-label="Progress">
      {steps.map((s, i) => (
        <li
          key={s.label}
          aria-current={s.state === "current" ? "step" : undefined}
          className={`rounded-xl border-2 px-3 py-2 text-sm font-bold ${
            s.state === "done" ? "border-success bg-success-soft text-success" : s.state === "current" ? "border-brand bg-brand text-white" : s.state === "stopped" ? "border-danger bg-danger-soft text-danger" : "border-line bg-white text-muted"
          }`}
        >
          <span className="sr-only">{s.state === "done" ? "Done: " : s.state === "current" ? "Current step: " : s.state === "stopped" ? "Stopped: " : "Not started: "}</span>
          {i + 1}. {s.label}
        </li>
      ))}
    </ol>
  );
}

function VitalsTable({ vitals, title, at }: { vitals: Vitals; title: string; at?: Date | null }) {
  return (
    <div>
      <h3 className="font-bold">{title}{at ? ` · ${formatTime(at)}` : ""}</h3>
      <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-3">
        {VITAL_FIELDS.filter((f) => vitals[f.key] !== undefined).map((f) => (
          <div key={f.key}>
            <dt className="hint">{f.label.replace("Blood pressure: ", "BP ")}</dt>
            <dd className="text-lg font-bold">{vitals[f.key]} {f.unit}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function CasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const { id } = await params;
  const flags = await searchParams;
  const c = await getCase(id);
  if (!c || !canSeeCase(user.role, c.type)) notFound();
  await audit(user, "view", "TreatmentCase", id);

  const form = CONSENT_FORMS[c.type];
  const p = c.consent.patient;
  // Practitioners do IV drips; injections and laser are done by a doctor.
  const clinical = canTreat(user.role, c.type);
  const [ranges, doctors, onCall, idPhoto] = await Promise.all([getVitalRanges(), listDoctors(), getOnCallDoctorId(), getIdPhoto(c.patientId)]);
  const yesAnswers = form.questions.filter((q) => c.consent.answers[q.id] === "yes");
  const signed = isSigned(c.consent);
  const assessed = Boolean(p.dateOfBirth);

  const iv = c.type === "IV_DRIP";
  const s = c.status;
  const closedDone = s === "CLOSED" && c.outcome === "COMPLETED";
  const detailsStep: Step = { label: iv ? "Details and vitals" : "Details and history", state: s === "QUEUED" || c.outcome === "CANCELLED" ? "todo" : s === "ASSESSMENT" || s === "CONSENTED" ? "current" : s === "REFERRED" || c.outcome === "REFERRED_VITALS" ? "stopped" : "done" };
  const signStep: Step = { label: "Patient signs", state: signed ? "done" : s === "AWAITING_SIGNATURE" ? "current" : "todo" };
  const closeStep: Step = { label: "Close case", state: s === "CLOSED" && c.outcome !== "CANCELLED" ? "done" : ["READY_TO_CLOSE", "REFERRED", "DECLINED"].includes(s) || (!iv && ["IN_PROGRESS", "CONSENTED"].includes(s)) ? "current" : "todo" };
  const clientFormStep: Step = { label: "Client fills in and signs", state: signed ? "done" : s === "QUEUED" && c.outcome !== "CANCELLED" ? "current" : "todo" };
  const doctorStep: Step = { label: "Doctor: treatment and close", state: s === "CLOSED" && c.outcome !== "CANCELLED" ? "done" : signed ? "current" : "todo" };
  const steps: Step[] = iv
    ? [
        { label: "Checked in", state: "done" },
        detailsStep,
        { label: "Doctor approval", state: s === "AWAITING_DOCTOR" ? "current" : s === "DECLINED" || c.outcome === "DOCTOR_DECLINED" ? "stopped" : c.doctorDecision ? "done" : "todo" },
        signStep,
        { label: "Drip and vitals after", state: s === "IN_PROGRESS" ? "current" : s === "READY_TO_CLOSE" || closedDone ? "done" : "todo" },
        closeStep,
      ]
    : [{ label: "Checked in", state: "done" }, clientFormStep, doctorStep];

  // What the practitioner starts from: the check-in details, the date of
  // birth from a South African ID number, and a returning patient's record.
  let initial: Record<string, string> = {};
  if (s === "ASSESSMENT") {
    const known = c.patientId ? await db.patient.findUnique({ where: { id: c.patientId } }) : null;
    const prev = known ? decryptPatient(known) : undefined;
    initial = {
      firstName: p.firstName,
      lastName: p.lastName,
      idNumber: p.idNumber ?? "",
      dateOfBirth: p.dateOfBirth || prev?.dateOfBirth || dateOfBirthFromSaId(p.idNumber) || "",
      phone: p.phone || prev?.phone || "",
      email: p.email || prev?.email || "",
      emergencyName: c.consent.emergency.name || prev?.emergencyContact?.name || "",
      emergencyPhone: c.consent.emergency.phone || prev?.emergencyContact?.phone || "",
      medications: prev?.medical.medications ?? "",
    };
  }

  const preCheck = c.preVitals ? checkVitals(c.preVitals, ranges) : null;

  return (
    <div className="space-y-6">
      {(s === "AWAITING_DOCTOR" || s === "AWAITING_SIGNATURE") && <AutoRefresh seconds={5} />}
      {flags.closed && <div className="alert alert-success" role="status">Case closed and signed.</div>}
      {flags.emailed && <div className="alert alert-success" role="status">Consent form emailed to {p.email} and the clinic.</div>}
      {flags.emailfail && <div className="alert alert-error" role="alert">The consent email could not be sent. Check the email settings.</div>}
      {flags.undelivered && <div className="alert alert-error" role="alert">The message to the doctor could not be sent. Check the WhatsApp settings and the doctor&rsquo;s mobile number, or phone the doctor and record their answer below.</div>}
      {flags.resent && <div className="alert alert-success" role="status">Approval request sent to the doctor again.</div>}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="muted"><Link href="/cases" className="underline">Treatments</Link> / #{c.code}</p>
          <h1 className="page-title">{p.firstName} {p.lastName}</h1>
          <p className="muted">{form.shortName}{c.consent.treatment ? `: ${c.consent.treatment}` : ""}{p.dateOfBirth ? ` · ${ageFrom(p.dateOfBirth)} years` : ""} · checked in {formatDateTime(c.createdAt)}</p>
        </div>
        {c.patientId && (
          <div className="flex flex-wrap gap-3">
            <Link href={`/patients/${c.patientId}`} className="btn btn-secondary">Patient record</Link>
          </div>
        )}
      </div>

      <Stepper steps={steps} />
      <p className="text-lg font-bold" role="status">{s === "CLOSED" && c.outcome ? OUTCOME_LABEL[c.outcome] : caseStatusLabel(c)}</p>

      {yesAnswers.length > 0 && (
        <div className="alert alert-error" role="note">
          <p className="font-bold">Patient answered YES to</p>
          <ul className="list-disc pl-6">{yesAnswers.map((q) => <li key={q.id}>{q.text}</li>)}</ul>
          {c.consent.details.yesDetails && <p className="mt-1">Details: {c.consent.details.yesDetails}</p>}
        </div>
      )}

      {!clinical && s !== "CLOSED" && !(s === "QUEUED" && !iv) && (
        <div className="alert alert-info">{iv ? "A practitioner or doctor needs to sign in to continue this case." : "The doctor sees the client and closes this case."}</div>
      )}

      {s === "QUEUED" && (
        <section className="card space-y-4" aria-labelledby="queue-heading">
          <h2 id="queue-heading" className="section-title">{iv ? "Waiting for a practitioner" : "Client to fill in their form"}</h2>
          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-3">
            <div><dt className="hint">ID or passport number</dt><dd className="font-bold">{p.idNumber || "-"}</dd></div>
            <div><dt className="hint">Contact number</dt><dd className="font-bold">{p.phone || "-"}</dd></div>
            <div><dt className="hint">Emergency contact</dt><dd className="font-bold">{[c.consent.emergency.name, c.consent.emergency.phone].filter(Boolean).join(" · ") || "-"}</dd></div>
          </dl>
          <p className="muted">{c.patientId ? "Returning patient" : "New patient"}</p>
          <div className="flex flex-wrap gap-3">
            {iv && clinical && <form action={startCaseAction}><input type="hidden" name="caseId" value={c.id} /><button className="btn btn-primary btn-lg" type="submit">Start this case</button></form>}
            {!iv && <form action={handToClientAction}><input type="hidden" name="caseId" value={c.id} /><button className="btn btn-primary btn-lg" type="submit">Hand the tablet to the client</button></form>}
            <form action={cancelCaseAction}><input type="hidden" name="caseId" value={c.id} /><button className="btn btn-danger" type="submit">Remove from waiting list</button></form>
          </div>
        </section>
      )}

      {clinical && s === "ASSESSMENT" && (
        <>
          <AssessmentForm
            caseId={c.id}
            type={c.type}
            initial={initial}
            idPhotoOnFile={idPhoto}
            ranges={ranges}
            doctors={doctors.map((d) => ({ value: d.id, label: d.name }))}
            defaultDoctorId={onCall ?? undefined}
          />
          <form action={cancelCaseAction}><input type="hidden" name="caseId" value={c.id} /><button className="text-danger underline" type="submit">Client has left: remove this case</button></form>
        </>
      )}

      {s === "AWAITING_SIGNATURE" && (
        <section className="card space-y-4" aria-labelledby="sign-heading">
          <h2 id="sign-heading" className="section-title">Patient to read and sign</h2>
          <p>
            {iv ? "The doctor approved the drip. " : ""}Hand the tablet to {p.firstName} to read the conditions and sign.
            {iv ? " Do not start the drip until they have signed." : ""} The tablet locks to the signing screen; sign in again to take it back.
          </p>
          {clinical && <form action={handToPatientAction}><input type="hidden" name="caseId" value={c.id} /><button className="btn btn-primary btn-lg" type="submit">Hand the tablet to the patient</button></form>}
        </section>
      )}

      {/* IV drip: step 1, vitals before */}
      {clinical && iv && s === "CONSENTED" && (
        <section className="card space-y-4" aria-labelledby="pre-heading">
          <h2 id="pre-heading" className="section-title">Measure vital signs</h2>
          <PreVitalsForm caseId={c.id} ranges={ranges} doctors={doctors.map((d) => ({ value: d.id, label: d.name }))} defaultDoctorId={onCall ?? undefined} />
        </section>
      )}

      {c.preVitals && (
        <section className="card space-y-3" aria-labelledby="vitals-heading">
          <h2 id="vitals-heading" className="sr-only">Vital signs</h2>
          <VitalsTable vitals={c.preVitals} title="Vitals before treatment" at={c.preVitalsAt} />
          {c.postVitals && <VitalsTable vitals={c.postVitals} title="Vitals after treatment" at={c.postVitalsAt} />}
        </section>
      )}

      {/* Out of range: stop and refer */}
      {s === "REFERRED" && preCheck && (
        <div className="alert alert-error" role="alert">
          <p className="text-xl font-bold">Do not administer the drip. Refer the patient to a doctor immediately.</p>
          <p>These readings are outside the safe range. Nothing has been sent to the doctor, and the patient does not sign anything.</p>
          <ul className="mt-2 list-disc pl-6">
            {preCheck.outOfRange.map((o) => (
              <li key={o.key}>{o.label}: <strong>{o.value} {o.unit}</strong> (range {o.range.min}–{o.range.max})</li>
            ))}
          </ul>
        </div>
      )}

      {s === "AWAITING_DOCTOR" && (
        <section className="card space-y-4" aria-labelledby="wait-heading">
          <h2 id="wait-heading" className="section-title">Waiting for {c.doctor?.name ?? "the doctor"}</h2>
          <p>Vitals were sent at {c.doctorRequestedAt ? formatTime(c.doctorRequestedAt) : ""}. Do not start the drip until the doctor replies YES. This page updates by itself.</p>
          <p className="muted">Sent: {formatVitals(c.preVitals ?? {})}</p>
          {clinical && (
            <div className="flex flex-wrap gap-3">
              <form action={resendDoctorAction}><input type="hidden" name="caseId" value={c.id} /><button className="btn btn-secondary" type="submit">Send to doctor again</button></form>
              <details className="w-full">
                <summary className="cursor-pointer font-bold text-brand-dark underline">Doctor answered by phone instead?</summary>
                <div className="mt-3 flex flex-wrap gap-3">
                  <form action={manualDecisionAction}><input type="hidden" name="caseId" value={c.id} /><input type="hidden" name="decision" value="yes" /><button className="btn btn-primary" type="submit">Doctor said YES</button></form>
                  <form action={manualDecisionAction}><input type="hidden" name="caseId" value={c.id} /><input type="hidden" name="decision" value="no" /><button className="btn btn-danger" type="submit">Doctor said NO</button></form>
                </div>
              </details>
            </div>
          )}
        </section>
      )}

      {c.doctorDecisionAt && (
        <div className={`alert ${c.doctorDecision ? "alert-success" : "alert-error"}`} role="status">
          <p className="text-lg font-bold">
            {c.doctor?.name ?? "The doctor"} said {c.doctorDecision ? "YES" : "NO"} at {formatTime(c.doctorDecisionAt)}
            {c.doctorDecisionVia ? ` (${c.doctorDecisionVia})` : ""}.
          </p>
          {c.doctorDecision === false && <p>Do not administer the drip. Refer the patient to a doctor immediately. The patient does not sign anything.</p>}
          {c.doctorDecision && s === "IN_PROGRESS" && <p>You may proceed with the drip. When it is finished, measure and enter the vitals again.</p>}
        </div>
      )}

      {clinical && iv && s === "IN_PROGRESS" && (
        <section className="card space-y-4" aria-labelledby="post-heading">
          <h2 id="post-heading" className="section-title">After the drip</h2>
          <PostVitalsForm caseId={c.id} ranges={ranges} officeUse={form.officeUse} />
        </section>
      )}

      {clinical && (["READY_TO_CLOSE", "REFERRED", "DECLINED"].includes(s) || (!iv && ["IN_PROGRESS", "CONSENTED"].includes(s))) && (
        <section className="card space-y-4" aria-labelledby="close-heading">
          <h2 id="close-heading" className="section-title">{iv ? "Close the case" : "Treatment and close"}</h2>
          {!iv && <p>Check the client&rsquo;s answers below before treating. When you&rsquo;re done, record the product and close the case with your signature.</p>}
          <CloseCaseForm caseId={c.id} officeUse={iv ? undefined : form.officeUse} signer={iv ? "Practitioner" : "Doctor"} />
        </section>
      )}

      {s === "CLOSED" && (
        <section className="card space-y-3" aria-labelledby="closed-heading">
          <h2 id="closed-heading" className="section-title">Closed</h2>
          <p>{c.outcome === "CANCELLED" ? "Removed from the waiting list" : `Closed by ${c.practitioner?.name ?? "practitioner"}`} on {c.closedAt ? formatDateTime(c.closedAt) : ""}.</p>
          {Object.entries(c.officeUse).filter(([, v]) => v).length > 0 && (
            <dl className="grid gap-x-6 sm:grid-cols-3">
              {form.officeUse.map((f) => c.officeUse[f.id] && (
                <div key={f.id}><dt className="hint">{f.label}</dt><dd className="font-bold">{c.officeUse[f.id]}</dd></div>
              ))}
            </dl>
          )}
          <p><span className="font-bold">Notes:</span> {c.closingNotes || <span className="muted">None</span>}</p>
          {c.practitionerSignature && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.practitionerSignature} alt={`Signature of ${c.practitioner?.name ?? "practitioner"}`} className="h-24 rounded-lg border border-line bg-white" />
          )}
        </section>
      )}

      {assessed && (
        <details className="card" open={!iv && clinical && s !== "CLOSED"}>
          <summary className="section-title cursor-pointer">{signed ? "Patient details and signed consent" : "Patient details and medical history"}</summary>
          <div className="mt-4 space-y-3">
            <p>
              {form.title}, version {c.consent.formVersion}.{" "}
              {signed ? <>Signed by <strong>{c.consent.signedName}</strong> on {formatDateTime(new Date(c.consent.signedAt!))}.</> : "Not signed by the patient."}
            </p>
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              <div><dt className="hint">Date of birth</dt><dd>{p.dateOfBirth}</dd></div>
              <div><dt className="hint">ID number</dt><dd>{p.idNumber || "-"}</dd></div>
              <div><dt className="hint">Mobile</dt><dd>{p.phone}</dd></div>
              <div><dt className="hint">Email</dt><dd>{p.email}</dd></div>
              <div><dt className="hint">Emergency contact</dt><dd>{[c.consent.emergency.name, c.consent.emergency.phone].filter(Boolean).join(" · ") || "-"}</dd></div>
            </dl>
            {idPhoto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={idPhoto} alt="Photo of the patient's ID document" className="max-h-56 rounded-lg border border-line bg-white" />
            )}
            <table className="table">
              <tbody>
                {form.questions.map((q) => (
                  <tr key={q.id}><td>{q.text}</td><td className={`font-bold ${c.consent.answers[q.id] === "yes" ? "text-danger" : ""}`}>{c.consent.answers[q.id] === "yes" ? "Yes" : c.consent.answers[q.id] === "no" ? "No" : "-"}</td></tr>
                ))}
              </tbody>
            </table>
            {form.detailFields.map((d) => <p key={d.id}><span className="font-bold">{d.label}:</span> {c.consent.details[d.id] || "-"}</p>)}
            {signed && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.consent.signature} alt={`Signature of ${c.consent.signedName}`} className="h-24 rounded-lg border border-line bg-white" />
                <p className="muted">{c.consentEmailedAt ? `Emailed to the patient and clinic on ${formatDateTime(c.consentEmailedAt)}.` : "Not emailed yet."}</p>
                <form action={resendConsentAction}><input type="hidden" name="caseId" value={c.id} /><button className="btn btn-secondary" type="submit">{c.consentEmailedAt ? "Email it again" : "Email the consent form"}</button></form>
              </>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
