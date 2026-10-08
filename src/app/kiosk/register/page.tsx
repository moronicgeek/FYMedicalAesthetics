import { PatientForm } from "@/components/PatientForm";

export const metadata = { title: "Register" };

export default function KioskRegister() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Your details</h1>
        <p className="muted mt-2 text-lg">Fields marked <span className="text-danger" aria-hidden="true">*</span><span className="sr-only">with an asterisk</span> are required. If you need help, just ask our reception team.</p>
      </div>
      <PatientForm submitLabel="Submit my details" kiosk />
    </div>
  );
}
