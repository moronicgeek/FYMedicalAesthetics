import { requireUser } from "@/lib/auth";
import { canSeeCase } from "@/lib/access";
import { decrypt, decryptJson } from "@/lib/crypto";
import { db } from "@/lib/db";
import { imageResponse } from "@/lib/images";
import type { CaseRecord } from "@/lib/cases";

// The patient's signature on the consent form, or the signature of whoever
// closed the case.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; who: string }> }) {
  const user = await requireUser();
  const { id, who } = await params;
  const row = await db.treatmentCase.findUnique({
    where: { id },
    select: { type: true, consent: who === "patient", practitionerSignature: who === "closer" },
  });
  if (!row || !canSeeCase(user.role, row.type)) return imageResponse(null);
  if (who === "patient") return imageResponse(row.consent ? decryptJson<CaseRecord>(row.consent).signature : null);
  return imageResponse(row.practitionerSignature ? decrypt(row.practitionerSignature) : null);
}
