"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { KIOSK_COOKIE } from "@/lib/kiosk";

export async function startKioskAction() {
  const user = await requireUser();
  (await cookies()).set(KIOSK_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  await audit(user, "kiosk-start", "Device");
  redirect("/kiosk");
}

export type ExitState = { error?: string };

export async function exitKioskAction(_prev: ExitState, form: FormData): Promise<ExitState> {
  const user = await requireUser();
  const password = String(form.get("password") ?? "");
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!password || !(await bcrypt.compare(password, row.passwordHash))) {
    return { error: "That password is not correct." };
  }
  (await cookies()).delete(KIOSK_COOKIE);
  await audit(user, "kiosk-exit", "Device");
  redirect("/dashboard");
}
