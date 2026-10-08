import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import type { Role, User } from "@prisma/client";
import { db } from "./db";
import { blindIndex, normaliseEmail, randomToken, sha256 } from "./crypto";

export const SESSION_COOKIE = "fy_session";
const SESSION_HOURS = 8;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

let dummyHash: string | undefined;

export type SessionUser = Pick<User, "id" | "name" | "email" | "role">;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function login(emailInput: string, password: string): Promise<LoginResult> {
  const email = normaliseEmail(emailInput);
  const emailHash = blindIndex(email);
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60_000);

  const recentFailures = await db.loginAttempt.count({
    where: { emailHash, success: false, createdAt: { gte: since } },
  });
  if (recentFailures >= MAX_FAILED_ATTEMPTS) {
    return { ok: false, error: `Too many attempts. Please wait ${LOCKOUT_MINUTES} minutes and try again.` };
  }

  const user = await db.user.findUnique({ where: { email } });
  // Always run bcrypt so response time doesn't reveal whether the email exists.
  dummyHash ??= await bcrypt.hash("timing-equaliser", 12);
  const valid = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);

  if (!user || !user.active || !valid) {
    await db.loginAttempt.create({ data: { emailHash, success: false } });
    return { ok: false, error: "The email or password is not correct." };
  }

  await db.loginAttempt.create({ data: { emailHash, success: true } });

  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3_600_000);
  await db.session.create({ data: { tokenHash: sha256(token), userId: user.id, expiresAt } });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  await db.auditLog.create({
    data: { userId: user.id, action: "login", entity: "User", entityId: user.id, ipAddress: await clientIp() },
  });
  return { ok: true };
}

export async function logout() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  }
  store.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true, active: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  const { active: _active, ...user } = session.user;
  return user;
});

export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/dashboard?denied=1");
  return user;
}
