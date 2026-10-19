"use server";

import { redirect } from "next/navigation";
import { login, logout } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { lockTablet } from "@/lib/tablet";

export type LoginState = { error?: string; email?: string };

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Please enter your email and password.", email };
  const result = await login(email, password);
  if (!result.ok) return { error: result.error, email };
  // "Start check-in mode" on the sign-in page: a staff member signs in, then
  // the device goes straight to the patient screens and stays there.
  if (form.get("lock") === "1") {
    await lockTablet();
    await audit({ id: result.userId }, "kiosk-start", "Device");
    redirect("/kiosk");
  }
  redirect("/dashboard");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}
