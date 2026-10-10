import { requireUser } from "@/lib/auth";
import { listDoctors } from "@/lib/queries";
import { getIvDrips, getOnCallDoctorId, getVitalRanges } from "@/lib/settings";
import { IvDripsForm } from "@/components/IvDripsForm";
import { SettingsForm } from "@/components/SettingsForm";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireUser(["ADMIN"]);
  const [ranges, doctors, onCall, drips] = await Promise.all([getVitalRanges(), listDoctors(), getOnCallDoctorId(), getIvDrips()]);
  return (
    <div className="space-y-6">
      <h1 className="page-title">Settings</h1>
      <SettingsForm ranges={ranges} doctors={doctors.map((d) => ({ value: d.id, label: d.name }))} onCallDoctorId={onCall ?? ""} />
      <IvDripsForm drips={drips} />
    </div>
  );
}
