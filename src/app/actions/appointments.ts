"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AppointmentStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { encryptAppointmentFields, sendBookingConfirmation } from "@/lib/appointments";
import { zonedToUtc } from "@/lib/time";
import { appointmentSchema, canSeeService, fieldErrors, formToObject, type FieldErrors } from "@/lib/validation";

export type AppointmentFormState = { errors?: FieldErrors; values?: Record<string, string> };

export async function bookAppointmentAction(_prev: AppointmentFormState, form: FormData): Promise<AppointmentFormState> {
  const user = await requireUser();
  const values = formToObject(form);
  const parsed = appointmentSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const input = parsed.data;

  const startsAt = zonedToUtc(input.date, input.time);
  if (startsAt.getTime() < Date.now() - 5 * 60_000) {
    return { errors: { date: "That time has already passed." }, values };
  }
  const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60_000);

  const [patient, doctor] = await Promise.all([
    db.patient.findUnique({ where: { id: input.patientId }, select: { id: true } }),
    db.user.findFirst({ where: { id: input.doctorId, role: "DOCTOR", active: true } }),
  ]);
  if (!patient) return { errors: { patientId: "Please choose a patient." }, values };
  if (!canSeeService(user.role, input.service)) return { errors: { service: "Only reception or a doctor can book this treatment." }, values };
  if (!doctor) return { errors: { doctorId: "Please choose a doctor." }, values };

  // Reject double-booking the doctor. Overlap: existing.start < new.end and existing.end > new.start.
  const sameDay = await db.appointment.findMany({
    where: {
      doctorId: doctor.id,
      status: { in: ["BOOKED", "CHECKED_IN"] },
      startsAt: { lt: endsAt, gt: new Date(startsAt.getTime() - 24 * 3_600_000) },
    },
    select: { startsAt: true, durationMinutes: true },
  });
  const clash = sameDay.some((a) => a.startsAt < endsAt && new Date(a.startsAt.getTime() + a.durationMinutes * 60_000) > startsAt);
  if (clash) return { errors: { time: `${doctor.name} already has an appointment at that time.` }, values };

  const appt = await db.appointment.create({
    data: {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt,
      durationMinutes: input.durationMinutes,
      ...encryptAppointmentFields(input.service, input.notes),
    },
  });
  await audit(user, "book", "Appointment", appt.id);

  let notified = "0";
  if (values.sendConfirmation === "on") {
    const results = await sendBookingConfirmation(appt.id);
    notified = results.some((r) => r.ok) ? "1" : "0";
  }
  redirect(`/patients/${patient.id}?booked=1&notified=${notified}`);
}

const ALLOWED: AppointmentStatus[] = ["BOOKED", "CHECKED_IN", "COMPLETED", "CANCELLED", "NO_SHOW"];

export async function setAppointmentStatusAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("id"));
  const status = String(form.get("status")) as AppointmentStatus;
  if (!ALLOWED.includes(status)) return;
  const appt = await db.appointment.findUnique({ where: { id }, select: { doctorId: true, service: true } });
  if (!appt || !canSeeService(user.role, decrypt(appt.service))) return;
  if (user.role === "DOCTOR" && appt.doctorId !== user.id) return;
  await db.appointment.update({ where: { id }, data: { status } });
  await audit(user, `status:${status}`, "Appointment", id);
  revalidatePath("/dashboard");
  revalidatePath("/appointments");
  revalidatePath("/patients", "layout");
}

export async function resendConfirmationAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("id"));
  await sendBookingConfirmation(id);
  await audit(user, "resend-confirmation", "Appointment", id);
  revalidatePath("/patients", "layout");
}
