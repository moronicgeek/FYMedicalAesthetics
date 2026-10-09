"use client";

import { useActionState } from "react";
import { assessmentAction, type StepState } from "@/app/actions/cases";
import { CONSENT_FORMS, type CaseType } from "@/lib/consent-forms";
import type { VitalRanges } from "@/lib/vitals";
import { VitalInputs } from "./CaseForms";
import { FormErrors, SelectField, TextArea, TextField } from "./fields";
import { IdPhotoField } from "./IdPhotoField";
import { SubmitButton } from "./SubmitButton";

// The practitioner fills this in with the client: details, the medical history
// questions from the consent form and, for an IV drip, the vitals.
export function AssessmentForm({
  caseId,
  type,
  initial,
  idPhotoOnFile,
  ranges,
  doctors,
  defaultDoctorId,
}: {
  caseId: string;
  type: CaseType;
  initial: Record<string, string>;
  idPhotoOnFile?: string;
  ranges: VitalRanges;
  doctors: { value: string; label: string }[];
  defaultDoctorId?: string;
}) {
  const def = CONSENT_FORMS[type];
  const [state, action] = useActionState<StepState, FormData>(assessmentAction, {});
  const v = state.values ?? initial;
  const e = state.errors ?? {};
  const today = new Date().toISOString().slice(0, 10);
  const iv = type === "IV_DRIP";

  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="caseId" value={caseId} />
      <FormErrors errors={state.errors} />

      <section className="card space-y-5" aria-labelledby="details-heading">
        <h2 id="details-heading" className="section-title">1. Patient details</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="idNumber" label="ID or passport number" required defaultValue={v.idNumber} error={e.idNumber} />
          <TextField name="dateOfBirth" label="Date of birth" type="date" required max={today} defaultValue={v.dateOfBirth} error={e.dateOfBirth} hint={initial.dateOfBirth && !state.values ? "Taken from the ID number. Please check it." : undefined} />
          <TextField name="firstName" label="First name" required defaultValue={v.firstName} error={e.firstName} />
          <TextField name="lastName" label="Surname" required defaultValue={v.lastName} error={e.lastName} />
          <TextField name="phone" label="Contact number" type="tel" inputMode="tel" required defaultValue={v.phone} error={e.phone} />
          <TextField name="email" label="Email address" type="email" inputMode="email" required defaultValue={v.email} error={e.email} hint="The signed consent form is emailed here" />
          <TextField name="emergencyName" label="Emergency contact name" defaultValue={v.emergencyName} />
          <TextField name="emergencyPhone" label="Emergency contact number" type="tel" inputMode="tel" defaultValue={v.emergencyPhone} />
        </div>
        <IdPhotoField name="idPhoto" onFile={idPhotoOnFile} error={e.idPhoto} />
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

      <section className="card space-y-2" aria-labelledby="history-heading">
        <h2 id="history-heading" className="section-title">2. Medical history</h2>
        <p className="muted">Ask the client each question.</p>
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
          <TextArea key={d.id} name={d.id} label={d.label.replace("If you answered", "If they answered")} defaultValue={v[d.id]} error={e[d.id]} />
        ))}
      </section>

      {iv && (
        <section className="card space-y-5" aria-labelledby="vitals-heading">
          <h2 id="vitals-heading" className="section-title">3. Vital signs</h2>
          <VitalInputs ranges={ranges} values={v} errors={e} />
          <SelectField name="doctorId" label="Doctor to approve" required placeholder="Choose a doctor" options={doctors} defaultValue={v.doctorId ?? defaultDoctorId} error={e.doctorId} />
          <p className="muted">If every reading is within range, the vitals go to the doctor by WhatsApp to approve. If any reading is outside the range, nothing is sent, the patient signs nothing, and you must not proceed.</p>
        </section>
      )}

      <SubmitButton className="btn btn-primary btn-lg w-full sm:w-auto" pendingText={iv ? "Checking…" : "Saving…"}>
        {iv ? "Submit and check vitals" : "Submit"}
      </SubmitButton>
    </form>
  );
}
