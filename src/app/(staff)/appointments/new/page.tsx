import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { BookingForm } from "@/components/BookingForm";
import { listDoctors } from "@/lib/queries";
import { searchPatients } from "@/lib/patients";
import { clinicDateString } from "@/lib/time";
import { servicesFor } from "@/lib/validation";

export const metadata = { title: "Book appointment" };

export default async function NewAppointment({ searchParams }: { searchParams: Promise<{ patientId?: string }> }) {
  const user = await requireUser();
  const { patientId } = await searchParams;
  const [patients, doctors] = await Promise.all([searchPatients("", 5000), listDoctors()]);
  const patientOptions = patients
    .map((p) => ({ value: p.id, label: `${p.lastName}, ${p.firstName} (born ${p.dateOfBirth})` }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="page-title">Book an appointment</h1>
      {doctors.length === 0 && (
        <div className="alert alert-info">
          No doctors have been added yet. An administrator can add them on the <Link href="/staff" className="underline">Staff</Link> page.
        </div>
      )}
      <BookingForm
        patients={patientOptions}
        doctors={doctors.map((d) => ({ value: d.id, label: d.name }))}
        services={servicesFor(user.role)}
        initial={{ patientId: patientId ?? "" }}
        today={clinicDateString()}
      />
    </div>
  );
}
