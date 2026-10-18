import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { BookingForm } from "@/components/BookingForm";
import { listDoctors } from "@/lib/queries";
import { canSeePatient, getPatient, searchPatients } from "@/lib/patients";
import { clinicDateString } from "@/lib/time";
import { servicesFor } from "@/lib/access";

export const metadata = { title: "Book appointment" };

const label = (p: { firstName: string; lastName: string; dateOfBirth: string }) => `${p.lastName}, ${p.firstName} (born ${p.dateOfBirth})`;

// Staff find the patient first, then book. Only the patients matching the
// search are sent to the browser, never the whole patient list.
export default async function NewAppointment({ searchParams }: { searchParams: Promise<{ patientId?: string; q?: string }> }) {
  const user = await requireUser();
  const { patientId, q = "" } = await searchParams;
  const found = patientId && (await canSeePatient(user.role, patientId)) ? await getPatient(patientId) : null;
  const [matches, doctors] = await Promise.all([!found && q.trim() ? searchPatients(q, user.role, 20) : [], listDoctors()]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="page-title">Book an appointment</h1>
      {doctors.length === 0 && (
        <div className="alert alert-info">
          No doctors have been added yet. An administrator can add them on the <Link href="/staff" className="underline">Staff</Link> page.
        </div>
      )}
      {found ? (
        <BookingForm
          patient={{ value: found.id, label: label(found) }}
          doctors={doctors.map((d) => ({ value: d.id, label: d.name }))}
          services={servicesFor(user.role)}
          today={clinicDateString()}
        />
      ) : (
        <>
          <form role="search" className="card flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="field flex-1" htmlFor="q">
              <span className="label">Find the patient</span>
              <span className="hint">Search by name, mobile number, email or ID number</span>
              <input id="q" name="q" type="search" className="input" defaultValue={q} required />
            </label>
            <button type="submit" className="btn btn-primary">Search</button>
          </form>
          {q.trim() && (
            <section className="card" aria-live="polite">
              {matches.length === 0 ? (
                <p className="muted">No patients match &ldquo;{q}&rdquo;. <Link href="/intake" className="underline">Add a new patient</Link></p>
              ) : (
                <ul className="divide-y divide-line">
                  {matches.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <span className="font-bold">{label(p)}</span>
                      <Link href={`/appointments/new?patientId=${p.id}`} className="btn btn-secondary">Book for this patient</Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
