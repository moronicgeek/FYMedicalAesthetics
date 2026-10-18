import { describe, expect, it } from "vitest";
import { relyingParty } from "../src/lib/passkey-rp";

describe("relyingParty", () => {
  it("uses the host name as the passkey's site and the full origin for checks", () => {
    expect(relyingParty("https://portal.example.com")).toEqual({ rpID: "portal.example.com", origin: "https://portal.example.com" });
  });

  it("keeps a local port in the origin but not in the site name", () => {
    expect(relyingParty("http://localhost:3000")).toEqual({ rpID: "localhost", origin: "http://localhost:3000" });
  });
});
