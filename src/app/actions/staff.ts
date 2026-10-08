"use server";

import { revalidatePath } from "next/cache";
import { hashPassword, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { normaliseEmail } from "@/lib/crypto";
import { fieldErrors, formToObject, staffSchema, type FieldErrors } from "@/lib/validation";

export type StaffFormState = { errors?: FieldErrors; values?: Record<string, string>; created?: string };

export async function addStaffAction(_prev: StaffFormState, form: FormData): Promise<StaffFormState> {
  const admin = await requireUser(["ADMIN"]);
  const values = formToObject(form);
  const parsed = staffSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: { ...values, password: "" } };
  const email = normaliseEmail(parsed.data.email);
  if (await db.user.findUnique({ where: { email } })) {
    return { errors: { email: "Someone already uses that email." }, values: { ...values, password: "" } };
  }
  const user = await db.user.create({
    data: { name: parsed.data.name, email, phone: parsed.data.phone, role: parsed.data.role, passwordHash: await hashPassword(parsed.data.password) },
  });
  await audit(admin, "create", "User", user.id);
  revalidatePath("/staff");
  return { created: user.name };
}

export async function setStaffActiveAction(form: FormData) {
  const admin = await requireUser(["ADMIN"]);
  const id = String(form.get("id"));
  const active = form.get("active") === "true";
  if (id === admin.id) return;
  await db.user.update({ where: { id }, data: { active } });
  if (!active) await db.session.deleteMany({ where: { userId: id } });
  await audit(admin, active ? "activate" : "deactivate", "User", id);
  revalidatePath("/staff");
}

export type ResetState = { message?: string; error?: string };

export async function resetPasswordAction(_prev: ResetState, form: FormData): Promise<ResetState> {
  const admin = await requireUser(["ADMIN"]);
  const id = String(form.get("id"));
  const password = String(form.get("password") ?? "");
  if (password.length < 12) return { error: "Passwords must be at least 12 characters." };
  await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
  await db.session.deleteMany({ where: { userId: id } });
  await audit(admin, "reset-password", "User", id);
  return { message: "Password updated. They have been signed out everywhere." };
}
