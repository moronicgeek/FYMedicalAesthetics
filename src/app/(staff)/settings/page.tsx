import { requireUser } from "@/lib/auth";
import { listDoctors } from "@/lib/queries";
import { getOnCallDoctorId, getVitalRanges } from "@/lib/settings";
import { SettingsForm } from "@/components/SettingsForm";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireUser(["ADMIN"]);
  const [ranges, doctors, onCall] = await Promise.all([getVitalRanges(), listDoctors(), getOnCallDoctorId()]);
  return (
    <div className="space-y-6">
      <h1 className="page-title">Settings</h1>
      <SettingsForm ranges={ranges} doctors={doctors.map((d) => ({ value: d.id, label: d.name }))} onCallDoctorId={onCall ?? ""} />
    </div>
  );
}
