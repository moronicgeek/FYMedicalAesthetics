import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppointmentList } from "@/components/AppointmentList";
import { AutoRefresh } from "@/components/AutoRefresh";
import { DoctorQueue, WaitingList, waitingForDoctor } from "@/components/WaitingList";
import { db } from "@/lib/db";
import { caseStatusLabel, decryptCase, OPEN_STATUSES } from "@/lib/cases";
import { CONSENT_FORMS } from "@/lib/consent-forms";
import { listAppointments } from "@/lib/queries";
import { clinicDateString, clinicDayRange, formatDate } from "@/lib/time";

export const metadata = { title: "Today" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;
  const today = clinicDateString();
  const { start, end } = clinicDayRange(today);
  const items = await listAppointments(user, {
    startsAt: { gte: start, lt: end },
    ...(user.role === "DOCTOR" ? { doctorId: user.id } : {}),
  });
  const allOpen = (await db.treatmentCase.findMany({ where: { status: { in: OPEN_STATUSES } }, orderBy: { createdAt: "asc" } })).map(decryptCase);
  const waitingCases = allOpen.filter((c) => c.status === "QUEUED");
  const doctorCases = allOpen.filter(waitingForDoctor);
  const openCases = allOpen.filter((c) => c.status !== "QUEUED" && !waitingForDoctor(c));
  const active = items.filter((a) => a.status !== "CANCELLED");
  const completed = items.filter((a) => a.status === "COMPLETED").length;

  return (
    <div className="space-y-8">
      <AutoRefresh seconds={15} />
      {denied && <div className="alert alert-error" role="alert">You don&rsquo;t have access to that page.</div>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="muted">{formatDate(new Date())}</p>
          <h1 className="page-title">Good day, {user.name.split(" ")[0]}</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/checkin" className="btn btn-primary">Check in a client</Link>
          <Link href="/intake" className="btn btn-secondary">New patient</Link>
          <Link href="/appointments/new" className="btn btn-secondary">Book appointment</Link>
        </div>
      </div>

      <dl className="grid gap-4 sm:grid-cols-4">
        {[
          { label: user.role === "DOCTOR" ? "Your appointments today" : "Appointments today", value: active.length },
          { label: "Waiting for a practitioner", value: waitingCases.length },
          { label: "Treatments in progress", value: openCases.length },
          { label: "Completed", value: completed },
        ].map((s) => (
          <div key={s.label} className="card">
            <dt className="muted">{s.label}</dt>
            <dd className="text-4xl font-bold text-brand-dark">{s.value}</dd>
          </div>
        ))}
      </dl>

      <WaitingList cases={waitingCases} role={user.role} />
      <DoctorQueue cases={doctorCases} />

      {openCases.length > 0 && (
        <section className="card" aria-labelledby="cases-heading">
          <h2 id="cases-heading" className="section-title mb-2">Treatments in progress</h2>
          <ul className="divide-y divide-line">
            {openCases.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/cases/${c.id}`} className="font-bold text-brand-dark underline underline-offset-4">
                    {c.consent.patient.firstName} {c.consent.patient.lastName}
                  </Link>
                  <p className="muted">{CONSENT_FORMS[c.type].shortName} · #{c.code}</p>
                </div>
                <span className={`badge ${["REFERRED", "DECLINED"].includes(c.status) ? "bg-danger-soft text-danger" : ["AWAITING_DOCTOR", "AWAITING_SIGNATURE"].includes(c.status) ? "badge-CHECKED_IN" : "badge-BOOKED"}`}>
                  {caseStatusLabel(c)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card" aria-labelledby="today-heading">
        <h2 id="today-heading" className="section-title mb-2">Today&rsquo;s schedule</h2>
        <AppointmentList items={items} emptyText="No appointments booked for today." />
      </section>
    </div>
  );
}
