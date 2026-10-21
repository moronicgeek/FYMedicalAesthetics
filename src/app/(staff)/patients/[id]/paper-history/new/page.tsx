import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canSeePatient, getPatient } from "@/lib/patients";
import { clinicDateString } from "@/lib/time";
import { PaperHistoryForm } from "@/components/PaperHistoryForm";

export const metadata = { title: "Add history from paper" };

export default async function NewPaperHistory({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string }> }) {
  const user = await requireUser(["RECEPTION", "ADMIN"]);
  const { id } = await params;
  const { added } = await searchParams;
  const p = await getPatient(id);
  if (!p || !(await canSeePatient(user.role, id))) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <p className="muted"><Link href={`/patients/${id}#paper-history`} className="underline">Back to record</Link></p>
      <h1 className="page-title">Add history from paper for {p.firstName} {p.lastName}</h1>
      {added && <div className="alert alert-success" role="status">Entry saved. Add the next one below.</div>}
      <div className="alert alert-info">
        <p>Copy one visit or one part of the old paper file at a time. Each entry is marked &ldquo;From paper file&rdquo; with your name, so it is never mistaken for a visit recorded here.</p>
        <p>Today&rsquo;s visit is checked in as usual.</p>
      </div>
      {/* key resets the form after "Save and add another" */}
      <PaperHistoryForm key={added ?? "first"} patientId={id} today={clinicDateString()} />
    </div>
  );
}
