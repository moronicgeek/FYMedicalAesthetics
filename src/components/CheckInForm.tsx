"use client";

import { useActionState, useState } from "react";
import { checkInAction, type ConsentFormState } from "@/app/actions/cases";
import { CASE_TYPES, CONSENT_FORMS } from "@/lib/consent-forms";
import { FormErrors, RadioGroup, TextField } from "./fields";
import type { CaseType } from "@/lib/consent-forms";
import type { IvDrip } from "@/lib/settings";
import { DripCards } from "./DripCards";
import { SubmitButton } from "./SubmitButton";
import { useJumpToError } from "./useJumpToError";

const DESCRIPTIONS = {
  IV_DRIP: "IV drip",
  AESTHETICS: "Botox, filler, peel or microneedling",
  LASER: "Laser",
} as const;

const KIOSK_DESCRIPTIONS = {
  IV_DRIP: "IV drip (vitamin and hydration drips)",
  AESTHETICS: "Botox, dermal fillers, chemical peels or microneedling",
  LASER: "Laser",
} as const;

// Used by staff on the check-in page, and by the client themselves on the
// tablet (kiosk), which has a single Continue button. With fixedType the
// treatment was already chosen on the tablet's start screen.
export function CheckInForm({ canStartIv = false, ivOnly = false, kiosk = false, drips = [], fixedType }: { canStartIv?: boolean; ivOnly?: boolean; kiosk?: boolean; drips?: IvDrip[]; fixedType?: CaseType }) {
  const [state, action] = useActionState<ConsentFormState, FormData>(checkInAction, {});
  const formRef = useJumpToError(state);
  const v = state.values ?? {};
  const e = state.errors ?? {};
  // The drip cards appear once IV drip is chosen.
  const [type, setType] = useState(fixedType ?? v.formType);
  return (
    <form ref={formRef} action={action} className="space-y-5" noValidate>
      <FormErrors errors={state.errors} />
      {kiosk && <input type="hidden" name="mode" value="kiosk" />}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="firstName" label="First name" required defaultValue={v.firstName} error={e.firstName} />
        <TextField name="lastName" label="Surname" required defaultValue={v.lastName} error={e.lastName} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="idNumber" label="ID or passport number" required defaultValue={v.idNumber} error={e.idNumber} hint={kiosk ? undefined : "A returning client's details are filled in from this"} />
        <TextField name="phone" label="Contact number" type="tel" inputMode="tel" required defaultValue={v.phone} error={e.phone} />
        <TextField name="emergencyName" label="Emergency contact name" required defaultValue={v.emergencyName} error={e.emergencyName} />
        <TextField name="emergencyPhone" label="Emergency contact number" type="tel" inputMode="tel" required defaultValue={v.emergencyPhone} error={e.emergencyPhone} />
      </div>
      {fixedType ? (
        <input type="hidden" name="formType" value={fixedType} />
      ) : (
      <div onChange={(ev) => { const t = ev.target as HTMLInputElement; if (t.name === "formType") setType(t.value); }}>
      <RadioGroup name="formType" label="Treatment" required defaultValue={v.formType} error={e.formType} options={CASE_TYPES.filter((t) => !ivOnly || t === "IV_DRIP").map((t) => ({ value: t, label: (kiosk ? KIOSK_DESCRIPTIONS : DESCRIPTIONS)[t] ?? CONSENT_FORMS[t].shortName }))} />
      </div>
      )}
      {type === "IV_DRIP" && drips.length > 0 && <DripCards drips={drips} defaultValue={v.drip} error={e.drip} forClient={kiosk} />}
      {kiosk ? (
        <SubmitButton className="btn btn-primary btn-lg w-full sm:w-auto" pendingText="Checking you in…">Continue</SubmitButton>
      ) : (
      <>
      <div className="flex flex-wrap gap-3">
        <SubmitButton name="intent" value="queue" className="btn btn-primary btn-lg" pendingText="Saving…">Add to waiting list</SubmitButton>
        <SubmitButton name="intent" value="start" className="btn btn-secondary btn-lg" pendingText="Saving…">Start now</SubmitButton>
      </div>
      <p className="muted">
        {ivOnly
          ? "Start now opens the practitioner form. Injection and laser clients are checked in by reception or a doctor."
          : canStartIv
          ? "Start now opens the practitioner form for an IV drip. For injections and laser it hands the tablet to the client to fill in their form."
          : "Start now hands the tablet to the client for injections and laser. IV drip clients go on the waiting list for a practitioner."}
      </p>
      </>
      )}
    </form>
  );
}
