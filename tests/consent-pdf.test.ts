import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import type { ConsentRecord } from "../src/lib/cases";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.BLIND_INDEX_KEY = randomBytes(32).toString("base64");
});

// 1x1 transparent PNG, standing in for the drawn signature.
const SIGNATURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const consent: ConsentRecord = {
  formType: "IV_DRIP",
  formVersion: "2026-10-08",
  patient: { firstName: "Thandi", lastName: "Nkosi", dateOfBirth: "1979-06-30", phone: "+27834447788", email: "thandi@example.com", idNumber: "7906305012087" },
  treatment: "Myers Cocktail",
  answers: { pregnant: "no", allergies: "yes", organDisease: "no", bloodPressure: "no", diabetes: "no", bloodThinners: "no", kidneyStones: "no", g6pd: "no", recentIllness: "no", previousReaction: "no" },
  details: { yesDetails: "Mild hayfever — antihistamine only", medications: "None" },
  emergency: { name: "Sipho Nkosi", phone: "+27831112222" },
  signedName: "Thandi Nkosi",
  signature: SIGNATURE,
  signedAt: "2026-10-08T12:00:00.000Z",
};

describe("consent PDF", () => {
  it("builds a readable two-page PDF with the patient's details", async () => {
    const { buildConsentPdf } = await import("../src/lib/consent-pdf");
    const bytes = await buildConsentPdf(consent, "4821");
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(doc.getTitle()).toContain("Thandi Nkosi");
  });

  it("handles characters the standard PDF fonts can't encode", async () => {
    const { buildConsentPdf } = await import("../src/lib/consent-pdf");
    const bytes = await buildConsentPdf(
      { ...consent, signedName: "Zoë 林 ✨", details: { ...consent.details, medications: "Vitamin C — 1000mg 💊" } },
      "4822",
    );
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("builds the other consent forms too", async () => {
    const { buildConsentPdf } = await import("../src/lib/consent-pdf");
    for (const formType of ["AESTHETICS", "LASER"] as const) {
      const bytes = await buildConsentPdf({ ...consent, formType, answers: { pregnant: "no" }, treatment: "Botox" }, "4823");
      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    }
  });
});

// Writes a sample PDF when SAVE_PDF is set, so the layout can be eyeballed.
describe.skipIf(!process.env.SAVE_PDF)("sample", () => {
  it("writes a sample to /var/tmp", async () => {
    const { buildConsentPdf } = await import("../src/lib/consent-pdf");
    const { writeFile } = await import("node:fs/promises");
    await writeFile("/var/tmp/sample-consent.pdf", await buildConsentPdf(consent, "4821"));
  });
});
