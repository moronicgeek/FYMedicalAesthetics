import "server-only";
import { cookies } from "next/headers";
import { KIOSK_COOKIE } from "./kiosk";

// Puts this device in check-in mode: it only shows the patient screens until
// a staff member signs in again on it (see middleware.ts).
export async function lockTablet() {
  (await cookies()).set(KIOSK_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}

export async function unlockTablet() {
  (await cookies()).delete(KIOSK_COOKIE);
}
