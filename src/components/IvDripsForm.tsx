"use client";

import { useActionState } from "react";
import { ivDripAction, type DripState } from "@/app/actions/settings";
import { SubmitButton } from "./SubmitButton";

// The list of IV drips practitioners choose from, with add and remove.
export function IvDripsForm({ drips }: { drips: string[] }) {
  const [state, action] = useActionState<DripState, FormData>(ivDripAction, {});
  return (
    <section className="card space-y-4" aria-labelledby="drips-heading">
      <h2 id="drips-heading" className="section-title">IV drips</h2>
      <p className="muted">Practitioners choose the drip from this list. Removing a drip only hides it from new cases; past cases keep it.</p>
      {state.message && <div className="alert alert-success" role="status">{state.message}</div>}
      {state.error && <div className="alert alert-error" role="alert">{state.error}</div>}
      <ul className="divide-y divide-line border-y border-line">
        {drips.map((d) => (
          <li key={d} className="flex items-center justify-between gap-4 py-2">
            <span className="font-bold">{d}</span>
            <form action={action}>
              <input type="hidden" name="intent" value="remove" />
              <input type="hidden" name="drip" value={d} />
              <button type="submit" className="btn btn-danger" aria-label={`Remove ${d}`}>Remove</button>
            </form>
          </li>
        ))}
      </ul>
      <form action={action} className="flex flex-wrap items-end gap-3">
        <label className="field grow" htmlFor="drip">
          <span className="label">Add a drip</span>
          {/* Cleared after each successful add. */}
          <input key={state.message ? state.seq : "drip"} id="drip" name="drip" className="input" maxLength={60} autoComplete="off" />
        </label>
        <SubmitButton className="btn btn-secondary" pendingText="Adding…">Add drip</SubmitButton>
      </form>
    </section>
  );
}
