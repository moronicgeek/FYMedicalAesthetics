"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { reportProblemAction, type ProblemFormState } from "@/app/actions/problems";
import { FormErrors, TextArea } from "./fields";
import { SubmitButton } from "./SubmitButton";
import { useJumpToError } from "./useJumpToError";

export function ProblemForm({ from }: { from: string }) {
  const [state, action] = useActionState<ProblemFormState, FormData>(reportProblemAction, {});
  const formRef = useJumpToError(state);
  const [screen, setScreen] = useState("");
  useEffect(() => setScreen(`${window.innerWidth}×${window.innerHeight}`), []);
  const v = state.values ?? {};
  const e = state.errors ?? {};

  if (state.sent) {
    return (
      <div className="space-y-4">
        <div className="alert alert-success" role="status">
          <p className="font-bold">Thank you. Your report has been sent.</p>
          <p>We will look into it and let you know when it is fixed.</p>
        </div>
        <Link href={from} className="btn btn-primary">Go back to where I was</Link>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} className="space-y-5" noValidate>
      <FormErrors errors={state.errors} />
      <input type="hidden" name="path" value={from} />
      <input type="hidden" name="screen" value={screen} />
      <div className="alert alert-info">
        <p className="font-bold">Please do not type any patient details.</p>
        <p>No names, ID numbers, phone numbers or medical information. Describe the problem only, for example &ldquo;the Save button on the booking screen did nothing&rdquo;.</p>
      </div>
      <TextArea name="whatHappened" label="What went wrong?" required defaultValue={v.whatHappened} error={e.whatHappened} hint="What you were doing, what you pressed and what happened" />
      <TextArea name="expected" label="What did you expect to happen?" defaultValue={v.expected} error={e.expected} />
      <p className="muted">We also send which screen you were on, your role, the time, and which browser and device you use. Nothing else from the screen is sent.</p>
      <div className="flex flex-wrap gap-3">
        <SubmitButton pendingText="Sending…">Send report</SubmitButton>
        <Link href={from} className="btn btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
