"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getIvDrips, setIvDrips, setOnCallDoctorId, setVitalRanges } from "@/lib/settings";
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

export type DripState = { message?: string; error?: string; seq?: number };

// Adds, edits or removes one IV drip on the list clients and practitioners
// choose from.
export async function ivDripAction(prev: DripState, form: FormData): Promise<DripState> {
  const admin = await requireUser(["ADMIN"]);
  const seq = (prev.seq ?? 0) + 1;
  const name = String(form.get("drip") ?? "").trim().replace(/\s+/g, " ");
  const description = String(form.get("description") ?? "").trim().replace(/\s+/g, " ");
  const intent = form.get("intent");
  const drips = await getIvDrips();
  const existing = drips.find((d) => d.name === name);

  if (description.length > 200) return { error: "Please keep the description to 200 characters.", seq };

  if (intent === "remove") {
    if (!existing) return { seq };
    if (drips.length === 1) return { error: "Keep at least one drip on the list.", seq };
    await setIvDrips(drips.filter((d) => d !== existing));
    await audit(admin, "iv-drip-removed", "Settings");
    revalidatePath("/settings");
    return { message: `${name} removed. Past cases keep it.`, seq };
  }

  if (intent === "update") {
    if (!existing) return { seq };
    await setIvDrips(drips.map((d) => (d === existing ? { ...d, description } : d)));
    await audit(admin, "iv-drip-updated", "Settings");
    revalidatePath("/settings");
    return { message: `${name} description saved.`, seq };
  }

  if (!name) return { error: "Please type the name of the drip.", seq };
  if (name.length > 60) return { error: "Please keep the name under 60 characters.", seq };
  if (name.includes(",")) return { error: "Please leave commas out of the name.", seq };
  if (drips.some((d) => d.name.toLowerCase() === name.toLowerCase())) return { error: `${name} is already on the list.`, seq };
  await setIvDrips([...drips, { name, description }]);
  await audit(admin, "iv-drip-added", "Settings");
  revalidatePath("/settings");
  return { message: `${name} added.`, seq };
}
