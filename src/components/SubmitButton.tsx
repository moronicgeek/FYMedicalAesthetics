"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "btn btn-primary", pendingText = "Saving…", name, value }: { children: React.ReactNode; className?: string; pendingText?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending} name={name} value={value}>
      {pending ? pendingText : children}
    </button>
  );
}
