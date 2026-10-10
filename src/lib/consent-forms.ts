// The clinic's consent forms, transcribed from the Word templates supplied by
// FY Medical Aesthetics. Bump `version` whenever the wording changes so each
// signed consent records exactly which text the patient agreed to.

export type CaseType = "IV_DRIP" | "AESTHETICS" | "LASER";

export type ConsentQuestion = { id: string; text: string };

export type ConsentFormDef = {
  type: CaseType;
  version: string;
  shortName: string;
  title: string;
  subtitle?: string;
  treatmentChoice?: { label: string; options: string[]; freeText?: boolean };
  sections: { heading: string; paragraphs?: string[]; bullets?: string[] }[];
  questions: ConsentQuestion[];
  detailFields: { id: string; label: string; required?: boolean }[];
  acknowledgements: string[];
  consentStatement?: (name: string) => string;
  postCare?: string;
  officeUse: { id: string; label: string }[];
  // IV drips need vitals and a doctor's approval before treatment.
  requiresDoctorApproval: boolean;
};

export const CLINIC_LINE = "Managed by Lumiere Clinic | Robertsham, Johannesburg";

export const CONSENT_FORMS: Record<CaseType, ConsentFormDef> = {
  IV_DRIP: {
    type: "IV_DRIP",
    version: "2026-10-08",
    shortName: "IV drip",
    title: "Informed consent for Intravenous Nutrient Therapy (IVNT) / IV drips",
    treatmentChoice: { label: "Drip prescribed / requested", options: [], freeText: true },
    sections: [
      {
        heading: "1. Nature of procedure",
        paragraphs: [
          "I understand that IV Nutrient Therapy involves the intravenous administration of fluids, vitamins, minerals, amino acids and antioxidants. The treatment is administered by a SANC-registered, IV-qualified nurse / doctor. The purpose is wellness, hydration, and nutritional support and is NOT intended to diagnose, treat, cure or prevent any disease.",
        ],
      },
      {
        heading: "2. Benefits",
        paragraphs: [
          "Possible benefits may include improved hydration, increased energy, general wellness support, and replenishment of nutrients. No guaranteed outcome is promised.",
        ],
      },
      {
        heading: "3. Risks, side effects and complications",
        paragraphs: ["I understand that while generally safe, IV therapy carries risks including but not limited to:"],
        bullets: [
          "Pain, bruising, bleeding, swelling or infection at the cannulation site",
          "Inflammation of the vein (phlebitis)",
          "Allergic reaction / sensitivity to components of the infusion",
          "Nausea, dizziness, light-headedness, metallic taste",
          "Fluid overload",
          "In rare cases, severe allergic reaction (anaphylaxis)",
        ],
      },
    ],
    questions: [
      { id: "pregnant", text: "Are you pregnant, breastfeeding or trying to conceive?" },
      { id: "organDisease", text: "Heart disease, kidney disease, liver disease?" },
      { id: "bloodPressure", text: "High / low blood pressure?" },
      { id: "diabetes", text: "Diabetes?" },
      { id: "allergies", text: "Allergies to vitamins, medications, sticking plaster?" },
      { id: "bloodThinners", text: "On blood thinners (Warfarin, Aspirin), diuretics, or chronic meds?" },
      { id: "kidneyStones", text: "History of kidney stones (relevant for high-dose Vitamin C)?" },
      { id: "g6pd", text: "G6PD deficiency?" },
      { id: "recentIllness", text: "Any recent illness, surgery or hospital admission?" },
      { id: "previousReaction", text: "Previous reaction to IV drips?" },
    ],
    detailFields: [
      { id: "yesDetails", label: "If you answered YES to any question, please give details" },
      { id: "medications", label: "Current medications / supplements" },
    ],
    acknowledgements: [
      "I have disclosed my full medical history truthfully. I understand withholding information may increase risk.",
      "I understand this is an elective wellness procedure and alternative options include oral supplements, diet, and hydration.",
      "I understand I may stop the infusion at any time and should report any discomfort immediately. I understand photos may be taken for medical records only, not for marketing unless I give separate consent.",
      "I have had the opportunity to ask questions and all my questions have been answered.",
      "I understand I should not drive if I feel dizzy post-procedure and should remain for 15 minutes observation.",
      "I confirm I am 18 years or older.",
    ],
    consentStatement: (name) =>
      `I, ${name}, voluntarily consent to the administration of IV Nutrient Therapy by the practitioner at FY Medical Aesthetics (Managed by Lumiere Clinic). I understand that no warranty or guarantee has been made regarding results.`,
    postCare: "Keep plaster for 1 hour, increase water intake, report redness/swelling/fever.",
    officeUse: [
      { id: "batchNo", label: "Batch no of drip" },
      { id: "expiry", label: "Expiry" },
    ],
    requiresDoctorApproval: true,
  },

  AESTHETICS: {
    type: "AESTHETICS",
    version: "2026-10-08",
    shortName: "Botox, filler, peel or microneedling",
    title: "Informed consent for medical aesthetic treatments",
    subtitle: "Botox | Dermal fillers | Chemical peels | Microneedling",
    treatmentChoice: { label: "Treatment", options: ["Botox", "Filler", "Peel", "Microneedling"], freeText: true },
    sections: [
      {
        heading: "Nature of treatment",
        paragraphs: [
          "I understand I am requesting an elective aesthetic procedure. Treatment has been explained to me including expected results, number of sessions needed, and that results vary and no guarantee of perfection is given.",
        ],
      },
      {
        heading: "Treatment specific risks",
        bullets: [
          "BOTOX: Temporary bruising, headache, drooping eyelid/brow, asymmetry, no result, allergic reaction.",
          "DERMAL FILLERS: Bruising, swelling, pain, lumps, asymmetry, vascular occlusion (rare but serious), infection, delayed swelling, need for dissolving.",
          "CHEMICAL PEELS: Redness, peeling, stinging, sensitivity, temporary darkening/lightening, breakouts, scarring (rare).",
          "MICRONEEDLING: Redness, pinpoint bleeding, swelling, sensitivity, dryness, breakouts, infection risk if aftercare not followed.",
        ],
      },
    ],
    questions: [
      { id: "pregnant", text: "Pregnant / breastfeeding / trying to conceive?" },
      { id: "coldSores", text: "Cold sores / herpes?" },
      { id: "keloid", text: "Keloid scarring?" },
      { id: "allergies", text: "Allergies (lidocaine, eggs, latex)?" },
      { id: "autoimmune", text: "Autoimmune disease?" },
      { id: "roaccutane", text: "On Roaccutane in the last 6 months?" },
      { id: "bloodThinners", text: "Blood thinners, aspirin, anti-inflammatories?" },
      { id: "previousProblems", text: "Previous Botox / filler - any problems?" },
    ],
    detailFields: [
      { id: "medications", label: "Current medications / supplements" },
      { id: "previousTreatments", label: "Previous aesthetic treatments" },
    ],
    acknowledgements: [
      "I understand results are not permanent: Botox 3-4 months, Fillers 6-18 months, Peels/Microneedling require maintenance.",
      "I will follow aftercare instructions given (no makeup, gym, sauna, alcohol as advised).",
      "I have disclosed full medical history and understand withholding info increases risk.",
      "Photos may be taken for medical records. Marketing use only with separate consent.",
      "I understand I may need more than one session and additional costs may apply.",
      "I confirm I am 18 years or older.",
    ],
    consentStatement: (name) =>
      `I, ${name}, voluntarily consent to the above aesthetic treatment at FY Medical Aesthetics (Managed by Lumiere Clinic). I understand risks, benefits and alternatives including no treatment.`,
    officeUse: [
      { id: "product", label: "Product / batch" },
      { id: "lot", label: "Lot" },
      { id: "expiry", label: "Expiry" },
    ],
    requiresDoctorApproval: false,
  },

  LASER: {
    type: "LASER",
    version: "2026-10-08",
    shortName: "Laser",
    title: "Informed consent for laser treatment",
    subtitle: "Laser hair removal / skin rejuvenation",
    treatmentChoice: { label: "Treatment", options: ["Laser"], freeText: true },
    sections: [
      {
        heading: "Nature of treatment",
        paragraphs: ["Laser: Uses concentrated light to target hair follicle/pigment. Multiple sessions required (6-8+). Results vary."],
      },
      {
        heading: "Risks and complications",
        paragraphs: [
          "LASER RISKS: Pain/discomfort, redness, swelling, temporary pigment changes (lightening/darkening especially on darker skin), burns/blistering (rare), scabbing, failure to achieve desired hair reduction, eye injury if goggles not worn. I confirm I will wear eye protection.",
          "I understand I must NOT have this treatment if: I have recent sun exposure/tan/sunburn, using Roaccutane, have active skin infection, keloid history, or am pregnant/breastfeeding.",
        ],
      },
    ],
    questions: [
      { id: "pregnant", text: "Pregnant / breastfeeding / trying to conceive?" },
      { id: "sunExposure", text: "Sunbed / sun exposure in the last 2 weeks?" },
      { id: "keloid", text: "History of keloids?" },
      { id: "diabetesEpilepsy", text: "Diabetes / epilepsy?" },
      { id: "coldSores", text: "Herpes / cold sores?" },
      { id: "photosensitive", text: "On photosensitive meds (antibiotics, Roaccutane)?" },
      { id: "previousProblems", text: "Previous laser / PMU - any problems?" },
      { id: "allergies", text: "Allergies to pigment / lidocaine / latex / metals?" },
    ],
    detailFields: [
      { id: "medications", label: "Current medications / supplements" },
      { id: "previousTreatments", label: "Previous laser / PMU" },
    ],
    acknowledgements: [
      "LASER: I will avoid sun/sunbeds for 2 weeks before and after, avoid heat/gym/sauna/hot showers 48hrs, use SPF50 daily, no picking.",
      "I understand failure to follow aftercare increases risks and affects results.",
    ],
    officeUse: [
      { id: "settings", label: "Laser settings" },
      { id: "area", label: "Area treated" },
    ],
    requiresDoctorApproval: false,
  },
};

export const CASE_TYPES = Object.keys(CONSENT_FORMS) as CaseType[];

export function isCaseType(v: string): v is CaseType {
  return v in CONSENT_FORMS;
}

// Form values for a treatment already recorded as "Botox, Filler, lips", so the
// tick boxes and "Other" box start from it.
export function treatmentValues(choice: ConsentFormDef["treatmentChoice"], treatment?: string): Record<string, string> {
  if (!choice || !treatment) return {};
  const parts = treatment.split(",").map((t) => t.trim()).filter(Boolean);
  const values: Record<string, string> = {};
  const other: string[] = [];
  for (const t of parts) {
    if (choice.options.includes(t)) values[`treatment_${t}`] = "on";
    else other.push(t);
  }
  if (other.length) values.treatmentOther = other.join(", ");
  return values;
}
