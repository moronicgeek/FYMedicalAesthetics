"use client";

import { useActionState } from "react";
import { exitKioskAction, type ExitState } from "@/app/actions/kiosk";
import { SubmitButton } from "@/components/SubmitButton";

export function ExitForm() {
  const [state, action] = useActionState<ExitState, FormData>(exitKioskAction, {});
  return (
    <form action={action} className="space-y-5">
      {state.error && <div className="alert alert-error" role="alert">{state.error}</div>}
      <label className="field" htmlFor="password">
        <span className="label">Your staff password</span>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      </label>
      <SubmitButton className="btn btn-primary" pendingText="Checking…">Exit check-in mode</SubmitButton>
    </form>
  );
}
