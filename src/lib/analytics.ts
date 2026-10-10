import "server-only";
import type { CaseOutcome, CaseType, Role } from "@prisma/client";
import { db } from "./db";
import { decrypt, decryptJson, encrypt } from "./crypto";
import type { CaseRecord } from "./cases";
import { clinicParts, datesIn, type Period } from "./periods";
import type { Bar } from "@/components/OverviewCharts";

// Figures for the admin overview. Everything is counted from the plain
// workflow columns (type, status, timestamps, staff); the only encrypted
// value read is the short treatment name, and only totals leave this file.

export const OUTCOME_FILTERS = {
  COMPLETED: "Completed",
  NOT_TREATED: "Not treated (referred)",
  CANCELLED: "Left the waiting list",
  OPEN: "Still open",
} as const;
export type OutcomeFilter = keyof typeof OUTCOME_FILTERS;

export type Filters = { type?: CaseType; drip?: string; staff?: string; outcome?: OutcomeFilter };

type Row = {
  id: string;
  type: CaseType;
  outcome: CaseOutcome | null;
  createdAt: Date;
  closedAt: Date | null;
  practitionerId: string | null;
  doctorId: string | null;
  doctorRequestedAt: Date | null;
  doctorDecision: boolean | null;
  doctorDecisionAt: Date | null;
  vitalsWithinRange: boolean | null;
  patientId: string | null;
  treatment: string;
};

function outcomeGroup(r: Pick<Row, "outcome">): OutcomeFilter {
  if (!r.outcome) return "OPEN";
  if (r.outcome === "COMPLETED") return "COMPLETED";
  if (r.outcome === "CANCELLED") return "CANCELLED";
  return "NOT_TREATED";
}

// Cases from before the treatment had its own column get it filled in once,
// the first time the overview covers them.
async function backfillTreatments(start: Date, end: Date) {
  const missing = await db.treatmentCase.findMany({ where: { createdAt: { gte: start, lt: end }, treatment: null }, select: { id: true, consent: true } });
  for (const row of missing) {
    const treatment = decryptJson<CaseRecord>(row.consent).treatment ?? "";
    await db.treatmentCase.update({ where: { id: row.id }, data: { treatment: encrypt(treatment) } });
  }
}

async function loadRows(start: Date, end: Date): Promise<Row[]> {
  await backfillTreatments(start, end);
  const rows = await db.treatmentCase.findMany({
    where: { createdAt: { gte: start, lt: end } },
    select: {
      id: true, type: true, outcome: true, createdAt: true, closedAt: true, practitionerId: true, doctorId: true,
      doctorRequestedAt: true, doctorDecision: true, doctorDecisionAt: true, vitalsWithinRange: true, patientId: true, treatment: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ ...r, treatment: r.treatment ? decrypt(r.treatment) : "" }));
}

function applyFilters(rows: Row[], f: Filters) {
  return rows.filter(
    (r) =>
      (!f.type || r.type === f.type) &&
      (!f.drip || (r.type === "IV_DRIP" && r.treatment === f.drip)) &&
      (!f.staff || r.practitionerId === f.staff || r.doctorId === f.staff) &&
      (!f.outcome || outcomeGroup(r) === f.outcome),
  );
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
}

const minutesBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60_000;

export const TREATMENT_LABEL: Record<CaseType, string> = { IV_DRIP: "IV drips", AESTHETICS: "Injections, peels and microneedling", LASER: "Laser" };
const ROLE_LABEL: Record<Role, string> = { ADMIN: "Administrator", DOCTOR: "Doctor", PRACTITIONER: "Practitioner", RECEPTION: "Reception" };
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export async function staffOptions() {
  const users = await db.user.findMany({ where: { role: { not: "RECEPTION" } }, select: { id: true, name: true, role: true, active: true }, orderBy: { name: "asc" } });
  return users.map((u) => ({ id: u.id, name: u.name, role: ROLE_LABEL[u.role], active: u.active }));
}

