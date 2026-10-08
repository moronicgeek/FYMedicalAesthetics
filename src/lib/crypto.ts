import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

// Ciphertext format: "v1.<iv>.<authTag>.<ciphertext>", each part base64url.
// The version prefix lets us rotate keys later without a big-bang migration.
const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";

function loadKey(name: string): Buffer {
  const raw = process.env[name];
  if (!raw) {
    throw new Error(`${name} is not set. Generate one with: openssl rand -base64 32`);
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`${name} must be 32 bytes, base64 encoded.`);
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const key = loadKey("ENCRYPTION_KEY");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decrypt(payload: string): string {
  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
    throw new Error("Unrecognised ciphertext format.");
  }
  const decipher = createDecipheriv(ALGORITHM, loadKey("ENCRYPTION_KEY"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export function encryptJson(value: unknown): string {
  return encrypt(JSON.stringify(value));
}

export function decryptJson<T>(payload: string): T {
  return JSON.parse(decrypt(payload)) as T;
}

// Deterministic keyed hash used as a lookup index. Uses a separate key so a
// leaked index key does not expose the encrypted data, and vice versa.
export function blindIndex(value: string): string {
  return createHmac("sha256", loadKey("BLIND_INDEX_KEY")).update(value).digest("base64url");
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Normalises to international format so "082 123 4567", "+27 82 123 4567"
// and "0027821234567" all match the same patient. Local numbers starting with
// 0 use DEFAULT_COUNTRY_CODE.
export function normalisePhone(phone: string, countryCode = process.env.DEFAULT_COUNTRY_CODE || "27"): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("0")) return `+${countryCode}${digits.slice(1)}`;
  return digits.startsWith(countryCode) ? `+${digits}` : `+${countryCode}${digits}`;
}

export function normaliseIdNumber(id: string): string {
  return id.replace(/\s+/g, "").toUpperCase();
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}
