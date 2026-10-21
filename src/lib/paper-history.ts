import { z } from "zod";
import { clinicDateString } from "./time";
import { optional } from "./validation";

// History staff copy from a client's old paper file. Each entry is kept apart
// from visits recorded in this system and always shown as "From paper file".

export const PAPER_KINDS = {
  visit: "Past treatment or visit",
  medical: "Medical history",
  note: "Other note",
} as const;

export type PaperKind = keyof typeof PAPER_KINDS;

export type PaperEntry = {
  kind: PaperKind;
  // The date written on the paper file (YYYY-MM-DD), if it shows one.
  date?: string;
  treatment?: string;
  treatedBy?: string;
  notes: string;
};

const MAX_NOTES = 4000;

export const paperEntrySchema = z
  .object({
    kind: z.enum(Object.keys(PAPER_KINDS) as [PaperKind, ...PaperKind[]], { error: "Please choose what this entry is." }),
    date: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || undefined)
      .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please enter the date as shown on the file, or leave it blank.").optional()),
    treatment: optional.pipe(z.string().max(200, "Please keep this under 200 characters.").optional()),
    treatedBy: optional.pipe(z.string().max(200, "Please keep this under 200 characters.").optional()),
    notes: z.string().trim().min(1, "Please copy what the paper file says.").max(MAX_NOTES, `Please keep this under ${MAX_NOTES} characters. Add a second entry for the rest.`),
  })
  .refine((v) => !v.date || (!Number.isNaN(Date.parse(v.date)) && v.date <= clinicDateString()), {
    message: "The date can't be in the future.",
    path: ["date"],
  })
  .refine((v) => !v.date || v.date >= "1900-01-01", { message: "Please check the year.", path: ["date"] });

export function toPaperEntry(input: z.infer<typeof paperEntrySchema>): PaperEntry {
  const entry: PaperEntry = { kind: input.kind, notes: input.notes };
  if (input.date) entry.date = input.date;
  if (input.treatment) entry.treatment = input.treatment;
  if (input.treatedBy) entry.treatedBy = input.treatedBy;
  return entry;
}

// Newest date on the paper first; entries without a date go last, in the
// order they were typed in.
export function sortPaperEntries<T extends { entry: PaperEntry; createdAt: Date }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.entry.date && b.entry.date && a.entry.date !== b.entry.date) return a.entry.date < b.entry.date ? 1 : -1;
    if (a.entry.date && !b.entry.date) return -1;
    if (!a.entry.date && b.entry.date) return 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

// "3 March 2019" for a date from the paper file. It's a calendar date, not a
// moment, so no timezone shifting.
export function paperDate(date?: string) {
  if (!date) return "Date not on file";
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
}
