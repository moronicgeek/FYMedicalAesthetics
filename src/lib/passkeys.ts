import "server-only";
import { cookies } from "next/headers";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { db } from "./db";
import { randomToken, sha256 } from "./crypto";
import { appUrl, clinicName } from "./notify";
import { relyingParty } from "./passkey-rp";

const CHALLENGE_COOKIE = "fy_passkey";
const CHALLENGE_MINUTES = 5;

// The challenge is kept server-side and used once, so a captured response
// can't be replayed (platform passkeys often don't count their uses).
async function saveChallenge(challenge: string, userId?: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + CHALLENGE_MINUTES * 60_000);
  await db.passkeyChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.passkeyChallenge.create({ data: { tokenHash: sha256(token), challenge, userId, expiresAt } });
  (await cookies()).set(CHALLENGE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
}

async function takeChallenge(userId?: string): Promise<string | null> {
  const store = await cookies();
  const token = store.get(CHALLENGE_COOKIE)?.value;
  store.delete(CHALLENGE_COOKIE);
  if (!token) return null;
  const row = await db.passkeyChallenge.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row) return null;
  await db.passkeyChallenge.delete({ where: { id: row.id } });
  if (row.expiresAt < new Date() || row.userId !== (userId ?? null)) return null;
  return row.challenge;
}

// Only the device's own fingerprint/face/PIN unlock counts (no phones or USB
// keys), and the passkey is stored on the device so no email has to be typed.
export async function registrationOptions(user: { id: string; name: string; email: string }): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const existing = await db.passkey.findMany({ where: { userId: user.id }, select: { credentialId: true, transports: true } });
  const options = await generateRegistrationOptions({
    rpName: clinicName(),
    rpID: relyingParty(appUrl()).rpID,
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: p.transports })),
    authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "required", userVerification: "required" },
  });
  await saveChallenge(options.challenge, user.id);
  return options;
}

export async function registerPasskey(userId: string, response: RegistrationResponseJSON, deviceName: string) {
  const challenge = await takeChallenge(userId);
  if (!challenge) return false;
  const { rpID, origin } = relyingParty(appUrl());
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  }).catch(() => null);
  if (!result?.verified) return false;
  const { credential } = result.registrationInfo;
  await db.passkey.create({
    data: {
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
      deviceName,
    },
  });
  return true;
}

export async function signInOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const options = await generateAuthenticationOptions({ rpID: relyingParty(appUrl()).rpID, userVerification: "required" });
  await saveChallenge(options.challenge);
  return options;
}

// Returns the signed-in staff member's id, or null if the passkey isn't one
// of ours, belongs to someone whose access was removed, or doesn't verify.
export async function verifyPasskeySignIn(response: AuthenticationResponseJSON): Promise<string | null> {
  const challenge = await takeChallenge();
  if (!challenge || typeof response?.id !== "string") return null;
  const passkey = await db.passkey.findUnique({ where: { credentialId: response.id }, include: { user: { select: { active: true } } } });
  if (!passkey || !passkey.user.active) return null;
  const { rpID, origin } = relyingParty(appUrl());
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
    credential: { id: passkey.credentialId, publicKey: new Uint8Array(passkey.publicKey), counter: passkey.counter, transports: passkey.transports },
  }).catch(() => null);
  if (!result?.verified) return null;
  await db.passkey.update({ where: { id: passkey.id }, data: { counter: result.authenticationInfo.newCounter, lastUsedAt: new Date() } });
  return passkey.userId;
}
