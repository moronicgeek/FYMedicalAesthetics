import { requireUser } from "@/lib/auth";
import { handCheckInToClientAction } from "@/app/actions/cases";
import { CheckInForm } from "@/components/CheckInForm";

export const metadata = { title: "Check in a client" };

export default async function CheckInPage() {
  const user = await requireUser();
  // Practitioners only see IV drip clients, so they don't hand over the
  // tablet: a client could choose an injection or laser there.
  const tablet = user.role !== "PRACTITIONER";
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="page-title">Check in a client</h1>
        <p className="muted">IV drip clients join the waiting list for a practitioner. Injection and laser clients go on to fill in their consent form for the doctor.</p>
      </div>
      {tablet && (
        <section className="card space-y-3" aria-labelledby="tablet-heading">
          <h2 id="tablet-heading" className="section-title">Let the client check in</h2>
          <p>The tablet locks to the check-in screen. The client enters their details and treatment. IV drip clients are then checked in; injection and laser clients go straight on to their consent form.</p>
          <form action={handCheckInToClientAction}>
            <button type="submit" className="btn btn-primary btn-lg">Hand tablet to client</button>
          </form>
        </section>
      )}
      <section className="card space-y-3" aria-labelledby={tablet ? "desk-heading" : undefined}>
        {tablet && <h2 id="desk-heading" className="section-title">Or enter the details yourself</h2>}
        <CheckInForm canStartIv={user.role !== "RECEPTION"} ivOnly={user.role === "PRACTITIONER"} />
      </section>
    </div>
  );
}
