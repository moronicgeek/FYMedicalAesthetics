"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "../actions/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { useJumpToError } from "@/components/useJumpToError";
import { NO_PASSWORD_MANAGER } from "@/components/no-autofill";

export function LoginForm() {
  const [state, action] = useActionState<LoginState, FormData>(loginAction, {});
  const formRef = useJumpToError(state);
  return (
    <form ref={formRef} action={action} className="space-y-5" noValidate>
      {state.error && <div className="alert alert-error" role="alert">{state.error}</div>}
      <label className="field" htmlFor="email">
        <span className="label">Email address</span>
        <input id="email" name="email" type="email" className="input" autoComplete="off" {...NO_PASSWORD_MANAGER} defaultValue={state.email} required />
      </label>
      <label className="field" htmlFor="password">
        <span className="label">Password</span>
        <input id="password" name="password" type="password" className="input" autoComplete="off" {...NO_PASSWORD_MANAGER} required />
      </label>
      <SubmitButton className="btn btn-primary btn-lg w-full" pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
