import Image from "next/image";

// The Lumiere Clinic wordmark (public/logo.png, 537 x 156), cut from the
// clinic's logo with a transparent background.
const W = 537;
const H = 156;

export function Logo({ compact = false }: { compact?: boolean }) {
  const height = compact ? 52 : 60;
  return (
    <span className="inline-flex items-center gap-4">
      <Image src="/logo.png" alt="Lumiere Clinic" width={Math.round((height * W) / H)} height={height} priority />
      {!compact && <span className="border-l border-line pl-4 text-sm text-muted">Patient care portal</span>}
    </span>
  );
}

export function LogoMark({ width = 300 }: { width?: number }) {
  return <Image src="/logo.png" alt="Lumiere Clinic" width={width} height={Math.round((width * H) / W)} priority className="mx-auto" />;
}
