import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { searchPatients } from "@/lib/patients";
import { ageFrom } from "@/lib/time";

export const metadata = { title: "Patients" };

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q = "" } = await searchParams;
  const patients = await searchPatients(q);
  await audit(user, q ? "search" : "list", "Patient");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="page-title">Patients</h1>
        <Link href="/intake" className="btn btn-primary">Add a new patient</Link>
      </div>
      <form role="search" className="card flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="field flex-1" htmlFor="q">
          <span className="label">Find a patient</span>
          <span className="hint">Search by name, mobile number, email or ID number</span>
          <input id="q" name="q" type="search" className="input" defaultValue={q} />
        </label>
        <button type="submit" className="btn btn-primary">Search</button>
      </form>
      <section className="card overflow-x-auto" aria-live="polite">
        {patients.length === 0 ? (
          <p className="muted">{q ? `No patients match "${q}".` : "No patients yet."}</p>
        ) : (
          <table className="table">
            <caption className="sr-only">Patients</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Age</th>
                <th scope="col">Mobile</th>
                <th scope="col">Registered</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/patients/${p.id}`}>{p.firstName} {p.lastName}</Link></td>
                  <td>{ageFrom(p.dateOfBirth)}</td>
                  <td>{p.phone}</td>
                  <td>{p.createdAt.toLocaleDateString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
