import "server-only";
import type { Appointment, User } from "@prisma/client";
import { db } from "./db";
import { decrypt, encrypt } from "./crypto";
import { decryptPatient, displayName } from "./patients";
import { anySent, clinicName, notifyDoctor, notifyPatient } from "./notify";
import { formatDateTime, formatTime } from "./time";

export function decryptAppointment<T extends Appointment>(a: T) {
  return { ...a, service: decrypt(a.service), notes: a.notes ? decrypt(a.notes) : undefined };
}

export function encryptAppointmentFields(service: string, notes?: string) {
  return { service: encrypt(service), notes: notes ? encrypt(notes) : null };
}

export async function sendBookingConfirmation(appointmentId: string) {
  const appt = await db.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    include: { patient: true, doctor: true },
  });
  const patient = decryptPatient(appt.patient);
  const when = formatDateTime(appt.startsAt);
  const address = process.env.CLINIC_ADDRESS ? ` at ${process.env.CLINIC_ADDRESS}` : "";

  const name = patient.preferredName || patient.firstName;
  const patientResults = await notifyPatient(
    { name, email: patient.email, phone: patient.phone, contactPreference: patient.contactPreference },
    {
      subject: `Your appointment at ${clinicName()}`,
      text: `Your appointment with ${appt.doctor.name} is booked for ${when}${address}. Please call us if you need to change it.`,
    },
    {
      template: "bookingConfirmation",
      variables: [name, appt.doctor.name, when],
      fallbackText: `${clinicName()}: Hello ${name}, your appointment with ${appt.doctor.name} is booked for ${when}${address}. Please call us if you need to change it.`,
    },
  );
  await notifyDoctor(
    appt.doctor,
    `New appointment: ${when}`,
    `${displayName(patient)} has been booked with you for ${when}. Sign in to view the patient's intake details.`,
  );
  if (anySent(patientResults)) {
    await db.appointment.update({ where: { id: appt.id }, data: { confirmationSentAt: new Date() } });
  }
  return patientResults;
}

// Sends one reminder per appointment to the patient, for appointments starting
// within the next `hoursAhead` hours, plus a daily agenda email to each doctor.
export async function sendReminders(now = new Date(), hoursAhead = 24) {
  const until = new Date(now.getTime() + hoursAhead * 3_600_000);
  const due = await db.appointment.findMany({
    where: { status: "BOOKED", reminderSentAt: null, startsAt: { gt: now, lte: until } },
    include: { patient: true, doctor: true },
    orderBy: { startsAt: "asc" },
  });

  let patientReminders = 0;
  const byDoctor = new Map<string, { doctor: User; lines: string[] }>();

  for (const appt of due) {
    const patient = decryptPatient(appt.patient);
    const name = patient.preferredName || patient.firstName;
    const when = formatDateTime(appt.startsAt);
    const results = await notifyPatient(
      { name, email: patient.email, phone: patient.phone, contactPreference: patient.contactPreference },
      {
        subject: `Reminder: your appointment at ${clinicName()}`,
        text: `This is a reminder of your appointment with ${appt.doctor.name} on ${when}. Please call us if you can't make it.`,
      },
      {
        template: "appointmentReminder",
        variables: [name, appt.doctor.name, when],
        fallbackText: `${clinicName()}: Hello ${name}, this is a reminder of your appointment with ${appt.doctor.name} on ${when}. Please call us if you can't make it.`,
      },
    );
    if (anySent(results)) {
      patientReminders++;
      await db.appointment.update({ where: { id: appt.id }, data: { reminderSentAt: new Date() } });
    }
    const entry = byDoctor.get(appt.doctorId) ?? { doctor: appt.doctor, lines: [] };
    entry.lines.push(`${formatTime(appt.startsAt)}  ${displayName(patient)}  (${appt.durationMinutes} min)`);
    byDoctor.set(appt.doctorId, entry);
  }

  for (const { doctor, lines } of byDoctor.values()) {
    await notifyDoctor(doctor, `Your upcoming appointments`, `You have ${lines.length} appointment(s) in the next ${hoursAhead} hours:\n\n${lines.join("\n")}`);
  }

  return { appointments: due.length, patientReminders, doctorsNotified: byDoctor.size };
}
