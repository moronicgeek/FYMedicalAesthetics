import Image from "next/image";

// The clinic's circular "fy" logo. Its own lettering is too small to read at
// header size, so the name is repeated beside it.
export function Logo({ compact = false }: { compact?: boolean }) {
  const size = compact ? 52 : 64;
  return (
    <span className="inline-flex items-center gap-3">
      <Image src="/logo.png" alt="" width={size} height={Math.round((size * 449) / 480)} priority />
      <span className="leading-tight">
        <span className="brand-name block">FY Medical Aesthetics</span>
        {!compact && <span className="block text-sm text-muted">Patient care portal</span>}
      </span>
    </span>
  );
}

export function LogoMark({ size = 168 }: { size?: number }) {
  return <Image src="/logo.png" alt="FY Medical Aesthetics" width={size} height={Math.round((size * 449) / 480)} priority className="mx-auto" />;
}
