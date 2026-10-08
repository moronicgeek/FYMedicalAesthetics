"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { login, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { KIOSK_COOKIE } from "@/lib/kiosk";

export async function startKioskAction() {
  const user = await requireUser();
  (await cookies()).set(KIOSK_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  await audit(user, "kiosk-start", "Device");
  redirect("/kiosk");
}

export type ExitState = { error?: string; email?: string };

function safeNext(next: string | undefined) {
  return next && /^\/(cases|dashboard)(\/[\w-]*)?$/.test(next) ? next : "/dashboard";
}

// Any staff member can take over the tablet: they sign in here, which also
// switches the device's session to them.
export async function exitKioskAction(_prev: ExitState, form: FormData): Promise<ExitState> {
  await requireUser();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Please enter your email and password.", email };
  const result = await login(email, password);
  if (!result.ok) return { error: result.error, email };
  (await cookies()).delete(KIOSK_COOKIE);
  await audit({ id: result.userId }, "kiosk-exit", "Device");
  redirect(safeNext(String(form.get("next") ?? "")));
}
