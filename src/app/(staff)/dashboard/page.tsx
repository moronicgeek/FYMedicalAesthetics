import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { startKioskAction } from "@/app/actions/kiosk";
import { AppointmentList } from "@/components/AppointmentList";
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
  const active = items.filter((a) => a.status !== "CANCELLED");
  const waiting = items.filter((a) => a.status === "CHECKED_IN").length;
  const done = items.filter((a) => a.status === "COMPLETED").length;

  return (
    <div className="space-y-8">
      {denied && <div className="alert alert-error" role="alert">You don&rsquo;t have access to that page.</div>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="muted">{formatDate(new Date())}</p>
          <h1 className="page-title">Good day, {user.name.split(" ")[0]}</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <form action={startKioskAction}>
            <button type="submit" className="btn btn-secondary">Hand device to patient</button>
          </form>
          <Link href="/intake" className="btn btn-secondary">New patient</Link>
          <Link href="/appointments/new" className="btn btn-primary">Book appointment</Link>
        </div>
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          { label: user.role === "DOCTOR" ? "Your appointments today" : "Appointments today", value: active.length },
          { label: "Arrived and waiting", value: waiting },
          { label: "Completed", value: done },
        ].map((s) => (
          <div key={s.label} className="card">
            <dt className="muted">{s.label}</dt>
            <dd className="text-4xl font-bold text-brand-dark">{s.value}</dd>
          </div>
        ))}
      </dl>

      <section className="card" aria-labelledby="today-heading">
        <h2 id="today-heading" className="section-title mb-2">Today&rsquo;s schedule</h2>
        <AppointmentList items={items} emptyText="No appointments booked for today." />
      </section>
    </div>
  );
}
