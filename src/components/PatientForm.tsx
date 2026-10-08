"use client";

import { useActionState } from "react";
import { savePatientAction, type PatientFormState } from "@/app/actions/patients";
import { Checkbox, FormErrors, RadioGroup, TextArea, TextField } from "./fields";
import { SubmitButton } from "./SubmitButton";

export function PatientForm({ patientId, initial, submitLabel, kiosk = false }: { patientId?: string; initial?: Record<string, string>; submitLabel: string; kiosk?: boolean }) {
  const [state, action] = useActionState<PatientFormState, FormData>(savePatientAction, { values: initial });
  const v = state.values ?? {};
  const e = state.errors ?? {};
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-8" noValidate>
      {patientId && <input type="hidden" name="patientId" value={patientId} />}
      {kiosk && <input type="hidden" name="mode" value="kiosk" />}
      <FormErrors errors={state.errors} />

      <section className="card space-y-5" aria-labelledby="about-heading">
        <h2 id="about-heading" className="section-title">1. About you</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="firstName" label="First name" required autoComplete="given-name" defaultValue={v.firstName} error={e.firstName} />
          <TextField name="lastName" label="Surname" required autoComplete="family-name" defaultValue={v.lastName} error={e.lastName} />
          <TextField name="preferredName" label="Preferred name" hint="What you like to be called" defaultValue={v.preferredName} error={e.preferredName} />
          <TextField name="dateOfBirth" label="Date of birth" type="date" required max={today} autoComplete="bday" defaultValue={v.dateOfBirth} error={e.dateOfBirth} />
          <TextField name="gender" label="Gender" defaultValue={v.gender} error={e.gender} />
          <TextField name="idNumber" label="ID or passport number" hint="Helps us find your record quickly next time" defaultValue={v.idNumber} error={e.idNumber} />
        </div>
      </section>

      <section className="card space-y-5" aria-labelledby="contact-heading">
        <h2 id="contact-heading" className="section-title">2. How we contact you</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="phone" label="Mobile number" type="tel" inputMode="tel" required autoComplete="tel" defaultValue={v.phone} error={e.phone} hint="Include the country code, e.g. +27 82 123 4567" />
          <TextField name="email" label="Email address" type="email" inputMode="email" autoComplete="email" defaultValue={v.email} error={e.email} />
        </div>
        <TextArea name="address" label="Home address" defaultValue={v.address} error={e.address} />
        <RadioGroup
          name="contactPreference"
          label="How should we send appointment reminders?"
          required
          defaultValue={v.contactPreference ?? "whatsapp"}
          error={e.contactPreference}
          options={[
            { value: "whatsapp", label: "WhatsApp" },
            { value: "email", label: "Email" },
            { value: "both", label: "Both" },
          ]}
        />
      </section>

      <section className="card space-y-5" aria-labelledby="emergency-heading">
        <h2 id="emergency-heading" className="section-title">3. Emergency contact</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <TextField name="emergencyName" label="Name" defaultValue={v.emergencyName} />
          <TextField name="emergencyPhone" label="Phone" type="tel" inputMode="tel" defaultValue={v.emergencyPhone} />
          <TextField name="emergencyRelationship" label="Relationship" defaultValue={v.emergencyRelationship} />
        </div>
      </section>

      <section className="card space-y-5" aria-labelledby="medical-heading">
        <h2 id="medical-heading" className="section-title">4. Your health</h2>
        <p className="muted">This helps your doctor plan safe treatment. Write &ldquo;None&rdquo; if something doesn&rsquo;t apply.</p>
        <TextArea name="conditions" label="Medical conditions" hint="For example diabetes, high blood pressure, autoimmune conditions, keloid scarring" defaultValue={v.conditions} />
        <TextArea name="medications" label="Medicines you take" hint="Include blood thinners, supplements and skin creams" defaultValue={v.medications} />
        <TextArea name="allergies" label="Allergies" hint="Medicines, latex, anaesthetics, foods" defaultValue={v.allergies} />
        <TextArea name="previousTreatments" label="Previous aesthetic treatments" hint="What, when, and any reactions" defaultValue={v.previousTreatments} />
        <div className="grid gap-5 sm:grid-cols-2">
          <RadioGroup name="pregnantOrBreastfeeding" label="Are you pregnant or breastfeeding?" defaultValue={v.pregnantOrBreastfeeding ?? "na"} options={[{ value: "no", label: "No" }, { value: "yes", label: "Yes" }, { value: "na", label: "Not applicable" }]} />
          <RadioGroup name="smoker" label="Do you smoke?" defaultValue={v.smoker ?? "no"} options={[{ value: "no", label: "No" }, { value: "yes", label: "Yes" }]} />
        </div>
        <TextArea name="treatmentInterest" label="What would you like help with today?" defaultValue={v.treatmentInterest} />
      </section>

      <section className="card space-y-4" aria-labelledby="consent-heading">
        <h2 id="consent-heading" className="section-title">5. Consent</h2>
        <Checkbox
          name="consentData"
          required
          defaultChecked={v.consentData === "on"}
          error={e.consentData}
          label="I agree that FY Medical Aesthetics may store and use my personal and health information to provide my care. It is kept encrypted and only seen by clinic staff."
        />
        <Checkbox name="consentAccuracy" required defaultChecked={v.consentAccuracy === "on"} error={e.consentAccuracy} label="The information I have given is true and complete to the best of my knowledge." />
        <Checkbox name="consentMarketing" defaultChecked={v.consentMarketing === "on"} label="I would like to hear about offers and new treatments (optional)." />
        <TextField name="signedName" label="Type your full name to sign" required autoComplete="name" defaultValue={v.signedName} error={e.signedName} />
      </section>

      <div className="flex flex-wrap gap-4">
        <SubmitButton className="btn btn-primary btn-lg">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
