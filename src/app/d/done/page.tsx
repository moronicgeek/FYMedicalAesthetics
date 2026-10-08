import { Logo } from "@/components/Logo";

export const metadata = { title: "Decision recorded" };

export default async function DecisionDone({ searchParams }: { searchParams: Promise<{ decision?: string; code?: string }> }) {
  const { decision, code } = await searchParams;
  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <Logo />
      <main id="main" className="card space-y-3">
        <h1 className="page-title">Thank you</h1>
        <p className="text-lg">
          {decision === "yes" ? `You approved #${code}. The practitioner can now proceed.` : `You declined #${code}. The practitioner will not proceed and will refer the patient.`}
        </p>
      </main>
    </div>
  );
}
