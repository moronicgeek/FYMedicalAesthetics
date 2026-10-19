import { requireUser } from "@/lib/auth";
import { ProblemForm } from "@/components/ProblemForm";

export const metadata = { title: "Report a problem" };

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  await requireUser();
  const { from } = await searchParams;
  // Only a page on this site, so "Go back" can't send anyone elsewhere.
  const back = from && from.startsWith("/") && !from.startsWith("//") ? from : "/dashboard";
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="page-title">Report a problem</h1>
        <p className="muted">Something not working, or confusing? Tell us here and it goes straight to the person who looks after this system.</p>
      </div>
      <section className="card">
        <ProblemForm from={back} />
      </section>
    </div>
  );
}
