import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { KIOSK_COOKIE, kioskLockValue, kioskLockedCase } from "./kiosk";
import type { SessionUser } from "./auth";

// Puts this device in check-in mode: it only shows the patient screens until
// a staff member signs in again on it (see middleware.ts). With a case, the
// tablet opens only that client's form (see kioskMayOpenCase).
export async function lockTablet(caseId?: string) {
  (await cookies()).set(KIOSK_COOKIE, kioskLockValue(caseId), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}

export async function unlockTablet() {
  (await cookies()).delete(KIOSK_COOKIE);
}

export async function isTabletLocked() {
  return (await cookies()).has(KIOSK_COOKIE);
}

// Staff on an unlocked device may open any form they can see. A locked tablet
// opens only the case it was handed over for, until KIOSK_FORM_HOURS pass.
export async function kioskMayOpenCase(caseId: string) {
  const lock = (await cookies()).get(KIOSK_COOKIE);
  return !lock || kioskLockedCase(lock.value) === caseId;
}

// Forms a tablet in check-in mode may send within KIOSK_WINDOW_MINUTES,
// counted from the audit log of the staff member who handed it over. A busy
// morning stays well under it; someone filling in forms over and over doesn't.
const KIOSK_FORMS_PER_WINDOW = 30;
const KIOSK_WINDOW_MINUTES = 10;
const KIOSK_FORM_ACTIONS = ["checked-in-on-tablet", "consent-signed", "intake-create", "intake-update"];

export async function tooManyKioskForms(user: Pick<SessionUser, "id">) {
  const since = new Date(Date.now() - KIOSK_WINDOW_MINUTES * 60_000);
  const sent = await db.auditLog.count({ where: { userId: user.id, action: { in: KIOSK_FORM_ACTIONS }, createdAt: { gte: since } } });
  return sent >= KIOSK_FORMS_PER_WINDOW;
}

export const KIOSK_BUSY_MESSAGE = "Too many forms have been sent from this tablet. Please hand it back to reception.";
