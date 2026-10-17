import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import type { Role, User } from "@prisma/client";
import { db } from "./db";
import { ipFromForwardedFor } from "./client-ip";
import { blindIndex, normaliseEmail, randomToken, sha256 } from "./crypto";
import { KIOSK_COOKIE } from "./kiosk";

export const SESSION_COOKIE = "fy_session";
const SESSION_HOURS = 8;
// Failed sign-ins allowed within LOCKOUT_MINUTES: for one email from one IP
// address, and for one email from anywhere. The per-address limit means a
// stranger guessing a doctor's password locks only themselves out; the overall
// one still stops guessing spread over many addresses.
const MAX_FAILED_FROM_ONE_ADDRESS = 5;
const MAX_FAILED_FOR_EMAIL = 20;
const LOCKOUT_MINUTES = 15;

let dummyHash: string | undefined;

export type SessionUser = Pick<User, "id" | "name" | "email" | "role">;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return ipFromForwardedFor(h.get("x-forwarded-for")) ?? h.get("x-real-ip");
}

export type LoginResult = { ok: true; userId: string } | { ok: false; error: string };

export async function login(emailInput: string, password: string): Promise<LoginResult> {
  const email = normaliseEmail(emailInput);
  const emailHash = blindIndex(email);
  const ipAddress = await clientIp();
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60_000);

  // Recorded as a failure before counting, so many attempts sent at once can't
  // all slip in under the limit.
  const attempt = await db.loginAttempt.create({ data: { emailHash, ipAddress, success: false } });
  const failed = { emailHash, success: false, createdAt: { gte: since } };
  const [fromAddress, overall] = await Promise.all([
    db.loginAttempt.count({ where: { ...failed, ipAddress } }),
    db.loginAttempt.count({ where: failed }),
  ]);
  if (fromAddress > MAX_FAILED_FROM_ONE_ADDRESS || overall > MAX_FAILED_FOR_EMAIL) {
    // A refused attempt isn't counted, so one address can't push the account
    // over the overall limit on its own.
    await db.loginAttempt.delete({ where: { id: attempt.id } });
    return { ok: false, error: `Too many attempts. Please wait ${LOCKOUT_MINUTES} minutes and try again.` };
  }

  const user = await db.user.findUnique({ where: { email } });
  // Always run bcrypt so response time doesn't reveal whether the email exists.
  dummyHash ??= await bcrypt.hash("timing-equaliser", 12);
  const valid = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);

  if (!user || !user.active || !valid) {
    return { ok: false, error: "The email or password is not correct." };
  }

  await db.loginAttempt.update({ where: { id: attempt.id }, data: { success: true } });
  await startSession(user.id);
  return { ok: true, userId: user.id };
}

async function startSession(userId: string) {
  const store = await cookies();
  const previous = store.get(SESSION_COOKIE)?.value;
  if (previous) await db.session.deleteMany({ where: { tokenHash: sha256(previous) } });

  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3_600_000);
  await db.session.create({ data: { tokenHash: sha256(token), userId, expiresAt } });
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  await db.auditLog.create({ data: { userId, action: "login", entity: "User", entityId: userId, ipAddress: await clientIp() } });
}

export async function logout() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  }
  store.delete(SESSION_COOKIE);
  // A device left in check-in mode is unlocked too, so the next person to sign
  // in on it isn't sent straight to the check-in screen.
  store.delete(KIOSK_COOKIE);
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
