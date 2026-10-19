"use client";

import { useId, useState } from "react";
import { NO_PASSWORD_MANAGER } from "./no-autofill";

// A dropdown you can type into to filter, for lists too long to scroll. Only a
// value from `options` is submitted; typed text that matches none submits "".
export function SearchableSelect({
  name,
  label,
  options,
  defaultValue = "",
  error,
  hint = "Start typing to search, or pick from the list.",
}: {
  name: string;
  label: string;
  options: string[];
  defaultValue?: string;
  error?: string;
  hint?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const match = (text: string) => options.find((o) => o.toLowerCase() === text.trim().toLowerCase()) ?? "";
  const [query, setQuery] = useState(defaultValue);
  const [value, setValue] = useState(match(defaultValue));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const q = query.trim().toLowerCase();
  const shown = q && query !== value ? options.filter((o) => o.toLowerCase().includes(q)) : options;

  function choose(o: string) {
    setValue(o);
    setQuery(o);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((a) => Math.min(a + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && open) {
      // Picks the highlighted option instead of submitting the form.
      e.preventDefault();
      if (shown[active]) choose(shown[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="field">
      <label htmlFor={id} className="label">
        {label} <span className="text-danger" aria-hidden="true">*</span>
      </label>
      <span id={`${id}-hint`} className="hint">{hint}</span>
      {error && <span id={`${id}-error`} className="error-text">{error}</span>}
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          className="input pr-12"
          autoComplete="off"
          {...NO_PASSWORD_MANAGER}
          value={query}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? `${id}-opt-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={[`${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ")}
          onChange={(e) => {
            setQuery(e.target.value);
            setValue(match(e.target.value));
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-muted">▾</span>
        {open && (
          <ul id={listId} role="listbox" aria-label={label} className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded border-2 border-field bg-white shadow-lg">
            {shown.length === 0 && <li className="px-4 py-3 text-muted">Nothing matches &ldquo;{query.trim()}&rdquo;</li>}
            {shown.map((o, i) => (
              <li
                key={o}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={o === value}
                className={`cursor-pointer px-4 py-3 ${i === active ? "bg-brand-soft" : ""} ${o === value ? "font-bold" : ""}`}
                // Keeps focus in the box so the click lands before it closes.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o)}
              >
                {o}
              </li>
            ))}
          </ul>
        )}
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
