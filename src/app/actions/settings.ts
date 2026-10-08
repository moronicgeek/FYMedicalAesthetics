"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { setOnCallDoctorId, setVitalRanges } from "@/lib/settings";
import { VITAL_FIELDS, type VitalRanges } from "@/lib/vitals";

export type SettingsState = { message?: string; errors?: Record<string, string> };

export async function saveSettingsAction(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const admin = await requireUser(["ADMIN"]);
  const ranges = {} as VitalRanges;
  const errors: Record<string, string> = {};
  for (const f of VITAL_FIELDS) {
    const min = Number(String(form.get(`${f.key}_min`)).replace(",", "."));
    const max = Number(String(form.get(`${f.key}_max`)).replace(",", "."));
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || min >= max) errors[f.key] = "Minimum must be below maximum.";
    else ranges[f.key] = { min, max };
  }
  if (Object.keys(errors).length) return { errors };
  await setVitalRanges(ranges);
  await setOnCallDoctorId(String(form.get("onCallDoctorId") || "") || null);
  await audit(admin, "update", "Settings");
  revalidatePath("/settings");
  return { message: "Settings saved." };
}
