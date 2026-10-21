import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { canRemovePaperHistory } from "@/lib/access";
import { decryptJson } from "@/lib/crypto";
import { db } from "@/lib/db";
import type { PaperEntry } from "@/lib/paper-history";
import { canSeePatient, getPatient } from "@/lib/patients";
import { clinicDateString } from "@/lib/time";
import { PaperHistoryForm } from "@/components/PaperHistoryForm";
import { removePaperHistoryAction } from "@/app/actions/paper-history";

export const metadata = { title: "Correct history from paper" };

export default async function EditPaperHistory({ params }: { params: Promise<{ id: string; entryId: string }> }) {
  const user = await requireUser(["RECEPTION", "ADMIN"]);
  const { id, entryId } = await params;
  const [p, row] = await Promise.all([getPatient(id), db.paperHistoryEntry.findFirst({ where: { id: entryId, patientId: id } })]);
  if (!p || !row || !(await canSeePatient(user.role, id))) notFound();
  await audit(user, "paper-history-view-edit", "Patient", id);
  const e = decryptJson<PaperEntry>(row.data);
  const initial = { kind: e.kind, date: e.date ?? "", treatment: e.treatment ?? "", treatedBy: e.treatedBy ?? "", notes: e.notes };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <p className="muted"><Link href={`/patients/${id}#paper-history`} className="underline">Back to record</Link></p>
      <h1 className="page-title">Correct history from paper for {p.firstName} {p.lastName}</h1>
      <p>Your name is recorded against the change.</p>
      <PaperHistoryForm patientId={id} entryId={entryId} initial={initial} today={clinicDateString()} />
      {canRemovePaperHistory(user.role) && (
        <details className="card">
          <summary className="cursor-pointer font-bold">Remove this entry</summary>
          <form action={removePaperHistoryAction} className="mt-3 space-y-3">
            <input type="hidden" name="patientId" value={id} />
            <input type="hidden" name="entryId" value={entryId} />
            <p>Only remove an entry typed onto the wrong patient or typed twice. This cannot be undone.</p>
            <button type="submit" className="btn btn-danger">Yes, remove it</button>
          </form>
        </details>
      )}
    </div>
  );
}
