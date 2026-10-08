import { z } from "zod";

const required = (label: string) => z.string().trim().min(1, `Please enter ${label}.`);
const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const phone = z
  .string()
  .trim()
  .regex(/^\+?[\d\s()-]{7,20}$/, "Please enter a valid phone number.");

export const SERVICES = [
  "Consultation",
  "Anti-wrinkle injections",
  "Dermal fillers",
  "Skin rejuvenation",
  "Chemical peel",
  "Laser treatment",
  "Follow-up",
  "Other",
] as const;

export const patientSchema = z
  .object({
    firstName: required("the first name"),
    lastName: required("the surname"),
    preferredName: optional,
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Please enter the date of birth.")
      .refine((v) => new Date(v) < new Date(), "Date of birth must be in the past."),
    gender: optional,
    idNumber: optional,
    email: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined))
      .pipe(z.email("Please enter a valid email address.").optional()),
    phone,
    address: optional,
    contactPreference: z.enum(["sms", "email", "both"], { error: "Please choose how we should contact you." }),
    emergencyName: optional,
    emergencyPhone: optional,
    emergencyRelationship: optional,
    conditions: optional,
    medications: optional,
    allergies: optional,
    previousTreatments: optional,
    pregnantOrBreastfeeding: z.enum(["yes", "no", "na"]).default("na"),
    smoker: z.enum(["yes", "no"]).default("no"),
    treatmentInterest: optional,
    consentData: z.literal("on", { error: "We need your consent to store your details." }),
    consentAccuracy: z.literal("on", { error: "Please confirm the information is accurate." }),
    consentMarketing: z.literal("on").optional(),
    signedName: required("your full name as a signature"),
  })
  .refine((v) => v.contactPreference === "sms" || v.email, {
    message: "Please enter an email address, or choose SMS reminders.",
    path: ["email"],
  });

export type PatientInput = z.infer<typeof patientSchema>;

export const appointmentSchema = z.object({
  patientId: required("the patient"),
  doctorId: required("the doctor"),
  service: z.enum(SERVICES, { error: "Please choose a treatment." }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a date."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Please choose a time."),
  durationMinutes: z.coerce.number().int().min(10).max(240),
  notes: optional,
});

export const staffSchema = z.object({
  name: required("the name"),
  email: z.email("Please enter a valid email address."),
  phone: optional,
  role: z.enum(["ADMIN", "DOCTOR", "RECEPTION"]),
  password: z.string().min(12, "Passwords must be at least 12 characters."),
});

export type FieldErrors = Record<string, string>;

export function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
