import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { blindIndex, decrypt, decryptJson, encrypt, encryptJson, normalisePhone } from "../src/lib/crypto";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.BLIND_INDEX_KEY = randomBytes(32).toString("base64");
});

describe("field encryption", () => {
  it("round-trips text and never stores it in the clear", () => {
    const secret = "Allergic to lidocaine";
    const ct = encrypt(secret);
    expect(ct).not.toContain("lidocaine");
    expect(ct.startsWith("v1.")).toBe(true);
    expect(decrypt(ct)).toBe(secret);
  });

  it("uses a fresh IV every time", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("rejects tampered ciphertext", () => {
    const parts = encrypt("patient data").split(".");
    const flipped = Buffer.from(parts[3], "base64url");
    flipped[0] ^= 1;
    parts[3] = flipped.toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
  });

  it("fails with the wrong key", () => {
    const ct = encrypt("data");
    process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
    expect(() => decrypt(ct)).toThrow();
  });

  it("round-trips JSON", () => {
    expect(decryptJson(encryptJson({ a: 1, b: ["x"] }))).toEqual({ a: 1, b: ["x"] });
  });
});

describe("blind index", () => {
  it("is deterministic and matches normalised phone numbers", () => {
    expect(blindIndex(normalisePhone("+27 82 123 4567"))).toBe(blindIndex(normalisePhone("+27821234567")));
    for (const local of ["082 123 4567", "0027 82 123 4567", "27821234567", "(082) 123-4567"]) {
      expect(normalisePhone(local, "27")).toBe("+27821234567");
    }
    expect(normalisePhone("07700 900123", "44")).toBe("+447700900123");
    expect(blindIndex("a")).not.toBe(blindIndex("b"));
  });
});
