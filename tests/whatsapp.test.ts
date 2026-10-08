import { afterEach, describe, expect, it } from "vitest";
import { whatsAppParams } from "../src/lib/notify";

const msg = {
  template: "doctorApproval" as const,
  variables: ["4821", "Pieter V., 38y", "Immune Boost", "BP 122/78,\nHR 68", "https://example.com/d/abc"],
  fallbackText: "IV drip approval #4821",
};

afterEach(() => {
  delete process.env.TWILIO_TEMPLATE_DOCTOR_APPROVAL;
});

describe("WhatsApp message parameters", () => {
  it("uses the approved template when one is configured", () => {
    process.env.TWILIO_TEMPLATE_DOCTOR_APPROVAL = "HX123";
    const p = whatsAppParams("+27825551234", "+27100000000", msg);
    expect(p.To).toBe("whatsapp:+27825551234");
    expect(p.From).toBe("whatsapp:+27100000000");
    expect(p.ContentSid).toBe("HX123");
    expect(p.Body).toBeUndefined();
    const vars = JSON.parse(p.ContentVariables);
    expect(vars["1"]).toBe("4821");
    // Newlines aren't allowed in template variables.
    expect(vars["4"]).toBe("BP 122/78, HR 68");
  });

  it("falls back to plain text without a template (Twilio sandbox, or inside the 24-hour window)", () => {
    const p = whatsAppParams("+27825551234", "+27100000000", msg);
    expect(p.Body).toBe("IV drip approval #4821");
    expect(p.ContentSid).toBeUndefined();
  });
});
