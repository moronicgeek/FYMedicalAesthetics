import { requireUser } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { imageResponse } from "@/lib/images";
import { canSeePatient } from "@/lib/patients";

// The photo of a patient's ID document, for the pages that show it.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!(await canSeePatient(user.role, id))) return imageResponse(null);
  const row = await db.patient.findUnique({ where: { id }, select: { idPhoto: true } });
  return imageResponse(row?.idPhoto ? decrypt(row.idPhoto) : null);
}
