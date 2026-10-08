import { requireUser } from "@/lib/auth";
import { PatientForm } from "@/components/PatientForm";

export const metadata = { title: "New patient" };

export default async function IntakePage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="page-title">Welcome to FY Medical Aesthetics</h1>
        <p className="muted mt-2 text-lg">
          Please fill in your details below. Fields marked <span className="text-danger" aria-hidden="true">*</span>
          <span className="sr-only">with an asterisk</span> are required. If you need help, just ask our reception team.
        </p>
      </div>
      <PatientForm submitLabel="Submit my details" />
    </div>
  );
}
