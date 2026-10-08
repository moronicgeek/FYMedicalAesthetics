export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3">
      <svg aria-hidden="true" width="40" height="40" viewBox="0 0 40 40">
        <rect width="40" height="40" rx="10" fill="#0b6e75" />
        <path d="M17 9h6v8h8v6h-8v8h-6v-8H9v-6h8z" fill="#fff" />
      </svg>
      <span className="leading-tight">
        <span className="block text-lg font-bold text-brand-dark">FY Medical Aesthetics</span>
        {!compact && <span className="block text-sm text-muted">Patient care portal</span>}
      </span>
    </span>
  );
}
