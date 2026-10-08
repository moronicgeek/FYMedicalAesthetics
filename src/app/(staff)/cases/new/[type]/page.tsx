import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ConsentForm } from "@/components/ConsentForm";
import { isCaseType } from "@/lib/consent-forms";

export const metadata = { title: "Consent form" };

export default async function NewCase({ params }: { params: Promise<{ type: string }> }) {
  await requireUser();
  const type = (await params).type.toUpperCase();
  if (!isCaseType(type)) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <ConsentForm type={type} kiosk={false} />
    </div>
  );
}
