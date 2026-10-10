import { CheckInForm } from "@/components/CheckInForm";

export const metadata = { title: "Check in" };

// Reception hands the tablet to the client, who checks themselves in.
export default function KioskCheckIn() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Welcome to FY Medical Aesthetics</h1>
        <p className="muted mt-2 text-lg">Please enter your details and choose your treatment. You can make the text bigger with the A+ buttons at the top.</p>
      </div>
      <div className="card">
        <CheckInForm kiosk />
      </div>
    </div>
  );
}
