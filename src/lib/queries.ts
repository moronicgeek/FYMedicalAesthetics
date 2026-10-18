import "server-only";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "./auth";
import { db } from "./db";
import { decryptAppointment } from "./appointments";
import { displayName, patientRecord } from "./patients";
import type { AppointmentItem } from "@/components/AppointmentList";
import { canSeeService } from "./access";

export async function listAppointments(user: SessionUser, where: Prisma.AppointmentWhereInput, order: "asc" | "desc" = "asc"): Promise<AppointmentItem[]> {
  const rows = await db.appointment.findMany({
    where,
    // Only the patient's name is shown, so only their details are loaded.
    include: { patient: { select: { data: true } }, doctor: { select: { name: true } } },
    orderBy: { startsAt: order },
  });
  // The treatment is encrypted, so practitioners' doctor-only bookings are
  // dropped after decrypting rather than in the query.
  return rows.map(decryptAppointment).filter((a) => canSeeService(user.role, a.service)).map((a) => ({
      id: a.id,
      startsAt: a.startsAt,
      durationMinutes: a.durationMinutes,
      service: a.service,
      status: a.status,
      patientId: a.patientId,
      patientName: displayName(patientRecord(a.patient)),
      doctorName: a.doctor.name,
      canEdit: user.role !== "DOCTOR" || a.doctorId === user.id,
    }));
}

export async function listDoctors() {
  return db.user.findMany({ where: { role: "DOCTOR", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}
