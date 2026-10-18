export const KIOSK_COOKIE = "fy_kiosk";

// Where staff may be sent after signing in on a locked tablet.
export function safeNext(next: string | undefined) {
  return next && /^\/(cases|dashboard)(\/[\w-]*)?$/.test(next) ? next : "/dashboard";
}
