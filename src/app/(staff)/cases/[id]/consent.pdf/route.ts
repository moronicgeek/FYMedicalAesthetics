import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { consentPdf } from "@/lib/cases";

// Administrators download a signed consent form as a PDF.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["ADMIN"]);
  const { id } = await params;
  const signed = await consentPdf(id);
  if (!signed) notFound();
  await audit(user, "consent-downloaded", "TreatmentCase", id);
  return new Response(new Uint8Array(signed.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${signed.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
