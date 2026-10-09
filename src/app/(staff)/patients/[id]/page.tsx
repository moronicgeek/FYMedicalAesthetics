import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getIdPhoto } from "@/lib/cases";
import { getPatient } from "@/lib/patients";
import { listAppointments } from "@/lib/queries";
import { AppointmentList } from "@/components/AppointmentList";
import { ageFrom, formatDateTime } from "@/lib/time";

export const metadata = { title: "Patient record" };

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-3">
      <dt className="font-bold">{label}</dt>
      <dd className="sm:col-span-2 whitespace-pre-wrap">{value || <span className="muted">Not given</span>}</dd>
    </div>
  );
}

const YES_NO: Record<string, string> = { yes: "Yes", no: "No", na: "Not applicable" };
const CONTACT: Record<string, string> = { whatsapp: "WhatsApp", email: "Email", both: "WhatsApp and email" };

export default async function PatientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; booked?: string; notified?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const flags = await searchParams;
  const patient = await getPatient(id);
  if (!patient) notFound();
  await audit(user, "view", "Patient", id);

  const now = new Date();
  const [upcoming, past, idPhoto] = await Promise.all([
    listAppointments(user, { patientId: id, startsAt: { gte: new Date(now.getTime() - 12 * 3_600_000) } }),
    listAppointments(user, { patientId: id, startsAt: { lt: new Date(now.getTime() - 12 * 3_600_000) } }, "desc"),
    getIdPhoto(id),
  ]);
  const m = patient.medical;
  const hasAlerts = [m.allergies, m.conditions].some((v) => v && !/^none$/i.test(v.trim())) || m.pregnantOrBreastfeeding === "yes";

  return (
    <div className="space-y-6">
      {flags.saved && <div className="alert alert-success" role="status">Patient details saved.</div>}
      {flags.booked && (
        <div className="alert alert-success" role="status">
          Appointment booked.{" "}
          {flags.notified === "1" ? "The patient and doctor have been notified." : "No confirmation was sent. Check the messaging settings, or tell the patient directly."}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="muted"><Link href="/patients" className="underline">Patients</Link> / Record</p>
          <h1 className="page-title">{patient.firstName} {patient.lastName}</h1>
          <p className="muted">
            {ageFrom(patient.dateOfBirth)} years · Born {new Date(patient.dateOfBirth).toLocaleDateString("en-GB", { timeZone: "UTC" })}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="btn btn-secondary" href={`/patients/${id}/edit`}>Edit details</Link>
          <Link className="btn btn-primary" href={`/appointments/new?patientId=${id}`}>Book appointment</Link>
        </div>
      </div>

      {hasAlerts && (
        <div className="alert alert-error" role="note">
          <p className="font-bold">Clinical alerts</p>
          {m.allergies && !/^none$/i.test(m.allergies.trim()) && <p>Allergies: {m.allergies}</p>}
          {m.conditions && !/^none$/i.test(m.conditions.trim()) && <p>Conditions: {m.conditions}</p>}
          {m.pregnantOrBreastfeeding === "yes" && <p>Pregnant or breastfeeding</p>}
        </div>
      )}

      <section className="card" aria-labelledby="appts-heading">
        <h2 id="appts-heading" className="section-title mb-2">Upcoming appointments</h2>
        <AppointmentList items={upcoming} showDate showPatient={false} emptyText="No upcoming appointments." />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card" aria-labelledby="contact-heading">
          <h2 id="contact-heading" className="section-title mb-2">Contact</h2>
          <dl className="divide-y divide-line">
            <Row label="Preferred name" value={patient.preferredName} />
            <Row label="Mobile" value={patient.phone} />
            <Row label="Email" value={patient.email} />
            <Row label="Reminders by" value={CONTACT[patient.contactPreference]} />
            <Row label="Address" value={patient.address} />
            <Row label="ID / passport" value={patient.idNumber} />
            <Row label="Gender" value={patient.gender} />
            <Row
              label="Emergency contact"
              value={patient.emergencyContact ? [patient.emergencyContact.name, patient.emergencyContact.relationship, patient.emergencyContact.phone].filter(Boolean).join(" · ") : undefined}
            />
          </dl>
        </section>

        <section className="card" aria-labelledby="medical-heading">
          <h2 id="medical-heading" className="section-title mb-2">Medical history</h2>
          <dl className="divide-y divide-line">
            <Row label="Conditions" value={m.conditions} />
            <Row label="Medicines" value={m.medications} />
            <Row label="Allergies" value={m.allergies} />
            <Row label="Previous treatments" value={m.previousTreatments} />
            <Row label="Pregnant or breastfeeding" value={YES_NO[m.pregnantOrBreastfeeding]} />
            <Row label="Smoker" value={YES_NO[m.smoker]} />
            <Row label="Looking for help with" value={patient.treatmentInterest} />
          </dl>
        </section>
      </div>

      <section className="card" aria-labelledby="past-heading">
        <h2 id="past-heading" className="section-title mb-2">Past appointments</h2>
        <AppointmentList items={past} showDate showPatient={false} emptyText="No past appointments." />
      </section>

      {idPhoto && (
        <section className="card" aria-labelledby="id-heading">
          <h2 id="id-heading" className="section-title mb-2">ID document</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={idPhoto} alt={`Photo of ${patient.firstName} ${patient.lastName}'s ID document`} className="max-h-72 rounded-lg border border-line bg-white" />
        </section>
      )}

      <section className="card" aria-labelledby="consent-heading">
        <h2 id="consent-heading" className="section-title mb-2">Consent</h2>
        <p>
          Signed by <strong>{patient.consent.signedName}</strong> on {formatDateTime(new Date(patient.consent.signedAt))}.
          {" "}Marketing: {patient.consent.marketing ? "agreed" : "declined"}.
        </p>
      </section>
    </div>
  );
}
