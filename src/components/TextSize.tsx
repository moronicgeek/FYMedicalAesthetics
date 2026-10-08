"use client";

import { useEffect, useState } from "react";

const SIZES = [
  { value: "normal", label: "A", name: "Normal text size" },
  { value: "large", label: "A+", name: "Large text size" },
  { value: "xlarge", label: "A++", name: "Extra large text size" },
] as const;

export function TextSize() {
  const [size, setSize] = useState<string>("normal");

  useEffect(() => {
    setSize(document.documentElement.dataset.text || "normal");
  }, []);

  function choose(value: string) {
    setSize(value);
    document.documentElement.dataset.text = value;
    document.cookie = `fy_text=${value}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div role="group" aria-label="Text size" className="flex items-center gap-1">
      {SIZES.map((s, i) => (
        <button
          key={s.value}
          type="button"
          onClick={() => choose(s.value)}
          aria-pressed={size === s.value}
          aria-label={s.name}
          className={`min-h-11 min-w-11 rounded-lg border-2 px-2 font-bold ${
            size === s.value ? "border-brand bg-brand text-white" : "border-line bg-white text-brand-dark hover:bg-brand-soft"
          }`}
          style={{ fontSize: `${0.9 + i * 0.15}rem` }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
