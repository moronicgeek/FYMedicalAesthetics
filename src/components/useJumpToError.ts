"use client";

import { useEffect, useRef } from "react";

type ActionResult = { errors?: Record<string, string>; error?: string };

const FIELD_ERROR = '[aria-invalid="true"], .error-text';
const FOCUSABLE = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';

// After a failed submit, take the user to the first problem instead of
// leaving the message off-screen above the button they just pressed. Pass the
// useActionState result and put the returned ref on the form (or a wrapper
// around several forms).
export function useJumpToError<E extends HTMLElement = HTMLFormElement>(state: ActionResult) {
  const ref = useRef<E>(null);
  const failed = Boolean(state.error) || Object.keys(state.errors ?? {}).length > 0;

  useEffect(() => {
    if (failed && ref.current) jumpToError(ref.current);
    // A new state object arrives after every submit, so a repeated mistake
    // jumps again.
  }, [state, failed]);

  return ref;
}

export function jumpToError(root: HTMLElement) {
  const fieldError = [...root.querySelectorAll<HTMLElement>(FIELD_ERROR)].find(
    (el) => el.getAttribute("aria-invalid") === "true" || el.textContent?.trim(),
  );
  const target = fieldError ?? root.querySelector<HTMLElement>(".alert-error");
  if (!target) return;

  // Show the whole field (label and message), then put the cursor in it.
  const box = target.closest<HTMLElement>(".field, fieldset, tr") ?? target;
  const control = target.matches(FOCUSABLE) ? target : box.querySelector<HTMLElement>(FOCUSABLE);
  const focusTarget = control ?? target;
  if (!control) focusTarget.tabIndex = -1;

  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  box.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
  focusTarget.focus({ preventScroll: true });
}
