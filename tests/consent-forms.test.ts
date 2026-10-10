import { describe, expect, it } from "vitest";
import { CONSENT_FORMS, treatmentValues } from "../src/lib/consent-forms";

describe("treatmentValues", () => {
  const choice = CONSENT_FORMS.AESTHETICS.treatmentChoice;

  it("ticks the known treatments and puts the rest in Other", () => {
    expect(treatmentValues(choice, "Botox, Filler, lip flip")).toEqual({ treatment_Botox: "on", treatment_Filler: "on", treatmentOther: "lip flip" });
  });

  it("starts empty when nothing has been chosen yet", () => {
    expect(treatmentValues(choice, undefined)).toEqual({});
  });
});