export async function businessOverview(period: Period, filters: Filters) {
  const [allRows, prevRows, staff] = await Promise.all([loadRows(period.start, period.end), loadRows(period.previous.start, period.previous.end), staffOptions()]);
  const rows = applyFilters(allRows, filters);
  const prev = applyFilters(prevRows, filters);
  const staffName = new Map(staff.map((s) => [s.id, s]));

  const count = (list: Row[], group: OutcomeFilter) => list.filter((r) => outcomeGroup(r) === group).length;
  const totals = {
    checkIns: rows.length,
    completed: count(rows, "COMPLETED"),
    notTreated: count(rows, "NOT_TREATED"),
    cancelled: count(rows, "CANCELLED"),
    open: count(rows, "OPEN"),
    prevCheckIns: prev.length,
    prevCompleted: count(prev, "COMPLETED"),
    medianVisitMinutes: median(rows.filter((r) => r.outcome === "COMPLETED" && r.closedAt).map((r) => minutesBetween(r.createdAt, r.closedAt!))),
  };

  // Check-ins over the period: by hour for a day, by date otherwise.
  const parts = new Map(rows.map((r) => [r.id, clinicParts(r.createdAt)]));
  let timeline: Bar[];
  if (period.view === "day") {
    const hours = rows.map((r) => parts.get(r.id)!.hour);
    const first = Math.min(8, ...hours);
    const last = Math.max(17, ...hours);
    timeline = Array.from({ length: last - first + 1 }, (_, i) => {
      const h = first + i;
      return { key: String(h), label: `${String(h).padStart(2, "0")}:00`, short: String(h).padStart(2, "0"), value: hours.filter((x) => x === h).length };
    });
  } else {
    timeline = datesIn(period.from, period.to).map((d) => {
      const date = new Date(`${d}T12:00:00Z`);
      const label = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(date);
      const short = period.view === "week" ? label.split(" ")[0] : String(Number(d.slice(8)));
      return { key: d, label, short, value: rows.filter((r) => parts.get(r.id)!.date === d).length };
    });
  }

  const byTreatment: Bar[] = (Object.keys(TREATMENT_LABEL) as CaseType[]).map((t) => ({ key: t, label: TREATMENT_LABEL[t], value: rows.filter((r) => r.type === t).length }));

  const dripCounts = new Map<string, number>();
  for (const r of rows) if (r.type === "IV_DRIP") dripCounts.set(r.treatment || "Not chosen yet", (dripCounts.get(r.treatment || "Not chosen yet") ?? 0) + 1);
  const byDrip: Bar[] = [...dripCounts].map(([label, value]) => ({ key: label, label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

  const hourCounts = new Map<number, number>();
  for (const r of rows) hourCounts.set(parts.get(r.id)!.hour, (hourCounts.get(parts.get(r.id)!.hour) ?? 0) + 1);
  const busiestHours: Bar[] = [...hourCounts]
    .sort((a, b) => a[0] - b[0])
    .map(([h, value]) => ({ key: String(h), label: `${String(h).padStart(2, "0")}:00 to ${String(h + 1).padStart(2, "0")}:00`, value }));
  const weekdays: Bar[] = WEEKDAYS.map((label, i) => ({ key: String(i), label, value: rows.filter((r) => parts.get(r.id)!.weekday === i).length }));

  // Doctor's IV drip approvals and the vitals referrals before them.
  const asked = rows.filter((r) => r.doctorRequestedAt);
  const doctor = {
    asked: asked.length,
    yes: asked.filter((r) => r.doctorDecision === true).length,
    no: asked.filter((r) => r.doctorDecision === false).length,
    waiting: asked.filter((r) => r.doctorDecision === null).length,
    medianReplyMinutes: median(asked.filter((r) => r.doctorDecisionAt).map((r) => minutesBetween(r.doctorRequestedAt!, r.doctorDecisionAt!))),
    vitalsReferrals: rows.filter((r) => r.outcome === "REFERRED_VITALS").length,
    declinedReferrals: rows.filter((r) => r.outcome === "DOCTOR_DECLINED").length,
  };

  // New clients had their first ever visit in this period.
  const patientIds = [...new Set(rows.flatMap((r) => (r.patientId ? [r.patientId] : [])))];
  const firstVisits = patientIds.length
    ? await db.treatmentCase.groupBy({ by: ["patientId"], where: { patientId: { in: patientIds } }, _min: { createdAt: true } })
    : [];
  const newClients = firstVisits.filter((v) => v._min.createdAt && v._min.createdAt >= period.start).length;
  const clients = { total: patientIds.length, new: newClients, returning: patientIds.length - newClients, unlinked: rows.filter((r) => !r.patientId).length };

  // Workload: treatments each person took through (practitioner on an IV
  // drip, the doctor who closed an injection or laser case) and IV approvals.
  const workload = new Map<string, { treated: number; completed: number; approvals: number }>();
  const entry = (id: string) => workload.get(id) ?? workload.set(id, { treated: 0, completed: 0, approvals: 0 }).get(id)!;
  for (const r of rows) {
    if (r.practitionerId && r.outcome !== "CANCELLED") {
      entry(r.practitionerId).treated++;
      if (r.outcome === "COMPLETED") entry(r.practitionerId).completed++;
    }
    if (r.doctorId && r.doctorDecision !== null) entry(r.doctorId).approvals++;
  }
  const staffWorkload = [...workload]
    .map(([id, w]) => ({ id, name: staffName.get(id)?.name ?? "Former staff member", role: staffName.get(id)?.role ?? "", ...w }))
    .sort((a, b) => b.treated + b.approvals - (a.treated + a.approvals) || a.name.localeCompare(b.name));

  // Booked appointments in the period. Their treatment is encrypted free text,
  // so only the staff filter applies to them.
  const appts = await db.appointment.groupBy({
    by: ["status"],
    where: { startsAt: { gte: period.start, lt: period.end }, ...(filters.staff ? { doctorId: filters.staff } : {}) },
    _count: { _all: true },
  });
  const apptCount = (s: string) => appts.find((a) => a.status === s)?._count._all ?? 0;
  const appointments = {
    total: appts.reduce((n, a) => n + a._count._all, 0),
    completed: apptCount("COMPLETED"),
    noShow: apptCount("NO_SHOW"),
    cancelled: apptCount("CANCELLED"),
    upcoming: apptCount("BOOKED") + apptCount("CHECKED_IN"),
  };

  const drips = [...new Set(allRows.filter((r) => r.type === "IV_DRIP" && r.treatment).map((r) => r.treatment))];

  return { totals, timeline, byTreatment, byDrip, busiestHours, weekdays, doctor, clients, staffWorkload, appointments, staff, drips };
}
