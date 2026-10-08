"use server";

import { redirect } from "next/navigation";
import { login, logout } from "@/lib/auth";

export type LoginState = { error?: string; email?: string };

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Please enter your email and password.", email };
  const result = await login(email, password);
  if (!result.ok) return { error: result.error, email };
  redirect("/dashboard");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}
