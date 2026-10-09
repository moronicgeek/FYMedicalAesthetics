"use client";

import { useActionState } from "react";
import { signConsentAction, type ConsentFormState } from "@/app/actions/cases";
import { CLINIC_LINE, CONSENT_FORMS, type CaseType } from "@/lib/consent-forms";
import { Checkbox, FormErrors, TextField } from "./fields";
import { SignaturePad } from "./SignaturePad";
import { SubmitButton } from "./SubmitButton";

// What the patient sees on the tablet: the conditions of the treatment, the
// acknowledgements to tick, and the signature box. Nothing else.
export function SignConsentForm({ caseId, type, patientName, treatment }: { caseId: string; type: CaseType; patientName: string; treatment?: string }) {
  const def = CONSENT_FORMS[type];
  const [state, action] = useActionState<ConsentFormState, FormData>(signConsentAction, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};

  return (
    <form action={action} className="space-y-8" noValidate>
      <input type="hidden" name="caseId" value={caseId} />
      <header className="space-y-1">
        <p className="muted text-sm">FY Medical Aesthetics · {CLINIC_LINE}</p>
        <h1 className="page-title">{def.title}</h1>
        <p className="text-lg">For <strong>{patientName}</strong>{treatment ? <> · {treatment}</> : null}</p>
        <p className="muted">Please read the information below, tick each statement and sign at the bottom.</p>
      </header>

      <FormErrors errors={state.errors} />

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

      <section className="card space-y-2" aria-labelledby="ack-heading">
        <h2 id="ack-heading" className="section-title">Patient acknowledgement</h2>
        <p className="muted">Please read and tick each statement.</p>
        {def.acknowledgements.map((a, i) => (
          <Checkbox key={a} name={`ack_${i}`} required defaultChecked={v[`ack_${i}`] === "on"} error={e[`ack_${i}`]} label={a} />
        ))}
      </section>

      <section className="card space-y-5" aria-labelledby="consent-heading">
        <h2 id="consent-heading" className="section-title">Consent</h2>
        {def.consentStatement && <p className="text-lg">{def.consentStatement(patientName)}</p>}
        <TextField name="signedName" label="Type your full name" required autoComplete="name" defaultValue={v.signedName ?? patientName} error={e.signedName} />
        <SignaturePad name="signature" label="Your signature" error={e.signature} defaultValue={v.signature} />
        {def.postCare && (
          <div className="alert alert-info">
            <p className="font-bold">Post-care advice</p>
            <p>{def.postCare}</p>
          </div>
        )}
      </section>

      <SubmitButton className="btn btn-primary btn-lg w-full sm:w-auto" pendingText="Saving…">Sign</SubmitButton>
    </form>
  );
}
