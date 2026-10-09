"use client";

import { useActionState, useState } from "react";
import { closeCaseAction, postVitalsAction, preVitalsAction, type StepState } from "@/app/actions/cases";
import { VITAL_FIELDS, type VitalRanges } from "@/lib/vitals";
import { FormErrors, SelectField, TextField } from "./fields";
import { SignaturePad } from "./SignaturePad";
import { SubmitButton } from "./SubmitButton";

export function VitalInputs({ ranges, values, errors }: { ranges: VitalRanges; values: Record<string, string>; errors: Record<string, string> }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {VITAL_FIELDS.map((f) => (
        <label key={f.key} className="field" htmlFor={f.key}>
          <span className="label">
            {f.label} {f.required ? <span className="text-danger" aria-hidden="true">*</span> : <span className="font-normal text-muted">(optional)</span>}
          </span>
          <span className="hint" id={`${f.key}-hint`}>
            Normal range {ranges[f.key].min}–{ranges[f.key].max} {f.unit}
          </span>
          {errors[f.key] && <span id={`${f.key}-error`} className="error-text">{errors[f.key]}</span>}
          <span className="flex items-center gap-2">
            <input
              id={f.key}
              name={f.key}
              type="number"
              inputMode="decimal"
              step={f.step}
              className="input"
              defaultValue={values[f.key]}
              required={f.required}
              aria-invalid={errors[f.key] ? true : undefined}
              aria-describedby={`${f.key}-hint${errors[f.key] ? ` ${f.key}-error` : ""}`}
            />
            <span className="muted min-w-16">{f.unit}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export function PreVitalsForm({ caseId, ranges, doctors, defaultDoctorId }: { caseId: string; ranges: VitalRanges; doctors: { value: string; label: string }[]; defaultDoctorId?: string }) {
  const [state, action] = useActionState<StepState, FormData>(preVitalsAction, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="caseId" value={caseId} />
      <FormErrors errors={state.errors} />
      <VitalInputs ranges={ranges} values={v} errors={e} />
      <SelectField name="doctorId" label="Doctor to approve" required placeholder="Choose a doctor" options={doctors} defaultValue={v.doctorId ?? defaultDoctorId} error={e.doctorId} />
      <p className="muted">If every reading is within range, the vitals are sent to the doctor to approve. If any reading is outside the range, nothing is sent and you must not proceed.</p>
      <SubmitButton className="btn btn-primary btn-lg" pendingText="Checking…">Check vitals</SubmitButton>
    </form>
  );
}

export function PostVitalsForm({ caseId, ranges, officeUse }: { caseId: string; ranges: VitalRanges; officeUse: { id: string; label: string }[] }) {
  const [state, action] = useActionState<StepState, FormData>(postVitalsAction, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="caseId" value={caseId} />
      <FormErrors errors={state.errors} />
      <div className="grid gap-5 sm:grid-cols-2">
        {officeUse.map((f) => <TextField key={f.id} name={`office_${f.id}`} label={f.label} defaultValue={v[`office_${f.id}`]} />)}
      </div>
      <h3 className="font-bold">Vitals after the drip</h3>
      <VitalInputs ranges={ranges} values={v} errors={e} />
      <SubmitButton className="btn btn-primary btn-lg" pendingText="Saving…">Save vitals after treatment</SubmitButton>
    </form>
  );
}

export function CloseCaseForm({ caseId, officeUse, warning }: { caseId: string; officeUse?: { id: string; label: string }[]; warning?: string }) {
  const [state, action] = useActionState<StepState, FormData>(closeCaseAction, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};
  const [count, setCount] = useState((v.notes ?? "").length);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="caseId" value={caseId} />
      <FormErrors errors={state.errors} />
      {warning && <div className="alert alert-error">{warning}</div>}
      {officeUse && officeUse.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2">
          {officeUse.map((f) => <TextField key={f.id} name={`office_${f.id}`} label={f.label} defaultValue={v[`office_${f.id}`]} />)}
        </div>
      )}
      <label className="field" htmlFor="notes">
        <span className="label">Notes <span className="font-normal text-muted">(optional)</span></span>
        {e.notes && <span id="notes-error" className="error-text">{e.notes}</span>}
        <textarea id="notes" name="notes" className="input" maxLength={200} defaultValue={v.notes} onChange={(ev) => setCount(ev.target.value.length)} aria-describedby="notes-count" />
        <span id="notes-count" className="hint" aria-live="polite">{count} / 200 characters</span>
      </label>
      <SignaturePad name="signature" label="Practitioner signature" error={e.signature} defaultValue={v.signature} />
      <SubmitButton className="btn btn-primary btn-lg" pendingText="Closing…">Sign and close case</SubmitButton>
    </form>
  );
}
