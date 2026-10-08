"use client";

import { useActionState } from "react";
import { addStaffAction, resetPasswordAction, type ResetState, type StaffFormState } from "@/app/actions/staff";
import { FormErrors, SelectField, TextField } from "./fields";
import { SubmitButton } from "./SubmitButton";

export function AddStaffForm() {
  const [state, action] = useActionState<StaffFormState, FormData>(addStaffAction, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate key={state.created}>
      {state.created && <div className="alert alert-success" role="status">{state.created} has been added.</div>}
      <FormErrors errors={state.errors} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="name" label="Full name" required defaultValue={v.name} error={e.name} hint="Doctors: include the title, e.g. Dr Fatima Yusuf" />
        <SelectField
          name="role"
          label="Role"
          required
          defaultValue={v.role ?? "DOCTOR"}
          error={e.role}
          options={[
            { value: "DOCTOR", label: "Doctor" },
            { value: "RECEPTION", label: "Reception" },
            { value: "ADMIN", label: "Administrator" },
          ]}
        />
        <TextField name="email" label="Email" type="email" required defaultValue={v.email} error={e.email} hint="Doctors receive appointment notices here" />
        <TextField name="phone" label="Mobile" type="tel" defaultValue={v.phone} error={e.phone} />
        <TextField name="password" label="Temporary password" type="password" required error={e.password} hint="At least 12 characters" />
      </div>
      <SubmitButton pendingText="Adding…">Add staff member</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ id, name }: { id: string; name: string }) {
  const [state, action] = useActionState<ResetState, FormData>(resetPasswordAction, {});
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <input type="hidden" name="id" value={id} />
      <label className="field" htmlFor={`pw-${id}`}>
        <span className="hint">New password for {name}</span>
        <input id={`pw-${id}`} name="password" type="password" className="input" minLength={12} required />
      </label>
      <SubmitButton className="btn btn-secondary" pendingText="Saving…">Reset password</SubmitButton>
      {state.message && <span role="status" className="text-success font-bold">{state.message}</span>}
      {state.error && <span role="alert" className="error-text">{state.error}</span>}
    </form>
  );
}
