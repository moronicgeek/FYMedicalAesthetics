import "server-only";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "./auth";
import { db } from "./db";
import { decryptAppointment } from "./appointments";
import { decryptPatient, displayName } from "./patients";
import type { AppointmentItem } from "@/components/AppointmentList";

export async function listAppointments(user: SessionUser, where: Prisma.AppointmentWhereInput, order: "asc" | "desc" = "asc"): Promise<AppointmentItem[]> {
  const rows = await db.appointment.findMany({
    where,
    include: { patient: true, doctor: { select: { name: true } } },
    orderBy: { startsAt: order },
  });
  return rows.map((row) => {
    const a = decryptAppointment(row);
    return {
      id: a.id,
      startsAt: a.startsAt,
      durationMinutes: a.durationMinutes,
      service: a.service,
      status: a.status,
      patientId: a.patientId,
      patientName: displayName(decryptPatient(row.patient)),
      doctorName: row.doctor.name,
      canEdit: user.role !== "DOCTOR" || a.doctorId === user.id,
    };
  });
}

export async function listDoctors() {
  return db.user.findMany({ where: { role: "DOCTOR", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}
