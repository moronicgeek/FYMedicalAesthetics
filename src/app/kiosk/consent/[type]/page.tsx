import { notFound } from "next/navigation";
import { ConsentForm } from "@/components/ConsentForm";
import { isCaseType } from "@/lib/consent-forms";

export const metadata = { title: "Consent form" };

export default async function KioskConsent({ params }: { params: Promise<{ type: string }> }) {
  const type = (await params).type.toUpperCase();
  if (!isCaseType(type)) notFound();
  return <ConsentForm type={type} kiosk />;
}
