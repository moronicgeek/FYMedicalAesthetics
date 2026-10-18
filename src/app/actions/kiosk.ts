"use server";

import { redirect } from "next/navigation";
import { login, requireKioskUser, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { safeNext } from "@/lib/kiosk";
import { lockTablet, unlockTablet } from "@/lib/tablet";

export async function startKioskAction() {
  const user = await requireUser();
  await lockTablet();
  await audit(user, "kiosk-start", "Device");
  redirect("/kiosk");
}

export type ExitState = { error?: string; email?: string };

// Any staff member can take over the tablet: they sign in here, which also
// switches the device's session to them.
export async function exitKioskAction(_prev: ExitState, form: FormData): Promise<ExitState> {
  await requireKioskUser();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Please enter your email and password.", email };
  const result = await login(email, password);
  if (!result.ok) return { error: result.error, email };
  await unlockTablet();
  await audit({ id: result.userId }, "kiosk-exit", "Device");
  redirect(safeNext(String(form.get("next") ?? "")));
}
