import type { ReactNode } from "react";

type Common = { name: string; label: string; hint?: string; error?: string; required?: boolean; defaultValue?: string };

function describedBy(name: string, hint?: string, error?: string) {
  return [hint && `${name}-hint`, error && `${name}-error`].filter(Boolean).join(" ") || undefined;
}

function Meta({ name, hint, error }: { name: string; hint?: string; error?: string }) {
  return (
    <>
      {hint && <span id={`${name}-hint`} className="hint">{hint}</span>}
      {error && <span id={`${name}-error`} className="error-text">{error}</span>}
    </>
  );
}

function LabelText({ label, required }: { label: string; required?: boolean }) {
  return (
    <span className="label">
      {label} {required ? <span className="text-danger" aria-hidden="true">*</span> : <span className="font-normal text-muted">(optional)</span>}
    </span>
  );
}

export function TextField({ name, label, hint, error, required, defaultValue, type = "text", autoComplete, inputMode, max }: Common & { type?: string; autoComplete?: string; inputMode?: "text" | "tel" | "email" | "numeric"; max?: string }) {
  return (
    <label className="field" htmlFor={name}>
      <LabelText label={label} required={required} />
      <Meta name={name} hint={hint} error={error} />
      <input
        id={name}
        name={name}
        type={type}
        className="input"
        defaultValue={defaultValue}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        max={max}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
      />
    </label>
  );
}

export function TextArea({ name, label, hint, error, required, defaultValue }: Common) {
  return (
    <label className="field" htmlFor={name}>
      <LabelText label={label} required={required} />
      <Meta name={name} hint={hint} error={error} />
      <textarea id={name} name={name} className="input" defaultValue={defaultValue} required={required} aria-invalid={error ? true : undefined} aria-describedby={describedBy(name, hint, error)} />
    </label>
  );
}

export function SelectField({ name, label, hint, error, required, defaultValue, options, placeholder }: Common & { options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <label className="field" htmlFor={name}>
      <LabelText label={label} required={required} />
      <Meta name={name} hint={hint} error={error} />
      <select id={name} name={name} className="input" defaultValue={defaultValue ?? ""} required={required} aria-invalid={error ? true : undefined} aria-describedby={describedBy(name, hint, error)}>
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function RadioGroup({ name, label, hint, error, required, defaultValue, options }: Common & { options: { value: string; label: string }[] }) {
  return (
    <fieldset className="field" aria-describedby={describedBy(name, hint, error)}>
      <legend className="mb-1"><LabelText label={label} required={required} /></legend>
      <Meta name={name} hint={hint} error={error} />
      <div className="flex flex-wrap gap-x-6">
        {options.map((o) => (
          <label key={o.value} className="choice">
            <input type="radio" name={name} value={o.value} defaultChecked={defaultValue === o.value} required={required} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Checkbox({ name, label, error, defaultChecked, required }: { name: string; label: ReactNode; error?: string; defaultChecked?: boolean; required?: boolean }) {
  return (
    <div className="field">
      <label className="choice">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} required={required} aria-invalid={error ? true : undefined} aria-describedby={error ? `${name}-error` : undefined} />
        <span>{label}</span>
      </label>
      {error && <span id={`${name}-error`} className="error-text">{error}</span>}
    </div>
  );
}

export function FormErrors({ errors }: { errors?: Record<string, string> }) {
  if (!errors || Object.keys(errors).length === 0) return null;
  return (
    <div className="alert alert-error" role="alert" tabIndex={-1}>
      <p className="font-bold">Please check the highlighted fields.</p>
      {errors.form && <p>{errors.form}</p>}
    </div>
  );
}
