import Link from "next/link";
import type { AppointmentStatus } from "@prisma/client";
import { setAppointmentStatusAction } from "@/app/actions/appointments";
import { formatDate, formatTime } from "@/lib/time";

export type AppointmentItem = {
  id: string;
  startsAt: Date;
  durationMinutes: number;
  service: string;
  status: AppointmentStatus;
  patientId: string;
  patientName: string;
  doctorName: string;
  canEdit: boolean;
};

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  BOOKED: "Booked",
  CHECKED_IN: "Arrived",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "Did not attend",
};

const NEXT_ACTIONS: Partial<Record<AppointmentStatus, { status: AppointmentStatus; label: string; className: string }[]>> = {
  BOOKED: [
    { status: "CHECKED_IN", label: "Mark arrived", className: "btn btn-primary" },
    { status: "CANCELLED", label: "Cancel", className: "btn btn-danger" },
    { status: "NO_SHOW", label: "Did not attend", className: "btn btn-secondary" },
  ],
  CHECKED_IN: [{ status: "COMPLETED", label: "Mark completed", className: "btn btn-primary" }],
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function AppointmentList({ items, showDate = false, showPatient = true, emptyText }: { items: AppointmentItem[]; showDate?: boolean; showPatient?: boolean; emptyText: string }) {
  if (items.length === 0) return <p className="muted py-4">{emptyText}</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((a) => (
        <li key={a.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-5">
            <div className="min-w-24">
              <p className="text-xl font-bold text-brand-dark">{formatTime(a.startsAt)}</p>
              <p className="hint">{a.durationMinutes} min</p>
            </div>
            <div>
              {showDate && <p className="font-bold">{formatDate(a.startsAt)}</p>}
              {showPatient && (
                <p>
                  <Link href={`/patients/${a.patientId}`} className="text-lg font-bold text-brand-dark underline underline-offset-4">{a.patientName}</Link>
                </p>
              )}
              <p className="muted">{a.service} · {a.doctorName}</p>
              <p className="mt-1"><StatusBadge status={a.status} /></p>
            </div>
          </div>
          {a.canEdit && NEXT_ACTIONS[a.status] && (
            <div className="flex flex-wrap gap-2">
              {NEXT_ACTIONS[a.status]!.map((n) => (
                <form key={n.status} action={setAppointmentStatusAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="status" value={n.status} />
                  <button type="submit" className={n.className}>{n.label}</button>
                </form>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
