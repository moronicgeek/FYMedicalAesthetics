import type { IvDrip } from "@/lib/settings";

// Tap-to-choose cards for the client's IV drip at check-in. Choosing is
// optional: "Not sure" leaves it to the practitioner.
export function DripCards({ drips, defaultValue = "", error, forClient = true }: { drips: IvDrip[]; defaultValue?: string; error?: string; forClient?: boolean }) {
  const options = [...drips, { name: "", description: forClient ? "Your practitioner will help you choose." : "The practitioner will choose with the client." }];
  return (
    <fieldset className="field" aria-describedby={error ? "drip-error" : undefined}>
      <legend className="mb-1">
        <span className="label">{forClient ? "Which drip would you like?" : "Drip the client would like"}</span> <span className="font-normal text-muted">(optional)</span>
      </legend>
      <span className="hint">{forClient ? "Tap one. Your practitioner will check it with you." : "The practitioner can change it later."}</span>
      {error && <span id="drip-error" className="error-text">{error}</span>}
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {options.map((d) => (
          <label
            key={d.name || "unsure"}
            className="relative flex cursor-pointer flex-col gap-1 rounded border-2 border-line bg-white p-4 pr-12 hover:border-field has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-dark"
          >
            <input type="radio" name="drip" value={d.name} defaultChecked={defaultValue === d.name} className="peer sr-only" />
            <span className="text-lg font-bold">{d.name || "Not sure"}</span>
            {d.description && <span className="text-muted">{d.description}</span>}
            <span
              aria-hidden="true"
              className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full border-2 border-field text-sm text-white peer-checked:border-brand peer-checked:bg-brand"
            >
              ✓
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
