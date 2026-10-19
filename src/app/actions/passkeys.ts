"use server";

import { revalidatePath } from "next/cache";
import type { AuthenticationResponseJSON, PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { checkPassword, requireKioskUser, requireUser, startSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { safeNext } from "@/lib/kiosk";
import { registerPasskey, registrationOptions, signInOptions, verifyPasskeySignIn } from "@/lib/passkeys";
import { lockTablet, unlockTablet } from "@/lib/tablet";

export type PasskeyOptionsResult = { options: PublicKeyCredentialCreationOptionsJSON } | { error: string };

export async function passkeyRegistrationOptionsAction(password: string): Promise<PasskeyOptionsResult> {
  const user = await requireUser();
  if (!(await checkPassword(user.id, String(password ?? "")))) {
    await audit(user, "passkey-add-refused", "User", user.id);
    return { error: "That password is not correct." };
  }
  return { options: await registrationOptions(user) };
}

export async function addPasskeyAction(response: RegistrationResponseJSON, deviceName: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const name = String(deviceName ?? "").trim().slice(0, 60) || "This device";
  if (!(await registerPasskey(user.id, response, name))) {
    return { error: "Fingerprint sign-in could not be set up. Please try again." };
  }
  await audit(user, "passkey-add", "User", user.id);
  revalidatePath("/account");
  return {};
}

export async function removePasskeyAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("id"));
  // Admins may remove anyone's, e.g. when a tablet is lost or someone leaves.
  const where = user.role === "ADMIN" ? { id } : { id, userId: user.id };
  const passkey = await db.passkey.findFirst({ where, select: { id: true, userId: true } });
  if (!passkey) return;
  await db.passkey.delete({ where: { id: passkey.id } });
  await audit(user, "passkey-remove", "User", passkey.userId);
  revalidatePath("/account");
  revalidatePath("/staff");
}

export async function passkeySignInOptionsAction(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  return signInOptions();
}

// Returns where to go next rather than redirecting, so the browser code that
// started the fingerprint prompt decides when to leave the page.
export async function passkeySignInAction(response: AuthenticationResponseJSON, opts: { kiosk?: boolean; lock?: boolean; next?: string } = {}): Promise<{ error: string } | { next: string }> {
  // A locked tablet's sign-in page still holds the previous staff session.
  if (opts.kiosk) await requireKioskUser();
  const userId = await verifyPasskeySignIn(response);
  if (!userId) {
    await audit(null, "passkey-login-failed", "User");
    return { error: "That fingerprint sign-in was not recognised. Please try again or use your password." };
  }
  await startSession(userId, "passkey-login");
  if (opts.kiosk) {
    await unlockTablet();
    await audit({ id: userId }, "kiosk-exit", "Device");
    return { next: safeNext(opts.next) };
  }
  if (opts.lock) {
    await lockTablet();
    await audit({ id: userId }, "kiosk-start", "Device");
    return { next: "/kiosk" };
  }
  return { next: "/dashboard" };
}
