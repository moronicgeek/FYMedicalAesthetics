import type { ConsentFormDef } from "@/lib/consent-forms";

// The treatment tick boxes and "Other" box from a consent form. Field names
// match what parseTreatment reads on the server.
export function TreatmentChoice({ choice, values, error }: { choice: NonNullable<ConsentFormDef["treatmentChoice"]>; values: Record<string, string>; error?: string }) {
  return (
    <div className="field">
      <span className="label">{choice.label}</span>
      {error && <span className="error-text">{error}</span>}
      {choice.options.length > 0 && (
        <div className="flex flex-wrap gap-x-6">
          {choice.options.map((o) => (
            <label key={o} className="choice">
              <input type="checkbox" name={`treatment_${o}`} defaultChecked={values[`treatment_${o}`] === "on"} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      )}
      {choice.freeText && (
        <input
          name="treatmentOther"
          className="input"
          aria-label={choice.options.length ? "Other treatment" : choice.label}
          placeholder={choice.options.length ? "Other (please describe)" : ""}
          defaultValue={values.treatmentOther}
        />
      )}
    </div>
  );
}
