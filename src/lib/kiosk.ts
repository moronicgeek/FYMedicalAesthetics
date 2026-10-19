export const KIOSK_COOKIE = "fy_kiosk";

// Where staff may be sent after signing in on a locked tablet.
export function safeNext(next: string | undefined) {
  return next && /^\/(cases|dashboard)(\/[\w-]*)?$/.test(next) ? next : "/dashboard";
}

// A tablet handed to one client opens only that client's form, and only for
// this long, so the tablet can't be used to open other clients' forms by
// changing the address.
export const KIOSK_FORM_HOURS = 2;

// The lock cookie is "1" for the start screen, or "<caseId>.<ms>" once the
// tablet is handed over for one case.
export function kioskLockValue(caseId?: string, now = Date.now()) {
  return caseId ? `${caseId}.${now}` : "1";
}

export function kioskLockedCase(value: string | undefined, now = Date.now()): string | null {
  const match = value?.match(/^([\w-]+)\.(\d+)$/);
  if (!match) return null;
  const age = now - Number(match[2]);
  return age >= 0 && age < KIOSK_FORM_HOURS * 3_600_000 ? match[1] : null;
}
