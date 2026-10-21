"use client";

import Link from "next/link";
import { useActionState } from "react";
import { savePaperHistoryAction, type PaperHistoryFormState } from "@/app/actions/paper-history";
import { PAPER_KINDS } from "@/lib/paper-history";
import { FormErrors, RadioGroup, TextArea, TextField } from "./fields";
import { SubmitButton } from "./SubmitButton";
import { useJumpToError } from "./useJumpToError";

const KIND_OPTIONS = Object.entries(PAPER_KINDS).map(([value, label]) => ({ value, label }));

export function PaperHistoryForm({ patientId, entryId, initial = {}, today }: { patientId: string; entryId?: string; initial?: Record<string, string>; today: string }) {
  const [state, action] = useActionState<PaperHistoryFormState, FormData>(savePaperHistoryAction, {});
  const formRef = useJumpToError(state);
  const v = state.values ?? initial;
  const e = state.errors ?? {};

  return (
    <form ref={formRef} action={action} className="card space-y-5" noValidate>
      <FormErrors errors={state.errors} />
      <input type="hidden" name="patientId" value={patientId} />
      {entryId && <input type="hidden" name="entryId" value={entryId} />}
      <RadioGroup name="kind" label="What is this entry?" required defaultValue={v.kind ?? "visit"} error={e.kind} options={KIND_OPTIONS} />
      <TextField name="date" type="date" max={today} label="Date on the paper file" defaultValue={v.date} error={e.date} hint="Leave blank if the file doesn't show a date" />
      <TextField name="treatment" label="Treatment" defaultValue={v.treatment} error={e.treatment} hint="For example: Botox, IV drip (Myers Cocktail), laser" />
      <TextField name="treatedBy" label="Treated or seen by" defaultValue={v.treatedBy} error={e.treatedBy} hint="The doctor or practitioner named on the file" />
      <TextArea name="notes" label="What the paper file says" required defaultValue={v.notes} error={e.notes} hint="Copy it as written: amounts, areas treated, reactions, allergies, medicines, conditions" />
      <div className="flex flex-wrap gap-3">
        <SubmitButton>{entryId ? "Save changes" : "Save"}</SubmitButton>
        {!entryId && <SubmitButton className="btn btn-secondary" name="next" value="another">Save and add another</SubmitButton>}
        <Link href={`/patients/${patientId}#paper-history`} className="btn btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
