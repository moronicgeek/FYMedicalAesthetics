"use client";

import { useActionState } from "react";
import { ivDripAction, type DripState } from "@/app/actions/settings";
import type { IvDrip } from "@/lib/settings";
import { SubmitButton } from "./SubmitButton";

// The IV drips clients and practitioners choose from: add, edit the
// description shown on the client's check-in card, or remove.
export function IvDripsForm({ drips }: { drips: IvDrip[] }) {
  const [state, action] = useActionState<DripState, FormData>(ivDripAction, {});
  return (
    <section className="card space-y-4" aria-labelledby="drips-heading">
      <h2 id="drips-heading" className="section-title">IV drips</h2>
      <p className="muted">
        Clients tap a drip at check-in and practitioners choose from the same list. The description is shown on the client&rsquo;s card. Removing a drip only
        hides it from new cases; past cases keep it.
      </p>
      {state.message && <div className="alert alert-success" role="status">{state.message}</div>}
      {state.error && <div className="alert alert-error" role="alert">{state.error}</div>}
      <ul className="divide-y divide-line border-y border-line">
        {drips.map((d, i) => (
          <li key={d.name} className="py-4">
            <form action={action} className="space-y-2">
              <input type="hidden" name="drip" value={d.name} />
              <label className="field" htmlFor={`drip-desc-${i}`}>
                <span className="label">{d.name}</span>
                <textarea id={`drip-desc-${i}`} name="description" className="input" style={{ minHeight: "4.5rem" }} maxLength={200} defaultValue={d.description} aria-label={`${d.name} description`} />
              </label>
              <div className="flex flex-wrap justify-between gap-3">
                <SubmitButton name="intent" value="update" className="btn btn-secondary" pendingText="Saving…">Save description</SubmitButton>
                <button type="submit" name="intent" value="remove" className="btn btn-danger" aria-label={`Remove ${d.name}`}>Remove</button>
              </div>
            </form>
          </li>
        ))}
      </ul>
      {/* Cleared after each successful add. */}
      <form key={state.message ? state.seq : "add"} action={action} className="space-y-3">
        <h3 className="font-bold">Add a drip</h3>
        <label className="field" htmlFor="drip">
          <span className="label">Name</span>
          <input id="drip" name="drip" className="input" maxLength={60} autoComplete="off" />
        </label>
        <label className="field" htmlFor="drip-description">
          <span className="label">Description <span className="font-normal text-muted">(optional)</span></span>
          <span className="hint">One or two sentences for the client&rsquo;s card</span>
          <textarea id="drip-description" name="description" className="input" style={{ minHeight: "4.5rem" }} maxLength={200} />
        </label>
        <SubmitButton name="intent" value="add" className="btn btn-secondary" pendingText="Adding…">Add drip</SubmitButton>
      </form>
    </section>
  );
}
