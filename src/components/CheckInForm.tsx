"use client";

import { useActionState } from "react";
import { checkInAction, type ConsentFormState } from "@/app/actions/cases";
import { CASE_TYPES, CONSENT_FORMS } from "@/lib/consent-forms";
import { FormErrors, RadioGroup, TextField } from "./fields";
import { SubmitButton } from "./SubmitButton";

const DESCRIPTIONS = {
  IV_DRIP: "IV drip",
  AESTHETICS: "Botox, filler, peel or microneedling",
  LASER: "Laser",
} as const;

export function CheckInForm({ canStart }: { canStart: boolean }) {
  const [state, action] = useActionState<ConsentFormState, FormData>(checkInAction, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormErrors errors={state.errors} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="firstName" label="First name" required defaultValue={v.firstName} error={e.firstName} />
        <TextField name="lastName" label="Surname" required defaultValue={v.lastName} error={e.lastName} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="idNumber" label="ID or passport number" required defaultValue={v.idNumber} error={e.idNumber} hint="A returning client's details are filled in from this" />
        <TextField name="phone" label="Contact number" type="tel" inputMode="tel" required defaultValue={v.phone} error={e.phone} />
        <TextField name="emergencyName" label="Emergency contact name" defaultValue={v.emergencyName} error={e.emergencyName} />
        <TextField name="emergencyPhone" label="Emergency contact number" type="tel" inputMode="tel" defaultValue={v.emergencyPhone} error={e.emergencyPhone} />
      </div>
      <RadioGroup name="formType" label="Treatment" required defaultValue={v.formType} error={e.formType} options={CASE_TYPES.map((t) => ({ value: t, label: DESCRIPTIONS[t] ?? CONSENT_FORMS[t].shortName }))} />
      <div className="flex flex-wrap gap-3">
        <SubmitButton name="intent" value="queue" className="btn btn-primary btn-lg" pendingText="Saving…">Add to waiting list</SubmitButton>
        {canStart && <SubmitButton name="intent" value="start" className="btn btn-secondary btn-lg" pendingText="Saving…">Start the case now</SubmitButton>}
      </div>
    </form>
  );
}
