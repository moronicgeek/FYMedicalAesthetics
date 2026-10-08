import { PatientForm } from "@/components/PatientForm";

export const metadata = { title: "Patient check-in" };

export default function KioskPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Welcome to FY Medical Aesthetics</h1>
        <p className="muted mt-2 text-lg">
          Please fill in your details below. Fields marked <span className="text-danger" aria-hidden="true">*</span>
          <span className="sr-only">with an asterisk</span> are required. You can make the text bigger with the A+ buttons at the top. If you need help, just ask our reception team.
        </p>
      </div>
      <PatientForm submitLabel="Submit my details" kiosk />
    </div>
  );
}
