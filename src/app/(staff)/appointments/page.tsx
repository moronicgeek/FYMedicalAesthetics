import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppointmentList } from "@/components/AppointmentList";
import { listAppointments, listDoctors } from "@/lib/queries";
import { clinicDateString, clinicDayRange, formatDate } from "@/lib/time";

export const metadata = { title: "Appointments" };

function shift(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ date?: string; doctor?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : clinicDateString();
  const doctorId = params.doctor ?? (user.role === "DOCTOR" ? user.id : "");
  const { start, end } = clinicDayRange(date);
  const [items, doctors] = await Promise.all([
    listAppointments(user, { startsAt: { gte: start, lt: end }, ...(doctorId ? { doctorId } : {}) }),
    listDoctors(),
  ]);
  const qs = (d: string) => `?date=${d}${doctorId ? `&doctor=${doctorId}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="page-title">Appointments</h1>
        <Link href="/appointments/new" className="btn btn-primary">Book appointment</Link>
      </div>

      <form className="card flex flex-col gap-4 md:flex-row md:items-end">
        <label className="field" htmlFor="date">
          <span className="label">Date</span>
          <input id="date" name="date" type="date" className="input" defaultValue={date} />
        </label>
        <label className="field md:min-w-64" htmlFor="doctor">
          <span className="label">Doctor</span>
          <select id="doctor" name="doctor" className="input" defaultValue={doctorId}>
            <option value="">All doctors</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <button type="submit" className="btn btn-primary">Show</button>
      </form>

      <section className="card" aria-labelledby="day-heading">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 id="day-heading" className="section-title">{formatDate(clinicDayRange(date).start)}</h2>
          <div className="flex gap-2">
            <Link className="btn btn-secondary" href={qs(shift(date, -1))}>Previous day</Link>
            <Link className="btn btn-secondary" href={qs(clinicDateString())}>Today</Link>
            <Link className="btn btn-secondary" href={qs(shift(date, 1))}>Next day</Link>
          </div>
        </div>
        <AppointmentList items={items} emptyText="No appointments on this day." />
      </section>
    </div>
  );
}
