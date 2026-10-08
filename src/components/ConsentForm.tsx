"use client";

import { useActionState } from "react";
import { submitConsentAction, type ConsentFormState } from "@/app/actions/cases";
import { CLINIC_LINE, CONSENT_FORMS, type CaseType } from "@/lib/consent-forms";
import { Checkbox, FormErrors, TextArea, TextField } from "./fields";
import { SignaturePad } from "./SignaturePad";
import { SubmitButton } from "./SubmitButton";

export function ConsentForm({ type, kiosk }: { type: CaseType; kiosk: boolean }) {
  const def = CONSENT_FORMS[type];
  const [state, action] = useActionState<ConsentFormState, FormData>(submitConsentAction, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-8" noValidate>
      <input type="hidden" name="formType" value={type} />
      {kiosk && <input type="hidden" name="mode" value="kiosk" />}

      <header className="space-y-1">
        <p className="muted text-sm">FY Medical Aesthetics · {CLINIC_LINE}</p>
        <h1 className="page-title">{def.title}</h1>
        {def.subtitle && <p className="muted">{def.subtitle}</p>}
      </header>

      <FormErrors errors={state.errors} />

      <section className="card space-y-5" aria-labelledby="details-heading">
        <h2 id="details-heading" className="section-title">Your details</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="firstName" label="First name" required autoComplete="given-name" defaultValue={v.firstName} error={e.firstName} />
          <TextField name="lastName" label="Surname" required autoComplete="family-name" defaultValue={v.lastName} error={e.lastName} />
          <TextField name="dateOfBirth" label="Date of birth" type="date" required max={today} defaultValue={v.dateOfBirth} error={e.dateOfBirth} />
          <TextField name="idNumber" label="ID number" defaultValue={v.idNumber} error={e.idNumber} />
          <TextField name="phone" label="Contact number" type="tel" inputMode="tel" required autoComplete="tel" defaultValue={v.phone} error={e.phone} />
          <TextField name="email" label="Email address" type="email" inputMode="email" required autoComplete="email" defaultValue={v.email} error={e.email} hint="We'll email you a copy of this signed form" />
        </div>
        {def.treatmentChoice && (
          <div className="field">
            <span className="label">{def.treatmentChoice.label}</span>
            {e.treatment && <span className="error-text">{e.treatment}</span>}
            {def.treatmentChoice.options.length > 0 && (
              <div className="flex flex-wrap gap-x-6">
                {def.treatmentChoice.options.map((o) => (
                  <label key={o} className="choice">
                    <input type="checkbox" name={`treatment_${o}`} defaultChecked={v[`treatment_${o}`] === "on"} />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
            )}
            {def.treatmentChoice.freeText && (
              <input
                name="treatmentOther"
                className="input"
                aria-label={def.treatmentChoice.options.length ? "Other treatment" : def.treatmentChoice.label}
                placeholder={def.treatmentChoice.options.length ? "Other (please describe)" : ""}
                defaultValue={v.treatmentOther}
              />
            )}
          </div>
        )}
      </section>

      <section className="card space-y-4" aria-labelledby="info-heading">
        <h2 id="info-heading" className="section-title">About this treatment</h2>
        {def.sections.map((s) => (
          <div key={s.heading} className="space-y-2">
            <h3 className="font-bold">{s.heading}</h3>
            {s.paragraphs?.map((p) => <p key={p}>{p}</p>)}
            {s.bullets && (
              <ul className="list-disc space-y-1 pl-6">
                {s.bullets.map((b) => <li key={b}>{b}</li>)}
              </ul>
            )}
          </div>
        ))}
      </section>

      <section className="card space-y-2" aria-labelledby="history-heading">
        <h2 id="history-heading" className="section-title">Medical history</h2>
        <p className="muted">Please answer every question.</p>
        <div className="divide-y divide-line">
          {def.questions.map((q) => {
            const name = `q_${q.id}`;
            return (
              <fieldset key={q.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between" aria-describedby={e[name] ? `${name}-error` : undefined}>
                <legend className="sr-only">{q.text}</legend>
                <span aria-hidden="true" className="sm:pr-4">{q.text}</span>
                <span className="flex items-center gap-6">
                  {e[name] && <span id={`${name}-error`} className="error-text">{e[name]}</span>}
                  {(["yes", "no"] as const).map((a) => (
                    <label key={a} className="choice">
                      <input type="radio" name={name} value={a} defaultChecked={v[name] === a} />
                      <span className="font-bold">{a === "yes" ? "Yes" : "No"}</span>
                    </label>
                  ))}
                </span>
              </fieldset>
            );
          })}
        </div>
        {def.detailFields.map((d) => (
          <TextArea key={d.id} name={d.id} label={d.label} defaultValue={v[d.id]} error={e[d.id]} />
        ))}
      </section>

      <section className="card space-y-2" aria-labelledby="ack-heading">
        <h2 id="ack-heading" className="section-title">Patient acknowledgement</h2>
        <p className="muted">Please read and tick each statement.</p>
        {def.acknowledgements.map((a, i) => (
          <Checkbox key={a} name={`ack_${i}`} required defaultChecked={v[`ack_${i}`] === "on"} error={e[`ack_${i}`]} label={a} />
        ))}
      </section>

      <section className="card space-y-5" aria-labelledby="consent-heading">
        <h2 id="consent-heading" className="section-title">Consent</h2>
        {def.consentStatement && <p className="text-lg">{def.consentStatement("the undersigned")}</p>}
        <TextField name="signedName" label="Type your full name" required autoComplete="name" defaultValue={v.signedName} error={e.signedName} />
        <SignaturePad name="signature" label="Patient signature" error={e.signature} defaultValue={v.signature} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="emergencyName" label="Emergency contact name" defaultValue={v.emergencyName} />
          <TextField name="emergencyPhone" label="Emergency contact number" type="tel" inputMode="tel" defaultValue={v.emergencyPhone} />
        </div>
        {def.postCare && (
          <div className="alert alert-info">
            <p className="font-bold">Post-care advice</p>
            <p>{def.postCare}</p>
          </div>
        )}
      </section>

      <SubmitButton className="btn btn-primary btn-lg w-full sm:w-auto" pendingText="Saving your form…">Sign and submit</SubmitButton>
    </form>
  );
}
