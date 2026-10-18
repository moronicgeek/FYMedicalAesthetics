import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { removePasskeyAction } from "@/app/actions/passkeys";
import { AddFingerprint } from "@/components/Passkey";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await requireUser();
  const passkeys = await db.passkey.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, select: { id: true, deviceName: true, createdAt: true, lastUsedAt: true } });
  return (
    <div className="space-y-6">
      <h1 className="page-title">My account</h1>
      <section className="card space-y-4" aria-labelledby="fingerprint-heading">
        <h2 id="fingerprint-heading" className="section-title">Fingerprint sign-in</h2>
        <p className="muted">
          Sign in on this device with your fingerprint (or face) instead of typing your password. Set it up once on each device you use, such as the
          reception tablet. Your fingerprint stays on the device; the clinic never receives it.
        </p>
        <AddFingerprint />
      </section>
      <section className="card" aria-labelledby="devices-heading">
        <h2 id="devices-heading" className="section-title mb-2">Devices you can sign in on with your fingerprint</h2>
        {passkeys.length === 0 ? (
          <p className="muted">None yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {passkeys.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-bold">{p.deviceName}</p>
                  <p className="muted">Added {formatDateTime(p.createdAt)} · {p.lastUsedAt ? `last used ${formatDateTime(p.lastUsedAt)}` : "not used yet"}</p>
                </div>
                <form action={removePasskeyAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className="btn btn-danger">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
