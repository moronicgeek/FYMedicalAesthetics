import { describe, expect, it } from "vitest";
import { validSignature } from "../src/lib/signature";

const png = (size: number) => `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(size)]).toString("base64")}`;

describe("signature validation", () => {
  it("accepts a drawn signature", () => {
    expect(validSignature(png(500))).toBe(true);
  });
  it("rejects an empty or missing signature", () => {
    expect(validSignature(undefined)).toBe(false);
    expect(validSignature("")).toBe(false);
    expect(validSignature(png(10))).toBe(false);
  });
  it("rejects anything that is not a PNG data URL", () => {
    expect(validSignature("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBe(false);
    expect(validSignature(`data:image/png;base64,${"A".repeat(500_000)}`)).toBe(false);
  });
});
