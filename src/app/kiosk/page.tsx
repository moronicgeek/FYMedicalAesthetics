import Link from "next/link";
import { CASE_TYPES, CONSENT_FORMS } from "@/lib/consent-forms";

export const metadata = { title: "Patient check-in" };

const DESCRIPTIONS = {
  IV_DRIP: "Vitamin and hydration drips",
  AESTHETICS: "Botox, dermal fillers, chemical peels or microneedling",
  LASER: "Laser hair removal or skin rejuvenation",
} as const;

export default function KioskPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Welcome to FY Medical Aesthetics</h1>
        <p className="muted mt-2 text-lg">Please choose the treatment you are here for today. You can make the text bigger with the A+ buttons at the top.</p>
      </div>
      <ul className="grid gap-4">
        {CASE_TYPES.map((t) => (
          <li key={t}>
            <Link href={`/kiosk/consent/${t.toLowerCase()}`} className="card flex items-center justify-between gap-4 no-underline transition hover:border-brand hover:bg-brand-soft">
              <span>
                <span className="block text-xl font-bold text-brand-dark">{CONSENT_FORMS[t].shortName}</span>
                <span className="muted block">{DESCRIPTIONS[t]}</span>
              </span>
              <span aria-hidden="true" className="text-3xl text-brand">›</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="muted">Here for a consultation or something else? <Link href="/kiosk/register" className="underline">Register your details</Link>.</p>
    </div>
  );
}
