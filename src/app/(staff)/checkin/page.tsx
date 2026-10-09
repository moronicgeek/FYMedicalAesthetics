import { requireUser } from "@/lib/auth";
import { CheckInForm } from "@/components/CheckInForm";

export const metadata = { title: "Check in a client" };

export default async function CheckInPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="page-title">Check in a client</h1>
        <p className="muted">Only the basics are needed now. The practitioner takes the rest of the details with the client.</p>
      </div>
      <div className="card">
        <CheckInForm canStart={user.role !== "RECEPTION"} />
      </div>
    </div>
  );
}
