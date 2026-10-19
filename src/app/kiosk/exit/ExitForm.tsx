"use client";

import { useActionState } from "react";
import { exitKioskAction, type ExitState } from "@/app/actions/kiosk";
import { SubmitButton } from "@/components/SubmitButton";
import { useJumpToError } from "@/components/useJumpToError";
import { NO_PASSWORD_MANAGER } from "@/components/no-autofill";

export function ExitForm({ next }: { next?: string }) {
  const [state, action] = useActionState<ExitState, FormData>(exitKioskAction, {});
  const formRef = useJumpToError(state);
  return (
    <form ref={formRef} action={action} className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}
      {state.error && <div className="alert alert-error" role="alert">{state.error}</div>}
      <label className="field" htmlFor="email">
        <span className="label">Staff email</span>
        <input id="email" name="email" type="email" className="input" autoComplete="off" {...NO_PASSWORD_MANAGER} defaultValue={state.email} required />
      </label>
      <label className="field" htmlFor="password">
        <span className="label">Password</span>
        <input id="password" name="password" type="password" className="input" autoComplete="off" {...NO_PASSWORD_MANAGER} required />
      </label>
      <SubmitButton className="btn btn-primary btn-lg w-full" pendingText="Checking…">Continue</SubmitButton>
    </form>
  );
}
