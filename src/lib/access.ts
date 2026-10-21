import type { Prisma, Role } from "@prisma/client";
import type { CaseType } from "./consent-forms";
import { SERVICES } from "./validation";

// Who may see and do what. Practitioners only do IV drips; injections, peels
// and laser are done by doctors, so practitioners don't see those cases or
// bookings at all. Everyone else sees everything. Patient records follow the
// same rule (canSeePatient in patients.ts).

// Bookable services that only a doctor does.
export const DOCTOR_ONLY_SERVICES: readonly string[] = [
  "Anti-wrinkle injections",
  "Dermal fillers",
  "Skin rejuvenation",
  "Chemical peel",
  "Laser treatment",
];

export function canSeeCase(role: Role, type: CaseType) {
  return role !== "PRACTITIONER" || type === "IV_DRIP";
}

export function visibleCasesWhere(role: Role): Prisma.TreatmentCaseWhereInput {
  return role === "PRACTITIONER" ? { type: "IV_DRIP" } : {};
}

// Reception checks clients in but doesn't treat them.
export function canTreat(role: Role, type: CaseType) {
  if (role === "RECEPTION") return false;
  return type === "IV_DRIP" || role !== "PRACTITIONER";
}

export function canSeeService(role: Role, service: string) {
  return role !== "PRACTITIONER" || !DOCTOR_ONLY_SERVICES.includes(service);
}

export function servicesFor(role: Role) {
  return SERVICES.filter((s) => canSeeService(role, s));
}

// Reception copies old paper files onto patient records; admins can too and
// are the only ones who can remove an entry. Practitioners only see medical
// history from paper, since a past visit may be an injection or laser.
export function canEnterPaperHistory(role: Role) {
  return role === "RECEPTION" || role === "ADMIN";
}

export function canRemovePaperHistory(role: Role) {
  return role === "ADMIN";
}

export function canSeePaperEntry(role: Role, kind: string) {
  return role !== "PRACTITIONER" || kind === "medical";
}
