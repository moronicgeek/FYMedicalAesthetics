"use client";

import { useActionState } from "react";
import { bookAppointmentAction, type AppointmentFormState } from "@/app/actions/appointments";
import { Checkbox, FormErrors, SelectField, TextArea } from "./fields";
import { SubmitButton } from "./SubmitButton";

type Option = { value: string; label: string };

export function BookingForm({ patients, doctors, services, initial, today }: { patients: Option[]; doctors: Option[]; services: readonly string[]; initial: Record<string, string>; today: string }) {
  const [state, action] = useActionState<AppointmentFormState, FormData>(bookAppointmentAction, { values: initial });
  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <form action={action} className="card space-y-5" noValidate>
      <FormErrors errors={state.errors} />
      <SelectField name="patientId" label="Patient" required placeholder="Choose a patient" options={patients} defaultValue={v.patientId} error={e.patientId} />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField name="doctorId" label="Doctor" required placeholder="Choose a doctor" options={doctors} defaultValue={v.doctorId} error={e.doctorId} />
        <SelectField name="service" label="Treatment" required placeholder="Choose a treatment" options={services.map((s) => ({ value: s, label: s }))} defaultValue={v.service} error={e.service} />
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <label className="field" htmlFor="date">
          <span className="label">Date <span className="text-danger" aria-hidden="true">*</span></span>
          {e.date && <span id="date-error" className="error-text">{e.date}</span>}
          <input id="date" name="date" type="date" min={today} className="input" defaultValue={v.date} required aria-invalid={e.date ? true : undefined} aria-describedby={e.date ? "date-error" : undefined} />
        </label>
        <label className="field" htmlFor="time">
          <span className="label">Time <span className="text-danger" aria-hidden="true">*</span></span>
          {e.time && <span id="time-error" className="error-text">{e.time}</span>}
          <input id="time" name="time" type="time" step={300} className="input" defaultValue={v.time} required aria-invalid={e.time ? true : undefined} aria-describedby={e.time ? "time-error" : undefined} />
        </label>
        <SelectField
          name="durationMinutes"
          label="Length"
          required
          defaultValue={v.durationMinutes ?? "30"}
          options={[15, 30, 45, 60, 90, 120].map((m) => ({ value: String(m), label: `${m} minutes` }))}
        />
      </div>
      <TextArea name="notes" label="Notes for the doctor" defaultValue={v.notes} />
      <Checkbox name="sendConfirmation" defaultChecked={(v.sendConfirmation ?? "on") === "on"} label="Send a confirmation to the patient and the doctor now" />
      <SubmitButton className="btn btn-primary btn-lg" pendingText="Booking…">Book appointment</SubmitButton>
    </form>
  );
}
