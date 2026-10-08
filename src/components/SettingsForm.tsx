"use client";

import { useActionState } from "react";
import { saveSettingsAction, type SettingsState } from "@/app/actions/settings";
import { VITAL_FIELDS, type VitalRanges } from "@/lib/vitals";
import { SelectField } from "./fields";
import { SubmitButton } from "./SubmitButton";

export function SettingsForm({ ranges, doctors, onCallDoctorId }: { ranges: VitalRanges; doctors: { value: string; label: string }[]; onCallDoctorId: string }) {
  const [state, action] = useActionState<SettingsState, FormData>(saveSettingsAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-6">
      {state.message && <div className="alert alert-success" role="status">{state.message}</div>}
      <section className="card space-y-4" aria-labelledby="ranges-heading">
        <h2 id="ranges-heading" className="section-title">IV drip vital sign ranges</h2>
        <p className="muted">A drip can only be sent to the doctor for approval when every reading is inside these ranges. Please have the clinic&rsquo;s medical lead confirm them.</p>
        <table className="table">
          <thead><tr><th scope="col">Reading</th><th scope="col">Minimum</th><th scope="col">Maximum</th></tr></thead>
          <tbody>
            {VITAL_FIELDS.map((f) => (
              <tr key={f.key}>
                <th scope="row" className="text-left">
                  {f.label} <span className="muted">({f.unit})</span>
                  {e[f.key] && <span className="error-text block">{e[f.key]}</span>}
                </th>
                <td><input aria-label={`${f.label} minimum`} name={`${f.key}_min`} type="number" step={f.step} className="input" defaultValue={ranges[f.key].min} /></td>
                <td><input aria-label={`${f.label} maximum`} name={`${f.key}_max`} type="number" step={f.step} className="input" defaultValue={ranges[f.key].max} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card space-y-4" aria-labelledby="oncall-heading">
        <h2 id="oncall-heading" className="section-title">Doctor on call</h2>
        <SelectField name="onCallDoctorId" label="Default doctor for IV drip approvals" defaultValue={onCallDoctorId} options={[{ value: "", label: "Ask each time" }, ...doctors]} hint="Practitioners can still choose another doctor on each case." />
      </section>
      <SubmitButton>Save settings</SubmitButton>
    </form>
  );
}
