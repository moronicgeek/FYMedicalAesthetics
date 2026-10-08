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

export function clinicInbox() {
  return process.env.CLINIC_INBOX_EMAIL || "hello@lumierclinic.co.za";
}
