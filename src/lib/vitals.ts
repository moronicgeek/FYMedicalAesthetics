// Vital signs and the ranges a practitioner must see before an IV drip can go
// to a doctor for approval. Defaults are a starting point only: the clinic's
// medical lead should confirm them under Settings.

export type VitalKey = "systolic" | "diastolic" | "heartRate" | "glucose" | "spo2" | "temperature";

export type Vitals = Partial<Record<VitalKey, number>>;

export type Range = { min: number; max: number };
export type VitalRanges = Record<VitalKey, Range>;

export const VITAL_FIELDS: { key: VitalKey; label: string; unit: string; required: boolean; step: string }[] = [
  { key: "systolic", label: "Blood pressure: systolic (top number)", unit: "mmHg", required: true, step: "1" },
  { key: "diastolic", label: "Blood pressure: diastolic (bottom number)", unit: "mmHg", required: true, step: "1" },
  { key: "heartRate", label: "Heart rate", unit: "bpm", required: true, step: "1" },
  { key: "glucose", label: "Blood sugar", unit: "mmol/L", required: true, step: "0.1" },
  { key: "temperature", label: "Temperature", unit: "°C", required: true, step: "0.1" },
  { key: "spo2", label: "Oxygen saturation (SpO2)", unit: "%", required: false, step: "1" },
];

export const DEFAULT_RANGES: VitalRanges = {
  systolic: { min: 90, max: 140 },
  diastolic: { min: 60, max: 90 },
  heartRate: { min: 50, max: 100 },
  glucose: { min: 3.9, max: 11.0 },
  spo2: { min: 95, max: 100 },
  temperature: { min: 35.5, max: 37.5 },
};

export type VitalsCheck = { withinRange: boolean; outOfRange: { key: VitalKey; label: string; value: number; range: Range; unit: string }[] };

export function checkVitals(vitals: Vitals, ranges: VitalRanges): VitalsCheck {
  const outOfRange: VitalsCheck["outOfRange"] = [];
  for (const f of VITAL_FIELDS) {
    const value = vitals[f.key];
    if (value === undefined) continue;
    const range = ranges[f.key];
    if (value < range.min || value > range.max) outOfRange.push({ key: f.key, label: f.label, value, range, unit: f.unit });
  }
  return { withinRange: outOfRange.length === 0, outOfRange };
}

export function parseVitals(form: Record<string, string>): { vitals?: Vitals; errors?: Record<string, string> } {
  const vitals: Vitals = {};
  const errors: Record<string, string> = {};
  for (const f of VITAL_FIELDS) {
    const raw = (form[f.key] ?? "").trim().replace(",", ".");
    if (!raw) {
      if (f.required) errors[f.key] = "Please enter this reading.";
      continue;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0 || n > 400) errors[f.key] = "Please enter a valid number.";
    else vitals[f.key] = n;
  }
  return Object.keys(errors).length ? { errors } : { vitals };
}

export function formatVitals(v: Vitals) {
  const parts: string[] = [];
  if (v.systolic !== undefined && v.diastolic !== undefined) parts.push(`BP ${v.systolic}/${v.diastolic}`);
  if (v.heartRate !== undefined) parts.push(`HR ${v.heartRate}`);
  if (v.glucose !== undefined) parts.push(`Glucose ${v.glucose} mmol/L`);
  if (v.spo2 !== undefined) parts.push(`SpO2 ${v.spo2}%`);
  if (v.temperature !== undefined) parts.push(`Temp ${v.temperature}°C`);
  return parts.join(", ");
}
