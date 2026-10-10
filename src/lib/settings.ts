import "server-only";
import { db } from "./db";
import { DEFAULT_RANGES, type VitalRanges } from "./vitals";

export async function getVitalRanges(): Promise<VitalRanges> {
  const row = await db.setting.findUnique({ where: { key: "vitalRanges" } });
  return { ...DEFAULT_RANGES, ...((row?.value as Partial<VitalRanges> | null) ?? {}) };
}

export async function setVitalRanges(ranges: VitalRanges) {
  await db.setting.upsert({ where: { key: "vitalRanges" }, create: { key: "vitalRanges", value: ranges }, update: { value: ranges } });
}

export async function getOnCallDoctorId(): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key: "onCallDoctorId" } });
  return typeof row?.value === "string" ? row.value : null;
}

export async function setOnCallDoctorId(id: string | null) {
  await db.setting.upsert({ where: { key: "onCallDoctorId" }, create: { key: "onCallDoctorId", value: id ?? "" }, update: { value: id ?? "" } });
}

// The IV drips clients and practitioners choose from, each with a short
// description shown on the client's check-in cards. Admins edit them on the
// Settings page; a removed drip stays on the cases that already used it.
export type IvDrip = { name: string; description: string };

// Starting descriptions; the clinic should confirm the wording.
export const DEFAULT_IV_DRIPS: IvDrip[] = [
  { name: "Detox", description: "Antioxidants and hydration to support your body's natural detox and help you feel refreshed." },
  { name: "Jetfuel", description: "B vitamins and fluids for an energy lift when you're feeling tired or run down." },
  { name: "Glutago", description: "Glutathione, a powerful antioxidant, for brighter-looking skin and overall wellness." },
  { name: "Myers Cocktail", description: "The classic blend of magnesium, calcium, B vitamins and vitamin C for energy, hydration and immune support." },
  { name: "Myers Cocktail Plus", description: "The Myers Cocktail with extra vitamin C and glutathione for an added immune and antioxidant boost." },
];

export async function getIvDrips(): Promise<IvDrip[]> {
  const row = await db.setting.findUnique({ where: { key: "ivDrips" } });
  if (!Array.isArray(row?.value)) return DEFAULT_IV_DRIPS;
  // Lists saved before descriptions existed hold plain names.
  return row.value.flatMap((d): IvDrip[] => {
    if (typeof d === "string") return [{ name: d, description: DEFAULT_IV_DRIPS.find((x) => x.name === d)?.description ?? "" }];
    if (d && typeof d === "object" && "name" in d && typeof d.name === "string") return [{ name: d.name, description: "description" in d && typeof d.description === "string" ? d.description : "" }];
    return [];
  });
}

export async function getIvDripNames(): Promise<string[]> {
  return (await getIvDrips()).map((d) => d.name);
}

export async function setIvDrips(drips: IvDrip[]) {
  await db.setting.upsert({ where: { key: "ivDrips" }, create: { key: "ivDrips", value: drips }, update: { value: drips } });
}

export function clinicInbox() {
  return process.env.CLINIC_INBOX_EMAIL || "hello@lumierclinic.co.za";
}
